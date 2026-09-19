use axiom_core::{FileId, LogicVector, SimTime};
use axiom_ir::elaborate;
use axiom_sim::{AxiomSimulator, DeltaSummary, TickSummary};
use axiom_syntax::parse_hdl;
use axiom_telemetry::{SaifWriter, TelemetryCollector, TelemetryFrame, VcdWriter};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::State;

type EngineState = Arc<Mutex<DesktopEngine>>;

#[tauri::command]
fn compile_design(source: String, top_module: String, state: State<'_, EngineState>) -> CompileResponse {
    state.lock().unwrap().compile(&source, &top_module)
}

#[tauri::command]
fn step_time(dt_ps: u64, state: State<'_, EngineState>) -> Result<StepResponse, String> {
    state.lock().unwrap().step_time(dt_ps)
}

#[tauri::command]
fn step_delta(state: State<'_, EngineState>) -> Result<StepResponse, String> {
    state.lock().unwrap().step_delta()
}

#[tauri::command]
fn force_signal(net_name: String, value: String, state: State<'_, EngineState>) -> Result<(), String> {
    state.lock().unwrap().force_signal(&net_name, &value)
}

#[tauri::command]
fn export_vcd(state: State<'_, EngineState>) -> Result<String, String> {
    state.lock().unwrap().export_vcd()
}

#[tauri::command]
fn export_saif(state: State<'_, EngineState>) -> Result<String, String> {
    state.lock().unwrap().export_saif()
}

