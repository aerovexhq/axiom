use axiom_core::{FileId, LogicVector, SimTime};
use axiom_ir::elaborate;
use axiom_sim::{AxiomSimulator, DeltaSummary, TickSummary};
use axiom_syntax::parse_hdl;
use axiom_telemetry::{SaifWriter, TelemetryCollector, TelemetryFrame, VcdWriter};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use wasm_bindgen::prelude::*;

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

/// WebAssembly simulation kernel executing 100% in-browser.
#[wasm_bindgen]
pub struct WasmEngine {
    sim: Option<AxiomSimulator>,
    collector: Option<Arc<Mutex<TelemetryCollector>>>,
    vcd: Option<Arc<Mutex<VcdWriter>>>,
}

#[wasm_bindgen]
impl WasmEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        #[cfg(feature = "console_error_panic_hook")]
        console_error_panic_hook::set_once();

        Self {
            sim: None,
            collector: None,
            vcd: None,
        }
    }

    /// Compile Verilog / SystemVerilog source code into executable 4-state simulation circuit.
    #[wasm_bindgen]
    pub fn compile(&mut self, source: &str, top_module: &str) -> Result<JsValue, JsValue> {
        let (ast, diags) = parse_hdl(FileId(1), source);
        if !diags.is_empty() {
            let err_msgs: Vec<String> = diags.iter().map(|d| d.message.clone()).collect();
            let resp = CompileResponse {
                success: false,
                top_module: top_module.to_string(),
                nets: Vec::new(),
                error: Some(err_msgs.join("\n")),
            };
            return serde_wasm_bindgen::to_value(&resp)
                .map_err(|e| JsValue::from_str(&e.to_string()));
        }

        let circuit = match elaborate(&ast, top_module) {
            Ok(c) => c,
            Err(e) => {
                let resp = CompileResponse {
                    success: false,
                    top_module: top_module.to_string(),
                    nets: Vec::new(),
                    error: Some(format!("Elaboration error: {e}")),
                };
                return serde_wasm_bindgen::to_value(&resp)
                    .map_err(|e| JsValue::from_str(&e.to_string()));
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
                let resp = CompileResponse {
                    success: false,
                    top_module: top_module.to_string(),
                    nets: Vec::new(),
                    error: Some(format!("Simulator initialization error: {e}")),
                };
                return serde_wasm_bindgen::to_value(&resp)
                    .map_err(|e| JsValue::from_str(&e.to_string()));
            }
        };

        sim.add_listener(Box::new(SharedTelemetryListener(Arc::clone(&collector))));
        sim.add_listener(Box::new(SharedVcdListener(Arc::clone(&vcd))));

        self.sim = Some(sim);
        self.collector = Some(collector);
        self.vcd = Some(vcd);

        let resp = CompileResponse {
            success: true,
            top_module: top_module.to_string(),
            nets: nets_info,
            error: None,
        };

        serde_wasm_bindgen::to_value(&resp).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Step simulation time forward by dt_ps picoseconds.
    #[wasm_bindgen]
    pub fn step_time(&mut self, dt_ps: f64) -> Result<JsValue, JsValue> {
        let sim = self
            .sim
            .as_mut()
            .ok_or_else(|| JsValue::from_str("No design compiled"))?;

        let tick = sim
            .tick(SimTime::from_picoseconds(dt_ps as u64))
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

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

        let resp = StepResponse {
            time_ps: time.as_picoseconds(),
            delta,
            tick_summary: Some(tick),
            delta_summary: None,
            signal_values,
            telemetry,
        };

        serde_wasm_bindgen::to_value(&resp).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Step simulation by a single discrete delta cycle (zero time).
    #[wasm_bindgen]
    pub fn step_delta(&mut self) -> Result<JsValue, JsValue> {
        let sim = self
            .sim
            .as_mut()
            .ok_or_else(|| JsValue::from_str("No design compiled"))?;

        let delta_summary = sim
            .step_delta()
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

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

        let resp = StepResponse {
            time_ps: time.as_picoseconds(),
            delta,
            tick_summary: None,
            delta_summary: Some(delta_summary),
            signal_values,
            telemetry,
        };

        serde_wasm_bindgen::to_value(&resp).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Force a logic value onto a net.
    #[wasm_bindgen]
    pub fn force_signal(&mut self, net_name: &str, value_str: &str) -> Result<(), JsValue> {
        let sim = self
            .sim
            .as_mut()
            .ok_or_else(|| JsValue::from_str("No design compiled"))?;

        let net = sim
            .compiled
            .circuit
            .get_net_by_name(net_name)
            .ok_or_else(|| JsValue::from_str(&format!("Net {net_name} not found")))?;

        let width = net.width;
        let val = if value_str.starts_with("0x") || value_str.starts_with("0X") {
            LogicVector::from_hex_str(&value_str[2..], Some(width))
                .map_err(|e| JsValue::from_str(&e.to_string()))?
        } else if value_str.starts_with("0b") || value_str.starts_with("0B") {
            LogicVector::from_bin_str(&value_str[2..])
                .map_err(|e| JsValue::from_str(&e.to_string()))?
        } else if let Ok(n) = value_str.parse::<u64>() {
            LogicVector::from_u64(n, width)
        } else {
            LogicVector::from_bin_str(value_str).map_err(|e| JsValue::from_str(&e.to_string()))?
        };

        sim.force_signal_and_settle(net_name, &val)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        Ok(())
    }

    /// Export simulation history as IEEE 1364 Value Change Dump (VCD).
    #[wasm_bindgen]
    pub fn export_vcd(&self) -> Result<String, JsValue> {
        let vcd = self
            .vcd
            .as_ref()
            .ok_or_else(|| JsValue::from_str("No simulation active"))?;
        Ok(vcd.lock().unwrap().as_str().to_string())
    }

    /// Export simulation switching activity as SAIF.
    #[wasm_bindgen]
    pub fn export_saif(&self) -> Result<String, JsValue> {
        let sim = self
            .sim
            .as_ref()
            .ok_or_else(|| JsValue::from_str("No simulation active"))?;
        let col = self
            .collector
            .as_ref()
            .ok_or_else(|| JsValue::from_str("No simulation active"))?;
        let time = sim.current_time;
        let saif = SaifWriter::generate_saif(
            &sim.compiled.circuit,
            &col.lock().unwrap(),
            time,
        );
        Ok(saif)
    }

    /// Run in-RAM static analysis linter on Verilog source code.
    #[wasm_bindgen]
    pub fn lint(&self, source: &str) -> Result<JsValue, JsValue> {
        let diags = axiom_lsp::VerilogLinter::lint(source);
        serde_wasm_bindgen::to_value(&diags).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Query hover documentation for identifier/keyword at (line, column).
    #[wasm_bindgen]
    pub fn hover(&self, source: &str, line: u32, column: u32) -> Result<JsValue, JsValue> {
        let result = axiom_lsp::VerilogHover::hover(source, line, column);
        serde_wasm_bindgen::to_value(&result).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Query autocompletions for position at (line, column).
    #[wasm_bindgen]
    pub fn complete(&self, source: &str, line: u32, column: u32) -> Result<JsValue, JsValue> {
        let items = axiom_lsp::VerilogCompletion::complete(source, line, column);
        serde_wasm_bindgen::to_value(&items).map_err(|e| JsValue::from_str(&e.to_string()))
    }
}

/// Standalone WebAssembly function to lint Verilog source without creating an engine instance.
#[wasm_bindgen]
pub fn wasm_lint(source: &str) -> Result<JsValue, JsValue> {
    let diags = axiom_lsp::VerilogLinter::lint(source);
    serde_wasm_bindgen::to_value(&diags).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Standalone WebAssembly function to query hover info without creating an engine instance.
#[wasm_bindgen]
pub fn wasm_hover(source: &str, line: u32, column: u32) -> Result<JsValue, JsValue> {
    let result = axiom_lsp::VerilogHover::hover(source, line, column);
    serde_wasm_bindgen::to_value(&result).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Standalone WebAssembly function to query completions without creating an engine instance.
#[wasm_bindgen]
pub fn wasm_complete(source: &str, line: u32, column: u32) -> Result<JsValue, JsValue> {
    let items = axiom_lsp::VerilogCompletion::complete(source, line, column);
    serde_wasm_bindgen::to_value(&items).map_err(|e| JsValue::from_str(&e.to_string()))
}

