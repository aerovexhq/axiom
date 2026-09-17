use betterado_core::{Logic4, LogicVector, SimTime};
use betterado_ir::{BirCircuit, NetId};
use betterado_sim::SimEventListener;
use hashbrown::HashMap;
use serde::{Deserialize, Serialize};

use crate::capacitance::NetCapacitanceModel;
use crate::rail::PowerRail;

/// Real-time frame of voltage, power, and energy telemetry.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TelemetryFrame {
    pub time: SimTime,
    pub instantaneous_power_mw: f64,
    pub total_energy_uj: f64,
    pub rail_currents_ma: HashMap<String, f64>,
    pub rail_voltages_v: HashMap<String, f64>,
    pub module_energy_uj: HashMap<String, f64>,
}

/// Activity statistics per net for SAIF export and switching activity reporting.
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct NetSwitchingStats {
    pub toggle_count: u64,
    pub duration_low_ps: u64,
    pub duration_high_ps: u64,
    pub duration_x_ps: u64,
    pub duration_z_ps: u64,
    pub last_change_time: SimTime,
    pub last_val: LogicVector,
}

/// Real-time physics-informed telemetry engine collecting power, energy, and switching activity.
pub struct TelemetryCollector {
    pub capacitance_model: NetCapacitanceModel,
    pub rails: HashMap<String, PowerRail>,
    /// Maps net name prefix to power rail (defaults to V_CORE)
    pub net_to_rail_map: HashMap<NetId, String>,

    pub total_energy_joules: f64,
    pub interval_energy_joules: f64,
    pub last_sample_time: SimTime,

    pub module_energy_joules: HashMap<String, f64>,
    pub net_stats: HashMap<NetId, NetSwitchingStats>,

    /// Circular buffer of recent telemetry frames for visualizers
    pub frame_history: Vec<TelemetryFrame>,
    pub max_history_frames: usize,
}

impl TelemetryCollector {
    pub fn new(circuit: &BirCircuit) -> Self {
        let mut rails = HashMap::new();
        rails.insert("V_CORE".to_string(), PowerRail::core());
        rails.insert("V_AUX".to_string(), PowerRail::aux());
        rails.insert("V_IO".to_string(), PowerRail::io(3.30));

        let mut net_stats = HashMap::new();
        for net in &circuit.nets {
            net_stats.insert(
                net.id,
                NetSwitchingStats {
                    toggle_count: 0,
                    duration_low_ps: 0,
                    duration_high_ps: 0,
                    duration_x_ps: 0,
                    duration_z_ps: 0,
                    last_change_time: SimTime::ZERO,
                    last_val: LogicVector::zeros(net.width),
                },
            );
        }

        Self {
            capacitance_model: NetCapacitanceModel::new(),
            rails,
            net_to_rail_map: HashMap::new(),
            total_energy_joules: 0.0,
            interval_energy_joules: 0.0,
            last_sample_time: SimTime::ZERO,
            module_energy_joules: HashMap::new(),
            net_stats,
            frame_history: Vec::new(),
            max_history_frames: 2_000,
        }
    }

    /// Associates a specific net with a power supply rail (e.g. "V_IO").
    pub fn assign_rail(&mut self, net: NetId, rail_name: &str) {
        self.net_to_rail_map.insert(net, rail_name.to_string());
    }

    /// Computes Hamming distance (number of bit transitions: 0->1 or 1->0).
    fn count_bit_transitions(prev: &LogicVector, curr: &LogicVector) -> u32 {
        let min_w = prev.width().min(curr.width());
        let mut flips = 0;
        for i in 0..min_w {
            let p = prev.get_bit(i);
            let c = curr.get_bit(i);
            if p != c && (p == Logic4::Zero || p == Logic4::One) && (c == Logic4::Zero || c == Logic4::One) {
                flips += 1;
            }
        }
        flips
    }

