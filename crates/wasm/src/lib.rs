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

        let points = axiom_syntax::coverage::CoveragePointExtractor::extract(FileId(1), source, &ast);
        sim.set_coverage_points(points);

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

    /// Rewind simulation by one discrete delta cycle.
    #[wasm_bindgen]
    pub fn step_back_delta(&mut self) -> Result<JsValue, JsValue> {
        let sim = self
            .sim
            .as_mut()
            .ok_or_else(|| JsValue::from_str("No design compiled"))?;

        let delta_summary = sim
            .step_back_delta()
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

    /// Rewind simulation physical time by dt_ps picoseconds.
    #[wasm_bindgen]
    pub fn step_back_time(&mut self, dt_ps: f64) -> Result<JsValue, JsValue> {
        let sim = self
            .sim
            .as_mut()
            .ok_or_else(|| JsValue::from_str("No design compiled"))?;

        let tick = sim
            .step_back_time(SimTime::from_picoseconds(dt_ps as u64))
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

    /// Scrub simulation to a target timestamp in picoseconds.
    #[wasm_bindgen]
    pub fn scrub_to_time(&mut self, target_time_ps: f64) -> Result<JsValue, JsValue> {
        let sim = self
            .sim
            .as_mut()
            .ok_or_else(|| JsValue::from_str("No design compiled"))?;

        let tick = sim
            .scrub_to_time(SimTime::from_picoseconds(target_time_ps as u64))
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

    /// Decode protocol transactions from request JSON payload.
    #[wasm_bindgen]
    pub fn decode_protocol(&self, request_json: &str) -> Result<JsValue, JsValue> {
        wasm_decode_protocol(request_json)
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

    /// Run in-RAM static analysis linter on Vivado XDC constraints.
    #[wasm_bindgen]
    pub fn lint_xdc(&self, source: &str) -> Result<JsValue, JsValue> {
        let diags = axiom_lsp::XdcLinter::lint(source);
        serde_wasm_bindgen::to_value(&diags).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Run in-RAM static analysis linter on VHDL IEEE 1076 source.
    #[wasm_bindgen]
    pub fn lint_vhdl(&self, source: &str) -> Result<JsValue, JsValue> {
        let diags = axiom_lsp::VhdlLinter::lint(source);
        serde_wasm_bindgen::to_value(&diags).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Run in-RAM static analysis linter on Memory file (.coe, .mem, .hex).
    #[wasm_bindgen]
    pub fn lint_mem(&self, source: &str, file_name: &str) -> Result<JsValue, JsValue> {
        let diags = axiom_lsp::MemLinter::lint(source, file_name);
        serde_wasm_bindgen::to_value(&diags).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Query hover documentation for identifier/keyword at (line, column).
    #[wasm_bindgen]
    pub fn hover(&self, source: &str, line: u32, column: u32) -> Result<JsValue, JsValue> {
        let result = axiom_lsp::VerilogHover::hover(source, line, column);
        serde_wasm_bindgen::to_value(&result).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Query hover documentation for XDC constraint keyword at (line, column).
    #[wasm_bindgen]
    pub fn hover_xdc(&self, source: &str, line: u32, column: u32) -> Result<JsValue, JsValue> {
        let result = axiom_lsp::XdcHover::hover(source, line, column);
        serde_wasm_bindgen::to_value(&result).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Query autocompletions for position at (line, column).
    #[wasm_bindgen]
    pub fn complete(&self, source: &str, line: u32, column: u32) -> Result<JsValue, JsValue> {
        let items = axiom_lsp::VerilogCompletion::complete(source, line, column);
        serde_wasm_bindgen::to_value(&items).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Query autocompletions for XDC constraints at (line, column).
    #[wasm_bindgen]
    pub fn complete_xdc(&self, source: &str, line: u32, column: u32) -> Result<JsValue, JsValue> {
        let items = axiom_lsp::XdcCompletion::complete(source, line, column);
        serde_wasm_bindgen::to_value(&items).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Run Static Timing Analysis (STA) on active circuit with XDC constraints.
    #[wasm_bindgen]
    pub fn run_sta(&self, verilog_source: &str, xdc_source: &str, top_module: Option<String>) -> Result<JsValue, JsValue> {
        wasm_run_sta(verilog_source, xdc_source, top_module)
    }

    /// Sets static AST coverage points on active simulation.
    #[wasm_bindgen]
    pub fn set_coverage_points(&mut self, source: &str) -> Result<(), JsValue> {
        let sim = self.sim.as_mut().ok_or_else(|| JsValue::from_str("Simulator not initialized"))?;
        let (ast, _) = parse_hdl(FileId(1), source);
        let points = axiom_syntax::coverage::CoveragePointExtractor::extract(FileId(1), source, &ast);
        sim.set_coverage_points(points);
        Ok(())
    }

    /// Queries the live RTL code coverage report.
    #[wasm_bindgen]
    pub fn get_coverage(&self) -> Result<JsValue, JsValue> {
        let sim = self.sim.as_ref().ok_or_else(|| JsValue::from_str("Simulator not initialized"))?;
        let report = sim.get_coverage_report();
        serde_wasm_bindgen::to_value(&report).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Resets live RTL code coverage counters.
    #[wasm_bindgen]
    pub fn reset_coverage(&mut self) -> Result<(), JsValue> {
        let sim = self.sim.as_mut().ok_or_else(|| JsValue::from_str("Simulator not initialized"))?;
        sim.reset_coverage();
        Ok(())
    }

    /// Exports standard LCOV (.info) format string.
    #[wasm_bindgen]
    pub fn export_lcov(&self, source_path: &str) -> Result<String, JsValue> {
        let sim = self.sim.as_ref().ok_or_else(|| JsValue::from_str("Simulator not initialized"))?;
        let report = sim.get_coverage_report();
        Ok(axiom_sim::generate_lcov(&report, source_path))
    }

    /// Exports standalone interactive HTML report.
    #[wasm_bindgen]
    pub fn export_html_report(&self, source_name: &str, source_code: &str) -> Result<String, JsValue> {
        let sim = self.sim.as_ref().ok_or_else(|| JsValue::from_str("Simulator not initialized"))?;
        let report = sim.get_coverage_report();
        Ok(axiom_sim::generate_html(&report, source_name, source_code))
    }

    pub fn recommend_pipeline(&self, verilog_source: &str, xdc_source: &str, top_module: Option<String>) -> Result<JsValue, JsValue> {
        wasm_recommend_pipeline(verilog_source, xdc_source, top_module)
    }

    pub fn apply_pipeline(
        &self,
        verilog_source: &str,
        top_module: &str,
        cut_net: &str,
        clock_name: &str,
        reset_name: Option<String>,
    ) -> Result<JsValue, JsValue> {
        wasm_apply_pipeline(verilog_source, top_module, cut_net, clock_name, reset_name)
    }

    pub fn evaluate_ppa(
        &self,
        verilog_source: &str,
        xdc_source: &str,
        top_module: Option<String>,
        target_device: Option<String>,
        target_clock_freq_mhz: Option<f32>,
        junction_temp_c: Option<f32>,
        core_voltage_v: Option<f32>,
        pdk: Option<String>,
    ) -> Result<JsValue, JsValue> {
        wasm_evaluate_ppa(
            verilog_source,
            xdc_source,
            top_module,
            target_device,
            target_clock_freq_mhz,
            junction_temp_c,
            core_voltage_v,
            pdk,
        )
    }
}

/// Standalone WebAssembly function to evaluate Power-Performance-Area (PPA) and silicon cost forecast.
#[wasm_bindgen]
pub fn wasm_evaluate_ppa(
    verilog_source: &str,
    xdc_source: &str,
    top_module: Option<String>,
    target_device: Option<String>,
    target_clock_freq_mhz: Option<f32>,
    junction_temp_c: Option<f32>,
    core_voltage_v: Option<f32>,
    pdk: Option<String>,
) -> Result<JsValue, JsValue> {
    let (ast, diags) = parse_hdl(FileId(1), verilog_source);
    if !diags.is_empty() {
        let err_msgs: Vec<String> = diags.iter().map(|d| d.message.clone()).collect();
        return Err(JsValue::from_str(&format!("HDL Syntax Error: {}", err_msgs.join("; "))));
    }

    let top = top_module.unwrap_or_else(|| {
        ast.modules.first().map(|m| m.name.clone()).unwrap_or_else(|| "top".to_string())
    });

    let circuit = elaborate(&ast, &top).map_err(|e| JsValue::from_str(&format!("Elaboration Error: {}", e)))?;
    let sta_summary = axiom_sta::analyze_circuit(&circuit, xdc_source, None);

    let options = axiom_telemetry::PpaOptions {
        target_device,
        target_clock_freq_mhz,
        junction_temp_c,
        core_voltage_v,
        switching_activity_alpha: Some(0.125),
        pdk,
    };

    let report = axiom_telemetry::PpaEvaluator::evaluate(&circuit, Some(&sta_summary), Some(options));
    serde_wasm_bindgen::to_value(&report).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Standalone WebAssembly function to run Silicon Copilot timing slack auto-pipelining analysis.
#[wasm_bindgen]
pub fn wasm_recommend_pipeline(verilog_source: &str, xdc_source: &str, top_module: Option<String>) -> Result<JsValue, JsValue> {
    let (ast, diags) = parse_hdl(FileId(1), verilog_source);
    if !diags.is_empty() {
        let err_msgs: Vec<String> = diags.iter().map(|d| d.message.clone()).collect();
        return Err(JsValue::from_str(&format!("HDL Syntax Error: {}", err_msgs.join("; "))));
    }

    let top = top_module.unwrap_or_else(|| {
        ast.modules.first().map(|m| m.name.clone()).unwrap_or_else(|| "top".to_string())
    });

    let circuit = elaborate(&ast, &top).map_err(|e| JsValue::from_str(&format!("Elaboration Error: {}", e)))?;
    let summary = axiom_sta::analyze_circuit(&circuit, xdc_source, None);

    let rec = axiom_sta::AutoPipeliner::analyze_path(
        &summary.critical_path,
        summary.clock_period_ps,
        None,
        None,
        Some(verilog_source),
    );

    serde_wasm_bindgen::to_value(&rec).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Standalone WebAssembly function to apply Silicon Copilot auto-pipelining refactoring.
#[wasm_bindgen]
pub fn wasm_apply_pipeline(
    verilog_source: &str,
    top_module: &str,
    cut_net: &str,
    clock_name: &str,
    reset_name: Option<String>,
) -> Result<JsValue, JsValue> {
    let (refactored, diff) = axiom_sta::AutoPipeliner::refactor_verilog(
        verilog_source,
        top_module,
        cut_net,
        clock_name,
        reset_name.as_deref(),
    ).map_err(|e| JsValue::from_str(&e))?;

    #[derive(serde::Serialize)]
    struct RefactorOutput {
        refactored_code: String,
        diff_preview: String,
    }

    let out = RefactorOutput {
        refactored_code: refactored,
        diff_preview: diff,
    };

    serde_wasm_bindgen::to_value(&out).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Standalone WebAssembly function to run Static Timing Analysis (STA).
#[wasm_bindgen]
pub fn wasm_run_sta(verilog_source: &str, xdc_source: &str, top_module: Option<String>) -> Result<JsValue, JsValue> {
    let (ast, diags) = parse_hdl(FileId(1), verilog_source);
    if !diags.is_empty() {
        let err_msgs: Vec<String> = diags.iter().map(|d| d.message.clone()).collect();
        return Err(JsValue::from_str(&format!("HDL Syntax Error: {}", err_msgs.join("; "))));
    }

    let top = top_module.unwrap_or_else(|| {
        ast.modules.first().map(|m| m.name.clone()).unwrap_or_else(|| "top".to_string())
    });

    let circuit = elaborate(&ast, &top).map_err(|e| JsValue::from_str(&format!("Elaboration Error: {}", e)))?;
    let summary = axiom_sta::analyze_circuit(&circuit, xdc_source, None);

    serde_wasm_bindgen::to_value(&summary).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Standalone WebAssembly function to lint Verilog source without creating an engine instance.
#[wasm_bindgen]
pub fn wasm_lint(source: &str) -> Result<JsValue, JsValue> {
    let diags = axiom_lsp::VerilogLinter::lint(source);
    serde_wasm_bindgen::to_value(&diags).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Standalone WebAssembly function to lint XDC constraints source without creating an engine instance.
#[wasm_bindgen]
pub fn wasm_lint_xdc(source: &str) -> Result<JsValue, JsValue> {
    let diags = axiom_lsp::XdcLinter::lint(source);
    serde_wasm_bindgen::to_value(&diags).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Standalone WebAssembly function to lint VHDL source without creating an engine instance.
#[wasm_bindgen]
pub fn wasm_lint_vhdl(source: &str) -> Result<JsValue, JsValue> {
    let diags = axiom_lsp::VhdlLinter::lint(source);
    serde_wasm_bindgen::to_value(&diags).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Standalone WebAssembly function to lint Memory initialization file without creating an engine instance.
#[wasm_bindgen]
pub fn wasm_lint_mem(source: &str, file_name: &str) -> Result<JsValue, JsValue> {
    let diags = axiom_lsp::MemLinter::lint(source, file_name);
    serde_wasm_bindgen::to_value(&diags).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Standalone WebAssembly function to query hover info without creating an engine instance.
#[wasm_bindgen]
pub fn wasm_hover(source: &str, line: u32, column: u32) -> Result<JsValue, JsValue> {
    let result = axiom_lsp::VerilogHover::hover(source, line, column);
    serde_wasm_bindgen::to_value(&result).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Standalone WebAssembly function to query XDC hover info without creating an engine instance.
#[wasm_bindgen]
pub fn wasm_hover_xdc(source: &str, line: u32, column: u32) -> Result<JsValue, JsValue> {
    let result = axiom_lsp::XdcHover::hover(source, line, column);
    serde_wasm_bindgen::to_value(&result).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Standalone WebAssembly function to query completions without creating an engine instance.
#[wasm_bindgen]
pub fn wasm_complete(source: &str, line: u32, column: u32) -> Result<JsValue, JsValue> {
    let items = axiom_lsp::VerilogCompletion::complete(source, line, column);
    serde_wasm_bindgen::to_value(&items).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Standalone WebAssembly function to query XDC completions without creating an engine instance.
#[wasm_bindgen]
pub fn wasm_complete_xdc(source: &str, line: u32, column: u32) -> Result<JsValue, JsValue> {
    let items = axiom_lsp::XdcCompletion::complete(source, line, column);
    serde_wasm_bindgen::to_value(&items).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Standalone WebAssembly function to synthesize micro-architectural block diagram from Verilog source.
#[wasm_bindgen]
pub fn wasm_synthesize_microarch(source: &str, top_module: Option<String>) -> Result<JsValue, JsValue> {
    let (ast, diags) = parse_hdl(FileId(1), source);
    if !diags.is_empty() {
        let err_msgs: Vec<String> = diags.iter().map(|d| d.message.clone()).collect();
        return Err(JsValue::from_str(&format!("HDL Syntax Error: {}", err_msgs.join("; "))));
    }

    let top = top_module.unwrap_or_else(|| {
        ast.modules.first().map(|m| m.name.clone()).unwrap_or_else(|| "top".to_string())
    });

    let circuit = elaborate(&ast, &top).map_err(|e| JsValue::from_str(&format!("Elaboration Error: {}", e)))?;
    let graph = axiom_ir::synthesize_microarch(&circuit, Some(&ast));

    serde_wasm_bindgen::to_value(&graph).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Standalone WebAssembly function to perform multi-die netlist partitioning.
#[wasm_bindgen]
pub fn wasm_partition_multidie(
    source: &str,
    top_module: Option<String>,
    device: Option<String>,
    constraints_json: Option<String>,
    enable_laguna: Option<bool>,
    tdm_ratio: Option<u32>,
) -> Result<JsValue, JsValue> {
    let (ast, diags) = parse_hdl(FileId(1), source);
    if !diags.is_empty() {
        let err_msgs: Vec<String> = diags.iter().map(|d| d.message.clone()).collect();
        return Err(JsValue::from_str(&format!("HDL Syntax Error: {}", err_msgs.join("; "))));
    }

    let top = top_module.unwrap_or_else(|| {
        ast.modules.first().map(|m| m.name.clone()).unwrap_or_else(|| "top".to_string())
    });

    let circuit = elaborate(&ast, &top).map_err(|e| JsValue::from_str(&format!("Elaboration Error: {}", e)))?;

    let mut user_constraints = hashbrown::HashMap::new();
    if let Some(json_str) = constraints_json {
        if let Ok(parsed) = serde_json::from_str::<hashbrown::HashMap<String, String>>(&json_str) {
            user_constraints = parsed;
        }
    }

    let config = axiom_ir::PartitionConfig {
        target_device: device.unwrap_or_else(|| "xcvu9p-flgb2104-2-e".to_string()),
        max_die_utilization_pct: 85.0,
        user_constraints,
        enable_laguna_insertion: enable_laguna.unwrap_or(false),
        tdm_ratio: tdm_ratio.unwrap_or(1),
    };

    let result = axiom_ir::partition_circuit(&circuit, &config);
    serde_wasm_bindgen::to_value(&result).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Standalone WebAssembly function to decode protocol transactions from request JSON.
#[wasm_bindgen]
pub fn wasm_decode_protocol(request_json: &str) -> Result<JsValue, JsValue> {
    let req: axiom_sim::ProtocolDecodeRequest = serde_json::from_str(request_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid ProtocolDecodeRequest JSON: {e}")))?;
    let transactions = axiom_sim::decode_protocol_request(&req);
    serde_wasm_bindgen::to_value(&transactions).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Standalone WebAssembly function to generate coverage report for given source and simulated time.
#[wasm_bindgen]
pub fn wasm_get_coverage(source: &str, top_module: Option<String>, sim_time_ps: Option<u64>) -> Result<JsValue, JsValue> {
    let (ast, diags) = parse_hdl(FileId(1), source);
    if !diags.is_empty() {
        let err_msgs: Vec<String> = diags.iter().map(|d| d.message.clone()).collect();
        return Err(JsValue::from_str(&format!("HDL Syntax Error: {}", err_msgs.join("; "))));
    }
    let top = top_module.unwrap_or_else(|| {
        ast.modules.first().map(|m| m.name.clone()).unwrap_or_else(|| "top".to_string())
    });
    let circuit = elaborate(&ast, &top).map_err(|e| JsValue::from_str(&format!("Elaboration Error: {e}")))?;
    let mut sim = AxiomSimulator::new(circuit).map_err(|e| JsValue::from_str(&format!("Sim Init Error: {e}")))?;
    let points = axiom_syntax::coverage::CoveragePointExtractor::extract(FileId(1), source, &ast);
    sim.set_coverage_points(points);
    if let Some(ps) = sim_time_ps {
        if ps > 0 {
            let _ = sim.tick(SimTime::from_ps(ps));
        }
    }
    let report = sim.get_coverage_report();
    serde_wasm_bindgen::to_value(&report).map_err(|e| JsValue::from_str(&e.to_string()))
}