#[tauri::command]
fn fs_read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn fs_write_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = std::path::Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn fs_remove_file(path: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    if p.is_dir() {
        std::fs::remove_dir_all(p).map_err(|e| e.to_string())
    } else {
        std::fs::remove_file(p).map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn fs_list_dir(path: String) -> Result<Vec<String>, String> {
    let mut entries = Vec::new();
    let read_dir = std::fs::read_dir(&path).map_err(|e| e.to_string())?;
    for entry in read_dir {
        if let Ok(entry) = entry {
            if let Some(name) = entry.file_name().to_str() {
                entries.push(name.to_string());
            }
        }
    }
    Ok(entries)
}

#[tauri::command]
fn fs_create_dir(path: String) -> Result<(), String> {
    std::fs::create_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn fs_exists(path: String) -> Result<bool, String> {
    Ok(std::path::Path::new(&path).exists())
}

pub fn run_desktop_app() {
    let engine: EngineState = Arc::new(Mutex::new(DesktopEngine::new()));

    tauri::Builder::default()
        .manage(engine)
        .invoke_handler(tauri::generate_handler![
            compile_design,
            step_time,
            step_delta,
            force_signal,
            export_vcd,
            export_saif,
            fs_read_file,
            fs_write_file,
            fs_remove_file,
            fs_list_dir,
            fs_create_dir,
            fs_exists
        ])
        .run(tauri::generate_context!())
        .expect("error while running Axiom EDA desktop application");
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetInfo {
    pub id: u32,
    pub name: String,
    pub width: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompileResponse {
    pub success: bool,
    pub top_module: String,
    pub nets: Vec<NetInfo>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepResponse {
    pub time_ps: u64,
    pub delta: u32,
    pub tick_summary: Option<TickSummary>,
    pub delta_summary: Option<DeltaSummary>,
    pub signal_values: Vec<(String, String)>,
    pub telemetry: TelemetryFrame,
}

/// Shared desktop simulation engine session.
pub struct DesktopEngine {
    pub sim: Option<AxiomSimulator>,
    pub collector: Option<Arc<Mutex<TelemetryCollector>>>,
    pub vcd: Option<Arc<Mutex<VcdWriter>>>,
}

struct SharedTelemetryListener(Arc<Mutex<TelemetryCollector>>);

impl axiom_sim::SimEventListener for SharedTelemetryListener {
    fn on_signal_change(
        &mut self,
        net: axiom_ir::NetId,
        net_name: &str,
        val: &LogicVector,
        time: SimTime,
        delta: u32,
    ) {
        if let Ok(mut col) = self.0.lock() {
            col.on_signal_change(net, net_name, val, time, delta);
        }
    }
}

struct SharedVcdListener(Arc<Mutex<VcdWriter>>);

impl axiom_sim::SimEventListener for SharedVcdListener {
    fn on_signal_change(
        &mut self,
        net: axiom_ir::NetId,
        net_name: &str,
        val: &LogicVector,
        time: SimTime,
        delta: u32,
    ) {
        if let Ok(mut vcd) = self.0.lock() {
            vcd.on_signal_change(net, net_name, val, time, delta);
        }
    }
}

impl Default for DesktopEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl DesktopEngine {
    pub fn new() -> Self {
        Self {
            sim: None,
            collector: None,
            vcd: None,
        }
    }

    pub fn compile(&mut self, source: &str, top_module: &str) -> CompileResponse {
        let (ast, diags) = parse_hdl(FileId(1), source);
        if !diags.is_empty() {
            let err_msgs: Vec<String> = diags.iter().map(|d| d.message.clone()).collect();
            return CompileResponse {
                success: false,
                top_module: top_module.to_string(),
                nets: Vec::new(),
                error: Some(err_msgs.join("\n")),
            };
        }

        let circuit = match elaborate(&ast, top_module) {
            Ok(c) => c,
            Err(e) => {
                return CompileResponse {
                    success: false,
                    top_module: top_module.to_string(),
                    nets: Vec::new(),
                    error: Some(format!("Elaboration error: {e}")),
                };
            }
        };

        let nets_info: Vec<NetInfo> = circuit
            .nets
            .iter()
            .map(|n| NetInfo {
                id: n.id.0,
                name: n.name.clone(),
                width: n.width,
            })
            .collect();

        let collector = Arc::new(Mutex::new(TelemetryCollector::new(&circuit)));
        let vcd = Arc::new(Mutex::new(VcdWriter::new(&circuit, "1 ps")));

        let mut sim = match AxiomSimulator::new(circuit) {
            Ok(s) => s,
            Err(e) => {
                return CompileResponse {
                    success: false,
                    top_module: top_module.to_string(),
                    nets: Vec::new(),
                    error: Some(format!("Simulator initialization error: {e}")),
                };
            }
        };

        sim.add_listener(Box::new(SharedTelemetryListener(Arc::clone(&collector))));
        sim.add_listener(Box::new(SharedVcdListener(Arc::clone(&vcd))));

        self.sim = Some(sim);
        self.collector = Some(collector);
        self.vcd = Some(vcd);

        CompileResponse {
            success: true,
            top_module: top_module.to_string(),
            nets: nets_info,
            error: None,
        }
    }

    pub fn step_time(&mut self, dt_ps: u64) -> Result<StepResponse, String> {
        let sim = self.sim.as_mut().ok_or("No design compiled")?;
        let tick = sim
            .tick(SimTime::from_picoseconds(dt_ps))
            .map_err(|e| e.to_string())?;

        let time = sim.current_time;
        let delta = sim.current_delta;

        let telemetry = if let Some(col) = &self.collector {
            col.lock().unwrap().generate_frame(time)
        } else {
            TelemetryFrame {
                time,
                instantaneous_power_mw: 0.0,
                total_energy_uj: 0.0,
                rail_currents_ma: hashbrown::HashMap::new(),
                rail_voltages_v: hashbrown::HashMap::new(),
                module_energy_uj: hashbrown::HashMap::new(),
            }
        };

        let mut signal_values = Vec::new();
        for net in &sim.compiled.circuit.nets {
            let val = sim.compiled.arena.read_net(net);
            signal_values.push((net.name.clone(), val.to_string()));
        }

        Ok(StepResponse {
            time_ps: time.as_picoseconds(),
            delta,
            tick_summary: Some(tick),
            delta_summary: None,
            signal_values,
            telemetry,
        })
    }

    pub fn step_delta(&mut self) -> Result<StepResponse, String> {
        let sim = self.sim.as_mut().ok_or("No design compiled")?;
        let delta_summary = sim.step_delta().map_err(|e| e.to_string())?;

        let time = sim.current_time;
        let delta = sim.current_delta;

        let telemetry = if let Some(col) = &self.collector {
            col.lock().unwrap().generate_frame(time)
        } else {
            TelemetryFrame {
                time,
                instantaneous_power_mw: 0.0,
                total_energy_uj: 0.0,
                rail_currents_ma: hashbrown::HashMap::new(),
                rail_voltages_v: hashbrown::HashMap::new(),
                module_energy_uj: hashbrown::HashMap::new(),
            }
        };

        let mut signal_values = Vec::new();
        for net in &sim.compiled.circuit.nets {
            let val = sim.compiled.arena.read_net(net);
            signal_values.push((net.name.clone(), val.to_string()));
        }

        Ok(StepResponse {
            time_ps: time.as_picoseconds(),
            delta,
            tick_summary: None,
            delta_summary: Some(delta_summary),
            signal_values,
            telemetry,
        })
    }

    pub fn force_signal(&mut self, net_name: &str, value_str: &str) -> Result<(), String> {
        let sim = self.sim.as_mut().ok_or("No design compiled")?;
        let net = sim
            .compiled
            .circuit
            .get_net_by_name(net_name)
            .ok_or_else(|| format!("Net {net_name} not found"))?;

        let width = net.width;
        let val = if value_str.starts_with("0x") || value_str.starts_with("0X") {
            LogicVector::from_hex_str(&value_str[2..], Some(width)).map_err(|e| e.to_string())?
        } else if value_str.starts_with("0b") || value_str.starts_with("0B") {
            LogicVector::from_bin_str(&value_str[2..]).map_err(|e| e.to_string())?
        } else if let Ok(n) = value_str.parse::<u64>() {
            LogicVector::from_u64(n, width)
        } else {
            LogicVector::from_bin_str(value_str).map_err(|e| e.to_string())?
        };

        sim.force_signal_and_settle(net_name, &val)
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn export_vcd(&self) -> Result<String, String> {
        let vcd = self.vcd.as_ref().ok_or("No simulation active")?;
        Ok(vcd.lock().unwrap().as_str().to_string())
    }

    pub fn export_saif(&self) -> Result<String, String> {
        let sim = self.sim.as_ref().ok_or("No simulation active")?;
        let col = self.collector.as_ref().ok_or("No simulation active")?;
        let time = sim.current_time;
        let saif = SaifWriter::generate_saif(
            &sim.compiled.circuit,
            &col.lock().unwrap(),
            time,
        );
        Ok(saif)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_desktop_engine_compile_and_step() {
        let mut engine = DesktopEngine::new();
        let src = include_str!("../../../tests/fixtures/counter.v");
        let resp = engine.compile(src, "counter");
        assert!(resp.success);
        assert_eq!(resp.top_module, "counter");
        assert!(!resp.nets.is_empty());

        // Step time
        let step = engine.step_time(10_000).unwrap();
        assert_eq!(step.time_ps, 10_000);
        assert!(!step.signal_values.is_empty());

        // Export VCD
        let vcd = engine.export_vcd().unwrap();
        assert!(vcd.contains("$scope module counter"));

        // Export SAIF
        let saif = engine.export_saif().unwrap();
        assert!(saif.contains("(DESIGN \"counter\")"));
    }
}