    /// Extracts hierarchical module scope name from net name (e.g. "top.alu.result" -> "top.alu").
    fn extract_module_scope(net_name: &str) -> String {
        if let Some((scope, _)) = net_name.rsplit_once('.') {
            scope.to_string()
        } else {
            "top".to_string()
        }
    }

    /// Samples current state and generates a `TelemetryFrame` for frontend display.
    pub fn generate_frame(&mut self, current_time: SimTime) -> TelemetryFrame {
        let dt_seconds = (current_time - self.last_sample_time).as_seconds_f64().max(1e-15);
        let inst_power_watts = self.interval_energy_joules / dt_seconds;
        let inst_power_mw = inst_power_watts * 1e3;
        let time_s = current_time.as_seconds_f64();

        let mut rail_currents_ma = HashMap::new();
        let mut rail_voltages_v = HashMap::new();

        for (name, rail) in &mut self.rails {
            let current_a = if rail.nominal_voltage > 0.0 {
                (inst_power_watts / rail.nominal_voltage).max(0.0)
            } else {
                0.0
            };
            let sag_voltage = rail.compute_voltage(current_a, time_s);

            rail_currents_ma.insert(name.clone(), current_a * 1e3);
            rail_voltages_v.insert(name.clone(), sag_voltage);
        }

        let module_energy_uj = self
            .module_energy_joules
            .iter()
            .map(|(k, v)| (k.clone(), v * 1e6))
            .collect();

        let frame = TelemetryFrame {
            time: current_time,
            instantaneous_power_mw: inst_power_mw,
            total_energy_uj: self.total_energy_joules * 1e6,
            rail_currents_ma,
            rail_voltages_v,
            module_energy_uj,
        };

        if self.frame_history.len() >= self.max_history_frames {
            self.frame_history.remove(0);
        }
        self.frame_history.push(frame.clone());

        self.interval_energy_joules = 0.0;
        self.last_sample_time = current_time;

        frame
    }
}

impl SimEventListener for TelemetryCollector {
    fn on_signal_change(
        &mut self,
        net: NetId,
        net_name: &str,
        val: &LogicVector,
        time: SimTime,
        _delta: u32,
    ) {
        // 1. Update switching statistics for SAIF
        let stats = self.net_stats.entry(net).or_default();
        let dt_ps = (time - stats.last_change_time).as_picoseconds();

        // Attribute duration to previous value state
        if let Some(first_bit) = stats.last_val.to_u64().map(|v| v & 1) {
            if first_bit == 1 {
                stats.duration_high_ps += dt_ps;
            } else {
                stats.duration_low_ps += dt_ps;
            }
        }

        let bit_flips = Self::count_bit_transitions(&stats.last_val, val);
        stats.toggle_count += bit_flips as u64;
        stats.last_change_time = time;
        let prev_val = stats.last_val.clone();
        stats.last_val = val.clone();

        if bit_flips == 0 {
            return;
        }

        // 2. Physics-based energy dissipation: dE = 0.5 * C_bit * V_rail^2 * bit_flips
        let rail_name = self
            .net_to_rail_map
            .get(&net)
            .map(|s| s.as_str())
            .unwrap_or("V_CORE");
        let v_rail = self
            .rails
            .get(rail_name)
            .map(|r| r.nominal_voltage)
            .unwrap_or(0.90);

        // Dummy BirNet for capacitance calculation
        let dummy_net = betterado_ir::BirNet {
            id: net,
            name: net_name.to_string(),
            width: prev_val.width().max(1),
            word_offset: 0,
            capacitance_ff: 1.2,
            initial_value: prev_val,
        };
        let c_bit = self.capacitance_model.get_bit_capacitance_f(&dummy_net);

        let d_energy = 0.5 * c_bit * (v_rail * v_rail) * (bit_flips as f64);
        self.total_energy_joules += d_energy;
        self.interval_energy_joules += d_energy;

        let scope = Self::extract_module_scope(net_name);
        *self.module_energy_joules.entry(scope).or_default() += d_energy;
    }
}
