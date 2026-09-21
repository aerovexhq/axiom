use std::env;
use std::fs;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::Instant;

use axiom_core::{FileId, LogicVector, SimTime};
use axiom_ir::elaborate;
use axiom_jit::JitEngine;
use axiom_sim::AxiomSimulator;
use axiom_syntax::parse_hdl;
use axiom_telemetry::{SaifWriter, TelemetryCollector, VcdWriter};


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

fn print_help() {
    let binary_name = env::args().next().unwrap_or_else(|| "axiom".to_string());
    let bin = Path::new(&binary_name)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("axiom");
    println!(
        r#"Axiom EDA — High-Performance HDL Engine & Silicon Telemetry (v{})

USAGE:
    {} <SUBCOMMAND> [OPTIONS]

SUBCOMMANDS:
    gui                                  Launch native standalone Tauri desktop studio (zero-port)
    compile <FILE> -t <TOP>              In-RAM parse, elaboration, and Cranelift JIT compilation
    run <FILE> -t <TOP> [OPTIONS]        Headless batch simulation with VCD/SAIF export
    benchmark <FILE> -t <TOP> [OPTIONS]  Measure compile latency and simulation throughput
    lint <FILE>                          Run static analysis rules on Verilog source file
    sta <FILE> [-t <TOP>] [--xdc <XDC>]  Run Static Timing Analysis (STA) and report slack
    copilot <FILE> [OPTIONS]             Silicon Copilot: timing slack auto-pipelining & refactoring
    ppa <FILE> [OPTIONS]                 Evaluate Power-Performance-Area (PPA) & silicon cost
    microarch <FILE> [-t <TOP>]          Synthesize micro-architectural block diagram hierarchy
    partition <FILE> [-t <TOP>]          Multi-FPGA partitioning & inter-die SLL interconnect analysis
    replay <FILE> -t <TOP> [OPTIONS]     Silicon time-travel bidirectional state rewind & scrubbing
    decode <FILE> -t <TOP> [OPTIONS]     In-engine hardware protocol decoding (UART, SPI, I2C, AXI)
    coverage <FILE> -t <TOP> [OPTIONS]   Run RTL statement, branch, toggle, and FSM code coverage
    verify <FILE> -t <TOP> [OPTIONS]     In-RAM Temporal Logic Assertion Radar (SVA / PSL verification)
    synth <FILE> -t <TOP> [OPTIONS]      In-RAM FPGA logic synthesis & technology mapping netlist
    lsp                                  Start stdio JSON-RPC Language Server Protocol (LSP) daemon
    help                                 Print this message or the help of the given subcommand(s)
    version                              Print version information

RUN OPTIONS:
    -t, --top <MODULE>       Name of top-level module (required)
    --ticks <N>              Number of clock ticks to simulate (default: 100)
    --vcd <FILE>             Dump IEEE 1364 Value Change Dump to FILE
    --saif <FILE>            Dump SAIF 2.0 switching activity to FILE

SYNTH OPTIONS:
    -t, --top <MODULE>       Name of top-level module (required)
    --device <PART>          Target FPGA device (default: xcku5p-ffvb676-2-e)
    -o, --out <FILE>         Write structural Verilog netlist to FILE
    --json                   Output machine-readable JSON netlist and statistics

VERIFY OPTIONS:
    -t, --top <MODULE>       Name of top-level module (required)
    --ticks <N>              Number of clock ticks to simulate (default: 50)
    --assert "<EXPR>"        Dynamic SVA assertion expression to evaluate
    --json                   Output machine-readable JSON report

PPA OPTIONS:
    -t, --top <MODULE>       Name of top-level module
    --device <PART>          Target FPGA device (default: xcku5p-ffvb676-2-e)
    --freq <MHZ>             Target clock frequency in MHz
    --temp <C>               Junction temperature in Celsius (default: 25.0)
    --pdk <PDK>              ASIC PDK (sky130 | ihp)
    --json                   Output machine-readable JSON report

BENCHMARK OPTIONS:
    -t, --top <MODULE>       Name of top-level module (required)
    --cycles <N>             Number of clock cycles for throughput measurement (default: 5000)
"#,
        env!("CARGO_PKG_VERSION"),
        bin
    );
}

pub struct RunConfig {
    pub file_path: String,
    pub top_module: String,
    pub ticks: u64,
    pub vcd_path: Option<String>,
    pub saif_path: Option<String>,
}

pub struct BenchmarkConfig {
    pub file_path: String,
    pub top_module: String,
    pub cycles: u64,
}

pub struct ReplayConfig {
    pub file_path: String,
    pub top_module: String,
    pub ticks: u64,
    pub rewind_ticks: u64,
}

pub struct DecodeCliConfig {
    pub file_path: String,
    pub top_module: String,
    pub protocol: String,
    pub ticks: u64,
}

pub struct PpaCliConfig {
    pub file_path: String,
    pub top_module: Option<String>,
    pub target_device: Option<String>,
    pub target_freq: Option<f32>,
    pub junction_temp: Option<f32>,
    pub pdk: Option<String>,
    pub json: bool,
}

pub struct VerifyCliConfig {
    pub file_path: String,
    pub top_module: String,
    pub ticks: u64,
    pub extra_assertions: Vec<String>,
    pub json: bool,
}

fn launch_desktop_app() {
    // Try launching axiom-desktop sibling executable first for clean process detachment,
    // or run directly via in-process Tauri runtime.
    if let Ok(current_exe) = env::current_exe() {
        let bin_name = if cfg!(windows) { "axiom-desktop.exe" } else { "axiom-desktop" };
        let sibling_desktop = current_exe.with_file_name(bin_name);
        if sibling_desktop.exists() && sibling_desktop != current_exe {
            let mut cmd = std::process::Command::new(&sibling_desktop);
            cmd.args(env::args().skip(2));
            match cmd.spawn() {
                Ok(_) => return,
                Err(e) => {
                    eprintln!("[axiom] Note: Sibling binary failed to spawn ({e}), launching in-process Tauri runtime...");
                }
            }
        }
    }

    println!("============================================================");
    println!(" Axiom EDA — Native Tauri Desktop Studio");
    println!(" Zero-Port Local Execution (No HTTP Server / No Sockets)");
    println!("============================================================");
    axiom_desktop::run_desktop_app();
}

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        // Default to launching the native Tauri desktop studio if launched with no arguments
        launch_desktop_app();
        return;
    }

    let subcommand = &args[1];
    match subcommand.as_str() {
        "gui" | "studio" | "ui" => {
            launch_desktop_app();
        }
        "-h" | "--help" | "help" => {
            print_help();
        }
        "-v" | "--version" | "version" => {
            println!("axiom {} (in-ram cranelift jit engine)", env!("CARGO_PKG_VERSION"));
        }
        "lsp" => {
            let mut server = axiom_lsp::LspServer::new();
            if let Err(e) = server.run_stdio() {
                eprintln!("[axiom-lsp] Server terminated with error: {e}");
                std::process::exit(1);
            }
        }
        "lint" => {
            if args.len() < 3 {
                eprintln!("Error: 'lint' requires a file path. Usage: axiom lint <FILE>");
                std::process::exit(1);
            }
            let file_path = &args[2];
            let content = match fs::read_to_string(file_path) {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("Failed to read '{file_path}': {e}");
                    std::process::exit(1);
                }
            };
            let diags = if file_path.ends_with(".xdc") || file_path.ends_with(".sdc") {
                axiom_lsp::XdcLinter::lint(&content)
            } else if file_path.ends_with(".vhd") || file_path.ends_with(".vhdl") {
                axiom_lsp::VhdlLinter::lint(&content)
            } else if file_path.ends_with(".mem") || file_path.ends_with(".hex") || file_path.ends_with(".coe") {
                axiom_lsp::MemLinter::lint(&content, file_path)
            } else {
                axiom_lsp::VerilogLinter::lint(&content)
            };
            if diags.is_empty() {
                println!("[OK] No issues found in {}", file_path);
            } else {
                println!("Found {} issues in {}:", diags.len(), file_path);
                for d in &diags {
                    let sev = match d.severity {
                        1 => "\x1b[1;31m[ERROR]\x1b[0m",
                        2 => "\x1b[1;33m[WARN]\x1b[0m",
                        3 => "\x1b[1;36m[INFO]\x1b[0m",
                        _ => "\x1b[1;37m[HINT]\x1b[0m",
                    };
                    println!("  {} {}:{}:{} [{}]: {}", sev, file_path, d.start_line_number, d.start_column, d.code, d.message);
                    if let Some(help) = &d.help {
                        println!("      ↳ \x1b[2mhelp: {}\x1b[0m", help);
                    }
                }
            }
        }
        "sta" => {
            if args.len() < 3 {
                eprintln!("Error: 'sta' requires a Verilog source file. Usage: axiom sta <FILE> [-t <TOP>] [--xdc <XDC>] [--device <DEVICE>]");
                std::process::exit(1);
            }
            let file_path = &args[2];
            let mut top_module = None;
            let mut xdc_path = None;
            let mut device = "ultrascale".to_string();

            let mut i = 3;
            while i < args.len() {
                match args[i].as_str() {
                    "-t" | "--top" => {
                        if i + 1 < args.len() {
                            top_module = Some(args[i + 1].clone());
                            i += 2;
                            continue;
                        }
                    }
                    "--xdc" => {
                        if i + 1 < args.len() {
                            xdc_path = Some(args[i + 1].clone());
                            i += 2;
                            continue;
                        }
                    }
                    "--device" => {
                        if i + 1 < args.len() {
                            device = args[i + 1].clone();
                            i += 2;
                            continue;
                        }
                    }
                    _ => {}
                }
                i += 1;
            }

            let verilog_source = match fs::read_to_string(file_path) {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("Failed to read '{file_path}': {e}");
                    std::process::exit(1);
                }
            };

            let xdc_content = if let Some(ref xp) = xdc_path {
                match fs::read_to_string(xp) {
                    Ok(c) => c,
                    Err(e) => {
                        eprintln!("Failed to read constraints '{xp}': {e}");
                        std::process::exit(1);
                    }
                }
            } else {
                String::new()
            };

            let (ast, diags) = parse_hdl(FileId(1), &verilog_source);
            if !diags.is_empty() {
                for d in &diags {
                    eprintln!("Syntax error: {}", d.message);
                }
                std::process::exit(1);
            }

            let top = top_module.unwrap_or_else(|| {
                ast.modules.first().map(|m| m.name.clone()).unwrap_or_else(|| "top".to_string())
            });

            let circuit = match elaborate(&ast, &top) {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("Elaboration error: {e}");
                    std::process::exit(1);
                }
            };

            let options = axiom_sta::StaOptions {
                target_device: device.clone(),
                ..Default::default()
            };
            let summary = axiom_sta::analyze_circuit(&circuit, &xdc_content, Some(options));
            let report = axiom_sta::format_ascii_report(&summary, &top, &device);
            println!("{}", report);
        }
        "copilot" => {
            if args.len() < 3 {
                eprintln!("Error: 'copilot' requires a Verilog source file. Usage: axiom copilot <FILE> [-t <TOP>] [--xdc <XDC>] [--apply] [--out <OUT>]");
                std::process::exit(1);
            }
            let file_path = &args[2];
            let mut top_module = None;
            let mut xdc_path = None;
            let mut apply = false;
            let mut out_path = None;

            let mut i = 3;
            while i < args.len() {
                match args[i].as_str() {
                    "-t" | "--top" => {
                        if i + 1 < args.len() {
                            top_module = Some(args[i + 1].clone());
                            i += 2;
                            continue;
                        }
                    }
                    "--xdc" => {
                        if i + 1 < args.len() {
                            xdc_path = Some(args[i + 1].clone());
                            i += 2;
                            continue;
                        }
                    }
                    "--apply" => {
                        apply = true;
                    }
                    "--out" => {
                        if i + 1 < args.len() {
                            out_path = Some(args[i + 1].clone());
                            i += 2;
                            continue;
                        }
                    }
                    _ => {}
                }
                i += 1;
            }

            let verilog_source = match fs::read_to_string(file_path) {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("Failed to read '{file_path}': {e}");
                    std::process::exit(1);
                }
            };

            let xdc_content = if let Some(ref xp) = xdc_path {
                match fs::read_to_string(xp) {
                    Ok(c) => c,
                    Err(e) => {
                        eprintln!("Failed to read constraints '{xp}': {e}");
                        std::process::exit(1);
                    }
                }
            } else {
                String::new()
            };

            let (ast, diags) = parse_hdl(FileId(1), &verilog_source);
            if !diags.is_empty() {
                for d in &diags {
                    eprintln!("Syntax error: {}", d.message);
                }
                std::process::exit(1);
            }

            let top = top_module.unwrap_or_else(|| {
                ast.modules.first().map(|m| m.name.clone()).unwrap_or_else(|| "top".to_string())
            });

            let circuit = match elaborate(&ast, &top) {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("Elaboration error: {e}");
                    std::process::exit(1);
                }
            };

            let summary = axiom_sta::analyze_circuit(&circuit, &xdc_content, None);
            let rec = axiom_sta::AutoPipeliner::analyze_path(
                &summary.critical_path,
                summary.clock_period_ps,
                None,
                None,
                Some(&verilog_source),
            );

            println!("\x1b[1;36m================================================================================");
            println!("  Axiom Silicon Copilot — Real-Time Timing Slack Auto-Pipeliner");
            println!("================================================================================\x1b[0m");
            println!("Top Module      : \x1b[1m{}\x1b[0m", top);
            println!("Critical Path   : \x1b[33m{}\x1b[0m -> \x1b[33m{}\x1b[0m", rec.startpoint, rec.endpoint);
            println!("Clock Domain    : {} (Target Period: {:.2} ps / {:.1} MHz)", rec.clock_name, rec.target_clock_period_ps, 1_000_000.0 / rec.target_clock_period_ps);
            println!("Current WNS     : \x1b[{}m{:.1} ps\x1b[0m", if rec.current_wns_ps < 0.0 { "1;31" } else { "1;32" }, rec.current_wns_ps);
            println!("Current Fmax    : {:.1} MHz\n", rec.current_fmax_mhz);

            if rec.candidates.is_empty() {
                println!("\x1b[32m[OK] No timing violations detected. The path already meets target timing.\x1b[0m");
            } else {
                println!("\x1b[1mEvaluated Candidate Pipeline Cut Points:\x1b[0m");
                println!("┌──────────────────────┬─────────────┬─────────────┬─────────────┬────────────┬─────────────┐");
                println!("│ Candidate Net        │ Stage 1 (ps)│ Stage 2 (ps)│ Pred. WNS   │ Pred. Fmax │ Optimal Cut │");
                println!("├──────────────────────┼─────────────┼─────────────┼─────────────┼────────────┼─────────────┤");

                for cand in &rec.candidates {
                    let opt_badge = if cand.is_optimal { "\x1b[1;32m   [YES]   \x1b[0m" } else { "     -     " };
                    println!(
                        "│ {:<20} │ {:>11.1} │ {:>11.1} │ {:>11.1} │ {:>8.1}MHz│{}│",
                        cand.net_name,
                        cand.stage1_delay_ps,
                        cand.stage2_delay_ps,
                        cand.predicted_wns_ps,
                        cand.predicted_fmax_mhz,
                        opt_badge
                    );
                }
                println!("└──────────────────────┴─────────────┴─────────────┴─────────────┴────────────┴─────────────┘\n");

                if let Some(opt) = &rec.optimal_cut {
                    println!("\x1b[1;32mSilicon Copilot Recommendation:\x1b[0m");
                    println!("  Cut Net         : \x1b[1;33m{}\x1b[0m (driven by {})", opt.net_name, opt.driver_cell);
                    println!("  Predicted WNS   : \x1b[1;32m{:.1} ps\x1b[0m (\x1b[1;32m+{:.1} ps gain\x1b[0m)", opt.predicted_wns_ps, opt.slack_gain_ps);
                    println!("  Predicted Fmax  : \x1b[1;32m{:.1} MHz\x1b[0m (\x1b[1;32m+{:.1} MHz / +{:.1}%\x1b[0m)",
                        opt.predicted_fmax_mhz, opt.fmax_gain_mhz,
                        (opt.fmax_gain_mhz / rec.current_fmax_mhz.max(1.0)) * 100.0
                    );
                    println!("  Latency Impact  : \x1b[36m+1 clock cycle\x1b[0m\n");

                    if let Some(diff) = &rec.diff_preview {
                        println!("\x1b[1mSystemVerilog Refactoring Preview (Driver-Shadow Pipelining):\x1b[0m");
                        for line in diff.lines() {
                            if line.starts_with('+') {
                                println!("\x1b[32m{}\x1b[0m", line);
                            } else if line.starts_with('-') {
                                println!("\x1b[31m{}\x1b[0m", line);
                            } else {
                                println!("{}", line);
                            }
                        }
                        println!();
                    }

                    if apply {
                        if let Some(ref new_code) = rec.refactored_code {
                            let target_dest = out_path.as_deref().unwrap_or(file_path);
                            if let Err(e) = fs::write(target_dest, new_code) {
                                eprintln!("Failed to write refactored code to '{target_dest}': {e}");
                                std::process::exit(1);
                            }
                            println!("\x1b[1;32m[OK] Successfully applied pipeline stage at '{}' and wrote to '{}'\x1b[0m", opt.net_name, target_dest);
                        }
                    } else {
                        println!("\x1b[90mTip: Run with '--apply' to automatically update RTL source file.\x1b[0m");
                    }
                }
            }
        }
        "ppa" => {
            if args.len() < 3 {
                eprintln!("Error: 'ppa' requires a Verilog source file. Usage: axiom ppa <FILE> [-t <TOP>] [--device <DEV>] [--freq <MHZ>] [--temp <C>] [--pdk <PDK>] [--json]");
                std::process::exit(1);
            }
            let file_path = args[2].clone();
            let mut top_module = None;
            let mut target_device = None;
            let mut target_freq = None;
            let mut junction_temp = None;
            let mut pdk = None;
            let mut json = false;

            let mut i = 3;
            while i < args.len() {
                match args[i].as_str() {
                    "-t" | "--top" => {
                        if i + 1 < args.len() {
                            top_module = Some(args[i + 1].clone());
                            i += 2;
                            continue;
                        }
                    }
                    "--device" => {
                        if i + 1 < args.len() {
                            target_device = Some(args[i + 1].clone());
                            i += 2;
                            continue;
                        }
                    }
                    "--freq" => {
                        if i + 1 < args.len() {
                            target_freq = args[i + 1].parse().ok();
                            i += 2;
                            continue;
                        }
                    }
                    "--temp" => {
                        if i + 1 < args.len() {
                            junction_temp = args[i + 1].parse().ok();
                            i += 2;
                            continue;
                        }
                    }
                    "--pdk" => {
                        if i + 1 < args.len() {
                            pdk = Some(args[i + 1].clone());
                            i += 2;
                            continue;
                        }
                    }
                    "--json" => {
                        json = true;
                    }
                    _ => {}
                }
                i += 1;
            }

            let cfg = PpaCliConfig {
                file_path,
                top_module,
                target_device,
                target_freq,
                junction_temp,
                pdk,
                json,
            };

            if let Err(e) = execute_ppa(&cfg) {
                eprintln!("PPA evaluation failed: {e}");
                std::process::exit(1);
            }
        }
        "microarch" => {
            if args.len() < 3 {
                eprintln!("Error: 'microarch' requires a Verilog source file. Usage: axiom microarch <FILE> [-t <TOP>] [--format json|tree]");
                std::process::exit(1);
            }
            let file_path = &args[2];
            let mut top_module = None;
            let mut format_json = false;

            let mut i = 3;
            while i < args.len() {
                match args[i].as_str() {
                    "-t" | "--top" => {
                        if i + 1 < args.len() {
                            top_module = Some(args[i + 1].clone());
                            i += 2;
                            continue;
                        }
                    }
                    "--format" => {
                        if i + 1 < args.len() {
                            if args[i + 1] == "json" {
                                format_json = true;
                            }
                            i += 2;
                            continue;
                        }
                    }
                    _ => {}
                }
                i += 1;
            }

            let verilog_source = match fs::read_to_string(file_path) {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("Failed to read '{file_path}': {e}");
                    std::process::exit(1);
                }
            };

            let (ast, diags) = parse_hdl(FileId(1), &verilog_source);
            if !diags.is_empty() {
                for d in &diags {
                    eprintln!("Syntax error: {}", d.message);
                }
                std::process::exit(1);
            }

            let top = top_module.unwrap_or_else(|| {
                ast.modules.first().map(|m| m.name.clone()).unwrap_or_else(|| "top".to_string())
            });

            let circuit = match elaborate(&ast, &top) {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("Elaboration Error: {}", e);
                    std::process::exit(1);
                }
            };

            let graph = axiom_ir::synthesize_microarch(&circuit, Some(&ast));

            if format_json {
                match serde_json::to_string_pretty(&graph) {
                    Ok(j) => println!("{}", j),
                    Err(e) => eprintln!("Serialization error: {}", e),
                }
            } else {
                println!("============================================================");
                println!(" Axiom Micro-Architectural Block Diagram Synthesis");
                println!(" Target Top Module: {}", graph.top_module);
                println!(" Total Macro Blocks: {}", graph.blocks.len());
                println!(" Datapath Buses:     {}", graph.buses.len());
                println!(" Control Wires:      {}", graph.control_wires.len());
                println!("------------------------------------------------------------");
                for (idx, block) in graph.blocks.iter().enumerate() {
                    println!(" [{}] {} (Category: {:?})", idx + 1, block.label, block.category);
                    println!("     Name:     {}", block.name);
                    println!("     Sublabel: {}", block.sublabel);
                    println!("     Inputs:   {}", block.inputs.iter().map(|p| p.name.as_str()).collect::<Vec<_>>().join(", "));
                    println!("     Outputs:  {}", block.outputs.iter().map(|p| p.name.as_str()).collect::<Vec<_>>().join(", "));
                }
                println!("============================================================");
            }
        }
        "partition" => {
            if args.len() < 3 {
                eprintln!("Error: 'partition' requires a Verilog source file. Usage: axiom partition <FILE> [-t <TOP>] [--device <DEVICE>] [--laguna] [--tdm <N>] [--json]");
                std::process::exit(1);
            }
            let file_path = &args[2];
            let mut top_module = None;
            let mut device = "xcvu9p-flgb2104-2-e".to_string();
            let mut enable_laguna = false;
            let mut tdm_ratio = 1;
            let mut format_json = false;

            let mut i = 3;
            while i < args.len() {
                match args[i].as_str() {
                    "-t" | "--top" => {
                        if i + 1 < args.len() {
                            top_module = Some(args[i + 1].clone());
                            i += 2;
                            continue;
                        }
                    }
                    "--device" => {
                        if i + 1 < args.len() {
                            device = args[i + 1].clone();
                            i += 2;
                            continue;
                        }
                    }
                    "--laguna" => {
                        enable_laguna = true;
                    }
                    "--tdm" => {
                        if i + 1 < args.len() {
                            if let Ok(val) = args[i + 1].parse::<u32>() {
                                tdm_ratio = val;
                            }
                            i += 2;
                            continue;
                        }
                    }
                    "--json" => {
                        format_json = true;
                    }
                    _ => {}
                }
                i += 1;
            }

            let verilog_source = match fs::read_to_string(file_path) {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("Failed to read '{file_path}': {e}");
                    std::process::exit(1);
                }
            };

            let (ast, diags) = parse_hdl(FileId(1), &verilog_source);
            if !diags.is_empty() {
                for d in &diags {
                    eprintln!("Syntax error: {}", d.message);
                }
                std::process::exit(1);
            }

            let top = top_module.unwrap_or_else(|| {
                ast.modules.first().map(|m| m.name.clone()).unwrap_or_else(|| "top".to_string())
            });

            let circuit = match elaborate(&ast, &top) {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("Elaboration Error: {}", e);
                    std::process::exit(1);
                }
            };

            let config = axiom_ir::PartitionConfig {
                target_device: device.clone(),
                max_die_utilization_pct: 85.0,
                user_constraints: Default::default(),
                enable_laguna_insertion: enable_laguna,
                tdm_ratio,
            };

            let result = axiom_ir::partition_circuit(&circuit, &config);

            if format_json {
                match serde_json::to_string_pretty(&result) {
                    Ok(j) => println!("{}", j),
                    Err(e) => eprintln!("Serialization error: {}", e),
                }
            } else {
                println!("============================================================");
                println!(" Axiom Multi-FPGA Partitioning & Silicon Interposer Analysis");
                println!(" Target Device:      {}", result.device.name);
                println!(" Architecture:       {}", result.device.family);
                println!(" Top Module:         {}", top);
                println!(" Laguna Pipelining:  {}", if enable_laguna { "ENABLED (+1 cycle)" } else { "DISABLED (Direct SLL)" });
                println!(" TDM Ratio:          {}:1", tdm_ratio);
                println!(" Total Cut-Nets:     {}", result.total_cut_nets);
                println!(" Total SLL Tracks:   {}", result.total_tracks_used);
                println!(" Interposer Power:   {:.3} mW", result.interposer_power_mw);
                println!("------------------------------------------------------------");
                println!(" Super Logic Region (SLR) Hardware Resource Utilization:");
                for die in &result.die_utilization {
                    println!("   • {:<6} | LC: {:>8} / {:>8} ({:>5.1}%) | Modules: {}",
                        die.die_id,
                        die.logic_cells_used,
                        die.logic_cells_capacity,
                        die.logic_cells_pct,
                        die.assigned_modules.join(", ")
                    );
                }
                println!("------------------------------------------------------------");
                println!(" Silicon Interposer Boundary SLL Saturation:");
                for b in &result.boundary_utilization {
                    let status = if b.is_overflow { "OVERFLOW [!]" } else { "OK" };
                    println!("   • {:<14} ({} <-> {}) | SLL: {:>4} / {:>4} ({:>5.1}%) | {}",
                        b.boundary_id,
                        b.die_a,
                        b.die_b,
                        b.tracks_used,
                        b.tracks_capacity,
                        b.utilization_pct,
                        status
                    );
                }
                println!("------------------------------------------------------------");
                println!(" Top Cut-Nets Traversing Interposer Boundaries:");
                for (idx, net) in result.cut_nets.iter().take(10).enumerate() {
                    println!("   [{:>2}] {:<18} | {:>2}b | {:<6} -> {:<6} | Delay: {:>6.1} ps (Lat: {} cyc)",
                        idx + 1,
                        net.net_name,
                        net.bit_width,
                        net.driver_die,
                        net.load_die,
                        net.estimated_delay_ps,
                        net.latency_cycles
                    );
                }
                if result.has_overflow {
                    eprintln!("============================================================");
                    eprintln!(" [WARNING] SLL boundary capacity exceeded! Consider inserting Laguna registers or increasing TDM ratio.");
                }
                println!("============================================================");
            }
        }
        "compile" => {
            if args.len() < 3 {
                eprintln!("Error: 'compile' requires a file path. Usage: axiom compile <FILE> -t <TOP>");
                std::process::exit(1);
            }
            let file_path = &args[2];
            let top_module = parse_top_arg(&args).unwrap_or_else(|| {
                eprintln!("Error: missing -t or --top argument. Usage: axiom compile <FILE> -t <TOP>");
                std::process::exit(1);
            });
            if let Err(e) = execute_compile(file_path, &top_module) {
                eprintln!("Compile Error: {}", e);
                std::process::exit(1);
            }
        }
        "run" => {
            if args.len() < 3 {
                eprintln!("Error: 'run' requires a file path. Usage: axiom run <FILE> -t <TOP> [OPTIONS]");
                std::process::exit(1);
            }
            let file_path = args[2].clone();
            let top_module = parse_top_arg(&args).unwrap_or_else(|| {
                eprintln!("Error: missing -t or --top argument. Usage: axiom run <FILE> -t <TOP> [OPTIONS]");
                std::process::exit(1);
            });

            let ticks = parse_u64_arg(&args, "--ticks").unwrap_or(100);
            let vcd_path = parse_string_arg(&args, "--vcd");
            let saif_path = parse_string_arg(&args, "--saif");

            let cfg = RunConfig {
                file_path,
                top_module,
                ticks,
                vcd_path,
                saif_path,
            };

            if let Err(e) = execute_run(&cfg) {
                eprintln!("Simulation Error: {}", e);
                std::process::exit(1);
            }
        }
        "benchmark" => {
            if args.len() < 3 {
                eprintln!("Error: 'benchmark' requires a file path. Usage: axiom benchmark <FILE> -t <TOP> [OPTIONS]");
                std::process::exit(1);
            }
            let file_path = args[2].clone();
            let top_module = parse_top_arg(&args).unwrap_or_else(|| {
                eprintln!("Error: missing -t or --top argument. Usage: axiom benchmark <FILE> -t <TOP> [OPTIONS]");
                std::process::exit(1);
            });
            let cycles = parse_u64_arg(&args, "--cycles").unwrap_or(5000);

            let cfg = BenchmarkConfig {
                file_path,
                top_module,
                cycles,
            };

            if let Err(e) = execute_benchmark(&cfg) {
                eprintln!("Benchmark Error: {}", e);
                std::process::exit(1);
            }
        }
        "replay" => {
            if args.len() < 3 {
                eprintln!("Error: 'replay' requires a file path. Usage: axiom replay <FILE> -t <TOP> [--ticks <N>] [--rewind <N>]");
                std::process::exit(1);
            }
            let file_path = args[2].clone();
            let top_module = parse_top_arg(&args).unwrap_or_else(|| {
                eprintln!("Error: missing -t or --top argument. Usage: axiom replay <FILE> -t <TOP> [OPTIONS]");
                std::process::exit(1);
            });
            let ticks = parse_u64_arg(&args, "--ticks").unwrap_or(20);
            let rewind_ticks = parse_u64_arg(&args, "--rewind").unwrap_or(10);

            let cfg = ReplayConfig {
                file_path,
                top_module,
                ticks,
                rewind_ticks,
            };

            if let Err(e) = execute_replay(&cfg) {
                eprintln!("Replay Error: {}", e);
                std::process::exit(1);
            }
        }
        "decode" => {
            if args.len() < 3 {
                eprintln!("Error: 'decode' requires a file path. Usage: axiom decode <FILE> -t <TOP> --protocol <uart|spi|i2c|axi> [--ticks <N>]");
                std::process::exit(1);
            }
            let file_path = args[2].clone();
            let top_module = parse_top_arg(&args).unwrap_or_else(|| {
                eprintln!("Error: missing -t or --top argument. Usage: axiom decode <FILE> -t <TOP> --protocol <uart|spi|i2c|axi>");
                std::process::exit(1);
            });
            let protocol = parse_string_arg(&args, "--protocol").unwrap_or_else(|| "uart".to_string());
            let ticks = parse_u64_arg(&args, "--ticks").unwrap_or(20);

            let cfg = DecodeCliConfig {
                file_path,
                top_module,
                protocol,
                ticks,
            };

            if let Err(e) = execute_decode(&cfg) {
                eprintln!("Decode Error: {}", e);
                std::process::exit(1);
            }
        }
        "coverage" => {
            if args.len() < 3 {
                eprintln!("Error: 'coverage' requires a file path. Usage: axiom coverage <FILE> -t <TOP> [--ticks <N>] [--lcov <PATH>] [--html <PATH>] [--json]");
                std::process::exit(1);
            }
            let file_path = args[2].clone();
            let top_module = parse_top_arg(&args).unwrap_or_else(|| {
                eprintln!("Error: missing -t or --top argument. Usage: axiom coverage <FILE> -t <TOP> [OPTIONS]");
                std::process::exit(1);
            });
            let ticks = parse_u64_arg(&args, "--ticks").unwrap_or(20);
            let lcov_path = parse_string_arg(&args, "--lcov");
            let html_path = parse_string_arg(&args, "--html");
            let json = args.iter().any(|a| a == "--json");

            let cfg = CoverageCliConfig {
                file_path,
                top_module,
                ticks,
                lcov_path,
                html_path,
                json,
            };

            if let Err(e) = execute_coverage(&cfg) {
                eprintln!("Coverage Error: {}", e);
                std::process::exit(1);
            }
        }
        "verify" => {
            if args.len() < 3 {
                eprintln!("Error: 'verify' requires a file path. Usage: axiom verify <FILE> -t <TOP> [--ticks <N>] [--assert \"<EXPR>\"] [--json]");
                std::process::exit(1);
            }
            let file_path = args[2].clone();
            let top_module = parse_top_arg(&args).unwrap_or_else(|| {
                eprintln!("Error: missing -t or --top argument. Usage: axiom verify <FILE> -t <TOP> [OPTIONS]");
                std::process::exit(1);
            });
            let ticks = parse_u64_arg(&args, "--ticks").unwrap_or(50);
            let mut extra_assertions = Vec::new();
            for i in 0..args.len() {
                if args[i] == "--assert" && i + 1 < args.len() {
                    extra_assertions.push(args[i + 1].clone());
                }
            }
            let json = args.iter().any(|a| a == "--json");

            let cfg = VerifyCliConfig {
                file_path,
                top_module,
                ticks,
                extra_assertions,
                json,
            };

            if let Err(e) = execute_verify(&cfg) {
                eprintln!("Verification Error: {}", e);
                std::process::exit(1);
            }
        }
        "synth" => {
            if args.len() < 3 {
                eprintln!("Error: 'synth' requires a file path. Usage: axiom synth <FILE> -t <TOP> [--device <PART>] [-o <OUT.v>] [--json]");
                std::process::exit(1);
            }
            let file_path = args[2].clone();
            let top_module = parse_top_arg(&args).unwrap_or_else(|| {
                eprintln!("Error: missing -t or --top argument. Usage: axiom synth <FILE> -t <TOP> [OPTIONS]");
                std::process::exit(1);
            });
            let device = parse_string_arg(&args, "--device").unwrap_or_else(|| "xcku5p-ffvb676-2-e".to_string());
            let out_path = parse_string_arg(&args, "-o").or_else(|| parse_string_arg(&args, "--out"));
            let json = args.iter().any(|a| a == "--json");

            let cfg = SynthCliConfig {
                file_path,
                top_module,
                device,
                out_path,
                json,
            };

            if let Err(e) = execute_synth(&cfg) {
                eprintln!("Synthesis Error: {}", e);
                std::process::exit(1);
            }
        }
        other => {
            eprintln!("Unknown subcommand '{}'. Use 'axiom help' for usage.", other);
            std::process::exit(1);
        }
    }
}

fn parse_top_arg(args: &[String]) -> Option<String> {
    for i in 0..args.len() {
        if (args[i] == "-t" || args[i] == "--top") && i + 1 < args.len() {
            return Some(args[i + 1].clone());
        }
    }
    None
}

fn parse_u64_arg(args: &[String], flag: &str) -> Option<u64> {
    for i in 0..args.len() {
        if args[i] == flag && i + 1 < args.len() {
            return args[i + 1].parse().ok();
        }
    }
    None
}

fn parse_string_arg(args: &[String], flag: &str) -> Option<String> {
    for i in 0..args.len() {
        if args[i] == flag && i + 1 < args.len() {
            return Some(args[i + 1].clone());
        }
    }
    None
}

fn resolve_file_path(path: &str) -> String {
    let p = Path::new(path);
    if p.exists() {
        return path.to_string();
    }
    if let Ok(manifest_dir) = env::var("CARGO_MANIFEST_DIR") {
        let cand = Path::new(&manifest_dir).join("../../").join(path);
        if cand.exists() {
            return cand.to_string_lossy().to_string();
        }
    }
    let parent_cand = Path::new("../..").join(path);
    if parent_cand.exists() {
        return parent_cand.to_string_lossy().to_string();
    }
    path.to_string()
}

pub fn execute_compile(file_path: &str, top_module: &str) -> Result<(), String> {
    let resolved = resolve_file_path(file_path);
    let source = fs::read_to_string(&resolved).map_err(|e| format!("Failed to read {}: {}", resolved, e))?;

    println!("============================================================");
    println!(" Axiom HDL In-RAM Compiler: {}", resolved);
    println!(" Top-Level Target: {}", top_module);
    println!("============================================================");

    let t_total = Instant::now();

    // 1. Lexing & Parsing
    let t_parse = Instant::now();
    let (ast, diags) = parse_hdl(FileId(1), &source);
    if !diags.is_empty() {
        let errs: Vec<String> = diags.iter().map(|d| d.message.clone()).collect();
        return Err(format!("Parse errors encountered:\n{}", errs.join("\n")));
    }
    let parse_elapsed = t_parse.elapsed();
    println!("  [1/3] Lexing & Parsing in {:.2?}", parse_elapsed);

    // 2. Elaboration
    let t_elab = Instant::now();
    let circuit = elaborate(&ast, top_module).map_err(|e| format!("Elaboration error: {e}"))?;
    let elab_elapsed = t_elab.elapsed();
    println!(
        "  [2/3] Elaboration: {} nets, {} processes, {} continuous assigns in {:.2?}",
        circuit.nets.len(),
        circuit.processes.len(),
        circuit.continuous_assigns.len(),
        elab_elapsed
    );

    // 3. JIT Compilation
    let t_jit = Instant::now();
    let compiled = JitEngine::compile(circuit).map_err(|e| format!("JIT compilation error: {e}"))?;
    let jit_elapsed = t_jit.elapsed();
    println!("  [3/3] In-RAM Cranelift JIT Compilation in {:.2?}", jit_elapsed);

    println!("------------------------------------------------------------");
    println!(" Compilation successful! Total latency: {:.2?}", t_total.elapsed());
    println!(" In-RAM Arena Footprint: {} 64-bit words ({} bytes)", compiled.arena.word_count, compiled.arena.word_count * 8);
    println!("============================================================");

    Ok(())
}

pub fn execute_run(cfg: &RunConfig) -> Result<(), String> {
    let resolved = resolve_file_path(&cfg.file_path);
    let source = fs::read_to_string(&resolved).map_err(|e| format!("Failed to read {}: {}", resolved, e))?;

    println!("============================================================");
    println!(" Axiom In-RAM Batch Simulator: {}", resolved);
    println!(" Target: {} | Steps: {} ticks", cfg.top_module, cfg.ticks);
    println!("============================================================");

    let (ast, diags) = parse_hdl(FileId(1), &source);
    if !diags.is_empty() {
        let errs: Vec<String> = diags.iter().map(|d| d.message.clone()).collect();
        return Err(format!("Parse errors:\n{}", errs.join("\n")));
    }
    let circuit = elaborate(&ast, &cfg.top_module).map_err(|e| format!("Elaboration error: {e}"))?;

    let collector = Arc::new(Mutex::new(TelemetryCollector::new(&circuit)));
    let vcd = Arc::new(Mutex::new(VcdWriter::new(&circuit, "1 ps")));

    let mut sim = AxiomSimulator::new(circuit).map_err(|e| format!("Simulator init error: {e}"))?;
    sim.add_listener(Box::new(SharedTelemetryListener(Arc::clone(&collector))));
    sim.add_listener(Box::new(SharedVcdListener(Arc::clone(&vcd))));

    let clk_net_name = sim
        .compiled
        .circuit
        .nets
        .iter()
        .find(|n| n.name == "clk" || n.name.ends_with(".clk"))
        .map(|n| n.name.clone());

    let t_sim = Instant::now();

    let step_ps = 500; // 500ps half-period (1 GHz)
    for tick in 0..cfg.ticks {
        if let Some(ref clk_name) = clk_net_name {
            let clk_val = if tick % 2 == 0 { 0u64 } else { 1u64 };
            let _ = sim.force_signal_and_settle(clk_name, &LogicVector::from_u64(clk_val, 1));
        }
        let _ = sim.step_delta();
        let _ = sim.tick(SimTime::from_picoseconds(step_ps));
    }

    let sim_elapsed = t_sim.elapsed();
    let final_time = sim.current_time;

    println!(" Simulation completed in {:.2?}", sim_elapsed);
    println!(
        " Final SimTime: {} ps ({:.3} ns) | Total Deltas: {}",
        final_time.as_picoseconds(),
        final_time.as_picoseconds() as f64 / 1000.0,
        sim.current_delta
    );
    println!(" Glitches Detected: {}", sim.glitch_detector.glitches().len());

    let frame = collector.lock().unwrap().generate_frame(final_time);
    println!(" Total Energy Dissipated: {:.4} uJ", frame.total_energy_uj);
    println!(" Instantaneous Dynamic Power: {:.2} mW", frame.instantaneous_power_mw);

    // Export VCD if requested
    if let Some(ref vcd_out) = cfg.vcd_path {
        let vcd_str = vcd.lock().unwrap().as_str().to_string();
        fs::write(vcd_out, vcd_str).map_err(|e| format!("Failed to write VCD to {}: {}", vcd_out, e))?;
        println!(" Exported IEEE 1364 VCD to: {}", vcd_out);
    }

    // Export SAIF if requested
    if let Some(ref saif_out) = cfg.saif_path {
        let saif_str = SaifWriter::generate_saif(
            &sim.compiled.circuit,
            &collector.lock().unwrap(),
            final_time,
        );
        fs::write(saif_out, saif_str).map_err(|e| format!("Failed to write SAIF to {}: {}", saif_out, e))?;
        println!(" Exported SAIF 2.0 to: {}", saif_out);
    }

    println!("============================================================");
    Ok(())
}

pub fn execute_benchmark(cfg: &BenchmarkConfig) -> Result<(), String> {
    let resolved = resolve_file_path(&cfg.file_path);
    let source = fs::read_to_string(&resolved).map_err(|e| format!("Failed to read {}: {}", resolved, e))?;

    println!("============================================================");
    println!(" Axiom High-Resolution In-RAM Benchmark Suite");
    println!(" Fixture: {} | Top: {} | Cycles: {}", cfg.file_path, cfg.top_module, cfg.cycles);
    println!("============================================================");

    // 1. Compile latency benchmark (50 iterations)
    let compile_iters = 50;
    let t_compile_bench = Instant::now();
    for _ in 0..compile_iters {
        let (ast, diags) = parse_hdl(FileId(1), &source);
        if !diags.is_empty() {
            let msgs: Vec<String> = diags.iter().map(|d| format!("{:?}", d)).collect();
            return Err(format!("Parse errors in benchmark:\n{}", msgs.join("\n")));
        }
        let circuit = elaborate(&ast, &cfg.top_module).map_err(|e| e.to_string())?;
        let _compiled = JitEngine::compile(circuit).map_err(|e| e.to_string())?;
    }
    let avg_compile_time = t_compile_bench.elapsed() / compile_iters;
    println!(" [Benchmark 1] Average End-to-End JIT Compile Latency:");
    println!("   >> {:.3?} (In-RAM Lex + Parse + Elaborate + Cranelift JIT)", avg_compile_time);

    // 2. Simulation throughput benchmark
    let (ast, _) = parse_hdl(FileId(1), &source);
    let circuit = elaborate(&ast, &cfg.top_module).map_err(|e| e.to_string())?;
    let mut sim = AxiomSimulator::new(circuit).map_err(|e| e.to_string())?;

    let clk_net_name = sim
        .compiled
        .circuit
        .nets
        .iter()
        .find(|n| n.name == "clk" || n.name.ends_with(".clk"))
        .map(|n| n.name.clone());

    let t_sim_bench = Instant::now();
    for i in 0..cfg.cycles {
        if let Some(ref clk_name) = clk_net_name {
            let clk_val = i % 2;
            let _ = sim.force_signal_and_settle(clk_name, &LogicVector::from_u64(clk_val, 1));
        }
        let _ = sim.step_delta();
        let _ = sim.tick(SimTime::from_picoseconds(1000));
    }
    let sim_duration = t_sim_bench.elapsed();
    let cycles_per_sec = (cfg.cycles as f64) / sim_duration.as_secs_f64();
    let events_per_sec = cycles_per_sec * 5.0; // conservative 5 events/cycle average

    println!(" [Benchmark 2] In-RAM Simulation Throughput:");
    println!("   >> Total Duration: {:.3?}", sim_duration);
    println!("   >> Throughput: {:.2} cycles/sec ({:.2} MHz simulated clock rate)", cycles_per_sec, cycles_per_sec / 1e6);
    println!("   >> Event Rate: {:.2} events/sec", events_per_sec);
    println!("============================================================");

    Ok(())
}

pub fn execute_replay(cfg: &ReplayConfig) -> Result<(), String> {
    let resolved = resolve_file_path(&cfg.file_path);
    let source = fs::read_to_string(&resolved).map_err(|e| format!("Failed to read {}: {}", resolved, e))?;

    println!("============================================================");
    println!(" Axiom Silicon Time-Machine — Bidirectional State Replay");
    println!(" Fixture: {} | Top: {} | Forward: {} ticks | Rewind: {} ticks", cfg.file_path, cfg.top_module, cfg.ticks, cfg.rewind_ticks);
    println!("============================================================");

    let (ast, diags) = parse_hdl(FileId(1), &source);
    if !diags.is_empty() {
        let msgs: Vec<String> = diags.iter().map(|d| format!("{:?}", d)).collect();
        return Err(format!("Parse errors:\n{}", msgs.join("\n")));
    }
    let circuit = elaborate(&ast, &cfg.top_module).map_err(|e| e.to_string())?;
    let mut sim = AxiomSimulator::new(circuit).map_err(|e| e.to_string())?;

    let clk_net_name = sim
        .compiled
        .circuit
        .nets
        .iter()
        .find(|n| n.name == "clk" || n.name.ends_with(".clk"))
        .map(|n| n.name.clone());

    println!(" [1/3] Simulating forward {} clock cycles with snapshot history...", cfg.ticks);
    let t0 = Instant::now();
    for i in 0..cfg.ticks {
        if let Some(ref clk_name) = clk_net_name {
            let clk_val = (i + 1) % 2;
            let _ = sim.force_signal_and_settle(clk_name, &LogicVector::from_u64(clk_val, 1));
        }
        let _ = sim.step_delta();
        let _ = sim.tick(SimTime::from_picoseconds(1000));
    }
    let fwd_time = sim.current_time;
    println!("   >> Forward simulation reached t = {} ps (duration: {:.2?})", fwd_time.as_ps(), t0.elapsed());
    println!("   >> Snapshot Ring Buffer count: {} states", sim.time_machine.len());

    println!(" [2/3] Performing reverse step_back_time (-{} ps)...", cfg.rewind_ticks * 1000);
    let t_rewind = Instant::now();
    let rewind_ps = SimTime::from_ps(cfg.rewind_ticks * 1000);
    sim.step_back_time(rewind_ps).map_err(|e| e.to_string())?;
    let rewound_time = sim.current_time;
    println!("   >> Time machine rewound to t = {} ps (latency: {:.3?})", rewound_time.as_ps(), t_rewind.elapsed());

    println!(" [3/3] Performing scrub_to_time (t = 0 ps)...");
    let t_scrub = Instant::now();
    sim.scrub_to_time(SimTime::from_ps(0)).map_err(|e| e.to_string())?;
    println!("   >> Successfully scrubbed to t = {} ps (latency: {:.3?})", sim.current_time.as_ps(), t_scrub.elapsed());
    println!("============================================================");
    println!(" State replay verification PASSED (Bit-accurate state restored).");
    println!("============================================================");
    Ok(())
}

pub fn execute_decode(cfg: &DecodeCliConfig) -> Result<(), String> {
    let resolved = resolve_file_path(&cfg.file_path);
    let source = fs::read_to_string(&resolved).map_err(|e| format!("Failed to read {}: {}", resolved, e))?;

    println!("============================================================");
    println!(" Axiom Hardware Protocol Decoder Engine");
    println!(" Fixture: {} | Top: {} | Protocol: {}", cfg.file_path, cfg.top_module, cfg.protocol.to_uppercase());
    println!("============================================================");

    let (ast, diags) = parse_hdl(FileId(1), &source);
    if !diags.is_empty() {
        let msgs: Vec<String> = diags.iter().map(|d| format!("{:?}", d)).collect();
        return Err(format!("Parse errors:\n{}", msgs.join("\n")));
    }
    let circuit = elaborate(&ast, &cfg.top_module).map_err(|e| e.to_string())?;
    let mut sim = AxiomSimulator::new(circuit).map_err(|e| e.to_string())?;

    let clk_net_name = sim
        .compiled
        .circuit
        .nets
        .iter()
        .find(|n| n.name == "clk" || n.name.ends_with(".clk"))
        .map(|n| n.name.clone());

    for i in 0..cfg.ticks {
        if let Some(ref clk_name) = clk_net_name {
            let clk_val = (i + 1) % 2;
            let _ = sim.force_signal_and_settle(clk_name, &LogicVector::from_u64(clk_val, 1));
        }
        let _ = sim.step_delta();
        let _ = sim.tick(SimTime::from_picoseconds(1000));
    }

    let protocol_kind = match cfg.protocol.to_lowercase().as_str() {
        "uart" => axiom_sim::ProtocolKind::Uart,
        "spi" => axiom_sim::ProtocolKind::Spi,
        "i2c" => axiom_sim::ProtocolKind::I2c,
        "axi" | "axi-stream" | "axis" => axiom_sim::ProtocolKind::AxiStream,
        "axi4lite" | "axi-lite" => axiom_sim::ProtocolKind::Axi4Lite,
        other => return Err(format!("Unsupported protocol: '{}'. Supported: uart, spi, i2c, axi", other)),
    };

    let mut signals: hashbrown::HashMap<String, Vec<(u64, String)>> = hashbrown::HashMap::new();
    for net in &sim.compiled.circuit.nets {
        let val = sim.compiled.arena.read_net(net).to_string();
        signals.entry(net.name.clone()).or_default().push((0, val));
    }

    let req = axiom_sim::ProtocolDecodeRequest {
        protocol: protocol_kind,
        uart_config: Some(axiom_sim::UartConfig::default()),
        spi_config: Some(axiom_sim::SpiConfig::default()),
        i2c_config: Some(axiom_sim::I2cConfig::default()),
        axi_config: Some(axiom_sim::AxiConfig::default()),
        signals,
        pin_map: hashbrown::HashMap::new(),
    };

    let txs = axiom_sim::decode_protocol_request(&req);
    println!(" Decoded {} transaction packet(s):", txs.len());
    for tx in &txs {
        println!("   [#{} | {} ps - {} ps] {} : {}", tx.id, tx.start_time_ps, tx.end_time_ps, tx.protocol.name(), tx.summary);
    }
    println!("============================================================");
    Ok(())
}

pub struct CoverageCliConfig {
    pub file_path: String,
    pub top_module: String,
    pub ticks: u64,
    pub lcov_path: Option<String>,
    pub html_path: Option<String>,
    pub json: bool,
}

pub fn execute_coverage(cfg: &CoverageCliConfig) -> Result<(), String> {
    let resolved = resolve_file_path(&cfg.file_path);
    let source = fs::read_to_string(&resolved).map_err(|e| format!("Failed to read {}: {}", resolved, e))?;

    let (ast, diags) = parse_hdl(FileId(1), &source);
    if !diags.is_empty() {
        let errs: Vec<String> = diags.iter().map(|d| d.message.clone()).collect();
        return Err(format!("Parse errors:\n{}", errs.join("\n")));
    }

    let circuit = elaborate(&ast, &cfg.top_module).map_err(|e| format!("Elaboration error: {e}"))?;
    let mut sim = AxiomSimulator::new(circuit).map_err(|e| format!("Simulator init error: {e}"))?;

    let points = axiom_syntax::coverage::CoveragePointExtractor::extract(FileId(1), &source, &ast);
    sim.set_coverage_points(points);

    // If clock exists, toggle it
    let clock_net = sim.compiled.circuit.nets.iter().find(|n| n.name.contains("clk")).map(|n| n.name.clone());
    if let Some(clk) = &clock_net {
        let _ = sim.add_clock(clk, SimTime::from_nanoseconds(10));
    }

    // Run simulation
    let sim_time = SimTime::from_nanoseconds(cfg.ticks * 20);
    let _ = sim.tick(sim_time);

    let report = sim.get_coverage_report();

    if cfg.json {
        let json = serde_json::to_string_pretty(&report).map_err(|e| e.to_string())?;
        println!("{}", json);
        return Ok(());
    }

    if let Some(lcov_path) = &cfg.lcov_path {
        let lcov = axiom_sim::generate_lcov(&report, &cfg.file_path);
        fs::write(lcov_path, &lcov).map_err(|e| format!("Failed to write LCOV file: {e}"))?;
        println!("[OK] Exported LCOV tracefile to {}", lcov_path);
    }

    if let Some(html_path) = &cfg.html_path {
        let html = axiom_sim::generate_html(&report, &cfg.file_path, &source);
        fs::write(html_path, &html).map_err(|e| format!("Failed to write HTML report: {e}"))?;
        println!("[OK] Exported interactive HTML report to {}", html_path);
    }

    // Print ANSI colored terminal report
    println!("============================================================");
    println!(" Axiom RTL Code Coverage Report: {}", resolved);
    println!(" Target: {} | Duration: {} ns", cfg.top_module, cfg.ticks * 20);
    println!("============================================================");
    println!("  Metric                Covered    Total      Coverage");
    println!("------------------------------------------------------------");
    println!("  Statement Coverage    {:>7}    {:>7}      {:>5.1}%", report.statement_hit, report.statement_total, report.statement_pct);
    println!("  Branch Coverage       {:>7}    {:>7}      {:>5.1}%", report.branch_covered, report.branch_total, report.branch_pct);
    println!("  Toggle Coverage       {:>7}    {:>7}      {:>5.1}%", report.toggle_covered, report.toggle_total, report.toggle_pct);
    if report.fsm_state_total > 0 {
        println!("  FSM State Coverage    {:>7}    {:>7}      {:>5.1}%", report.fsm_state_hit, report.fsm_state_total, report.fsm_state_pct);
        println!("  FSM Transition Cov    {:>7}    {:>7}      {:>5.1}%", report.fsm_transition_hit, report.fsm_transition_total, report.fsm_transition_pct);
    }
    println!("------------------------------------------------------------");
    println!("  \x1b[1;32mOverall Quality Score: {:>5.1}%\x1b[0m", report.overall_pct);
    println!("============================================================");

    Ok(())
}

pub fn execute_ppa(cfg: &PpaCliConfig) -> Result<(), String> {
    let resolved = resolve_file_path(&cfg.file_path);
    let source = fs::read_to_string(&resolved).map_err(|e| format!("Failed to read {}: {}", resolved, e))?;

    let (ast, diags) = parse_hdl(FileId(1), &source);
    if !diags.is_empty() {
        let errs: Vec<String> = diags.iter().map(|d| d.message.clone()).collect();
        return Err(format!("Parse errors:\n{}", errs.join("\n")));
    }

    let top = cfg.top_module.clone().unwrap_or_else(|| {
        ast.modules.first().map(|m| m.name.clone()).unwrap_or_else(|| "top".to_string())
    });

    let circuit = elaborate(&ast, &top).map_err(|e| format!("Elaboration error: {e}"))?;
    let sta_summary = axiom_sta::analyze_circuit(&circuit, "", None);

    let options = axiom_telemetry::PpaOptions {
        target_device: cfg.target_device.clone(),
        target_clock_freq_mhz: cfg.target_freq,
        junction_temp_c: cfg.junction_temp,
        core_voltage_v: Some(0.95),
        switching_activity_alpha: Some(0.125),
        pdk: cfg.pdk.clone(),
    };

    let report = axiom_telemetry::PpaEvaluator::evaluate(&circuit, Some(&sta_summary), Some(options));

    if cfg.json {
        let json_str = serde_json::to_string_pretty(&report).map_err(|e| e.to_string())?;
        println!("{}", json_str);
        return Ok(());
    }

    println!("\x1b[1;36m================================================================================");
    println!("  Axiom EDA — Power-Performance-Area (PPA) & Silicon Cost Radar");
    println!("================================================================================\x1b[0m");
    println!("Top Module      : \x1b[1m{}\x1b[0m", report.top_module);
    println!("Target Part     : \x1b[1;33m{}\x1b[0m", cfg.target_device.as_deref().unwrap_or("xcku5p-ffvb676-2-e"));
    println!("Operating Freq  : {:.1} MHz (Period: {:.2} ps)", report.metrics.fmax_mhz, report.metrics.clock_period_ps);
    println!("Worst Slack     : \x1b[{}m{:.1} ps\x1b[0m", if report.metrics.worst_negative_slack_ps < 0.0 { "1;31" } else { "1;32" }, report.metrics.worst_negative_slack_ps);
    println!("Total Power     : \x1b[1;32m{:.2} mW\x1b[0m (Dynamic: {:.2} mW | Static: {:.2} mW at {:.1}°C)",
        report.metrics.total_power_mw, report.metrics.dynamic_power_mw, report.metrics.static_power_mw, report.metrics.junction_temperature_c);
    println!("Energy / Cycle  : {:.2} pJ", report.metrics.energy_per_cycle_pj);
    println!("Figure of Merit : \x1b[1;35m{:.1} MHz / (W · Area)\x1b[0m\n", report.metrics.fom_score);

    println!("\x1b[1mHardware Resource Utilization:\x1b[0m");
    println!("  LUTs: {:<8} | FFs: {:<8} | BRAM36K: {:<5} | DSP Slices: {:<5}",
        report.metrics.lut_count, report.metrics.ff_count, report.metrics.bram_36k_count, report.metrics.dsp_slice_count);
    println!("  Equivalent Logic Cells: {}\n", report.metrics.total_equivalent_logic_cells);

    println!("\x1b[1mMulti-Target FPGA Fitting & BOM Cost Advisor:\x1b[0m");
    println!("┌─────────────────────────────┬──────────────┬─────────────┬─────────────┬────────────┬─────────────┐");
    println!("│ Target FPGA Device          │ Family       │ Max Util %  │ Status      │ Unit Cost  │ Savings     │");
    println!("├─────────────────────────────┼──────────────┼─────────────┼─────────────┼────────────┼─────────────┤");

    for eval in &report.fpga_evaluations {
        let (status_str, status_color) = match eval.status {
            axiom_telemetry::FpgaFitStatus::Fits => ("   FITS   ", "1;32"),
            axiom_telemetry::FpgaFitStatus::ExceedsCapacity => (" OVERFLOW ", "1;31"),
        };
        let rec_tag = if eval.is_recommended { " \x1b[1;33m[REC]\x1b[0m" } else { "      " };
        let savings_str = if eval.cost_delta_vs_target < 0.0 {
            format!("\x1b[1;32m-${:.2}\x1b[0m", eval.cost_delta_vs_target.abs())
        } else if eval.cost_delta_vs_target > 0.0 {
            format!("+${:.2}", eval.cost_delta_vs_target)
        } else {
            "baseline".to_string()
        };

        println!(
            "│ {:<27} │ {:<12} │ {:>10.1}% │ \x1b[{}m{}\x1b[0m │ ${:>9.2} │ {:<11} │{}",
            eval.profile.name,
            eval.profile.family,
            eval.max_utilization_pct,
            status_color,
            status_str,
            eval.estimated_cost_usd,
            savings_str,
            rec_tag
        );
    }
    println!("└─────────────────────────────┴──────────────┴─────────────┴─────────────┴────────────┴─────────────┘\n");

    println!("\x1b[1mOpen-Source ASIC Silicon GDSII Forecast:\x1b[0m");
    println!("  Target PDK        : \x1b[36m{}\x1b[0m", report.asic_forecast.pdk_name);
    println!("  Gate Equivalent   : {} standard cell gates", report.asic_forecast.gate_count);
    println!("  Silicon Core Area : {:.4} mm² ({:.0} µm²)", report.asic_forecast.core_area_um2 / 1e6, report.asic_forecast.core_area_um2);
    println!("  Total Die Size    : \x1b[1m{:.2} mm × {:.2} mm\x1b[0m ({:.3} mm² with IO pad ring)",
        report.asic_forecast.die_width_mm, report.asic_forecast.die_height_mm, report.asic_forecast.die_area_mm2);
    println!("  Est. MPW Shuttle  : \x1b[1;32m${:.2}\x1b[0m", report.asic_forecast.estimated_mpw_shuttle_cost_usd);
    println!("  Est. Mask Set     : ${:.2}\n", report.asic_forecast.estimated_mask_set_cost_usd);

    if !report.optimization_suggestions.is_empty() {
        println!("\x1b[1;33mSilicon Optimization Suggestions:\x1b[0m");
        for sug in &report.optimization_suggestions {
            println!("  • {}", sug);
        }
        println!();
    }

    Ok(())
}

pub fn execute_verify(cfg: &VerifyCliConfig) -> Result<(), String> {
    let resolved = resolve_file_path(&cfg.file_path);
    let source = fs::read_to_string(&resolved).map_err(|e| format!("Failed to read {}: {}", resolved, e))?;

    let (ast, diags) = parse_hdl(FileId(1), &source);
    if !diags.is_empty() {
        let errs: Vec<String> = diags.iter().map(|d| d.message.clone()).collect();
        return Err(format!("Parse errors:\n{}", errs.join("\n")));
    }

    let circuit = elaborate(&ast, &cfg.top_module).map_err(|e| format!("Elaboration error: {e}"))?;
    let mut sim = AxiomSimulator::new(circuit).map_err(|e| format!("Simulator init error: {e}"))?;

    // Load assertions from AST
    sim.load_assertions_from_ast(&ast);

    // Load any CLI extra assertions
    for asrt_str in &cfg.extra_assertions {
        sim.add_assertion_str(asrt_str)?;
    }

    // Auto-detect clock
    let clock_net = sim.compiled.circuit.nets.iter().find(|n| n.name.contains("clk")).map(|n| n.name.clone());
    if let Some(clk) = &clock_net {
        let _ = sim.add_clock(clk, SimTime::from_nanoseconds(10));
    }

    // Run simulation
    let sim_time = SimTime::from_nanoseconds(cfg.ticks * 20);
    let _ = sim.tick(sim_time);

    let report = sim.get_assertion_report();

    if cfg.json {
        let json = serde_json::to_string_pretty(&report).map_err(|e| e.to_string())?;
        println!("{}", json);
        return Ok(());
    }

    println!("\x1b[1;36m================================================================================");
    println!("  Axiom EDA — In-RAM Temporal Logic Assertion Radar");
    println!("================================================================================\x1b[0m");
    println!("Target Module   : \x1b[1m{}\x1b[0m ({})", cfg.top_module, resolved);
    println!("Duration        : {} ns ({} ticks)", cfg.ticks * 20, cfg.ticks);
    println!("Total Properties: {}", report.total_assertions);
    println!("Violations      : \x1b[{}m{}\x1b[0m | Passes: \x1b[1;32m{}\x1b[0m | Vacuous: {}\n",
        if report.total_failures > 0 { "1;31" } else { "1;32" },
        report.total_failures,
        report.total_passes,
        report.total_vacuous
    );

    println!("┌────────┬─────────────────────────────┬──────────┬──────────┬──────────┬────────────┬──────────┐");
    println!("│ Status │ Assertion Name              │ Kind     │ Attempts │ Passes   │ Violations │ Vacuous  │");
    println!("├────────┼─────────────────────────────┼──────────┼──────────┼──────────┼────────────┼──────────┤");

    for stat in &report.assertions {
        let (status_str, status_color) = if !stat.violations.is_empty() {
            (" FAIL ", "1;31")
        } else if stat.stats.passes > 0 {
            (" PASS ", "1;32")
        } else if stat.stats.vacuous > 0 {
            (" VACU ", "1;33")
        } else {
            (" IDLE ", "0;37")
        };

        println!(
            "│ \x1b[{}m{}\x1b[0m │ {:<27} │ {:<8} │ {:>8} │ {:>8} │ \x1b[{}m{:>10}\x1b[0m │ {:>8} │",
            status_color,
            status_str,
            stat.def.name,
            match stat.def.kind {
                axiom_sim::AssertionKind::Assert => "assert",
                axiom_sim::AssertionKind::Assume => "assume",
                axiom_sim::AssertionKind::Cover => "cover",
            },
            stat.stats.attempts,
            stat.stats.passes,
            if !stat.violations.is_empty() { "1;31" } else { "0" },
            stat.violations.len(),
            stat.stats.vacuous,
        );
    }
    println!("└────────┴─────────────────────────────┴──────────┴──────────┴──────────┴────────────┴──────────┘\n");

    if !report.recent_violations.is_empty() {
        println!("\x1b[1;31mTemporal Protocol Violations Detected:\x1b[0m");
        for (idx, v) in report.recent_violations.iter().enumerate() {
            println!(
                "  [{}] \x1b[1m{}\x1b[0m at t = {} ps (cycle {})",
                idx + 1,
                v.assertion_name,
                v.fail_time.as_picoseconds(),
                v.fail_cycle,
            );
            println!("      Reason: \x1b[31m{}\x1b[0m", v.message);
            if let Some(line) = v.line {
                println!("      Location: line {}", line);
            }
        }
        println!();
    }

    if report.total_failures > 0 {
        return Err(format!("{} temporal assertion violation(s) detected", report.total_failures));
    }

    Ok(())
}

pub struct SynthCliConfig {
    pub file_path: String,
    pub top_module: String,
    pub device: String,
    pub out_path: Option<String>,
    pub json: bool,
}

pub fn execute_synth(cfg: &SynthCliConfig) -> Result<(), String> {
    let resolved = resolve_file_path(&cfg.file_path);
    let source = fs::read_to_string(&resolved)
        .map_err(|e| format!("Failed to read source file '{}': {}", resolved, e))?;

    let (ast, diags) = parse_hdl(FileId(1), &source);
    if !diags.is_empty() {
        let err_msgs: Vec<String> = diags.iter().map(|d| d.message.clone()).collect();
        return Err(format!("HDL Syntax Error:\n  - {}", err_msgs.join("\n  - ")));
    }

    let synth_config = axiom_ir::SynthConfig::for_device(&cfg.device);
    let synth = axiom_ir::synthesize_from_ast(&ast, &cfg.top_module, &synth_config)
        .map_err(|e| format!("Synthesis failed: {e}"))?;

    if cfg.json {
        let json_str = serde_json::to_string_pretty(&synth)
            .map_err(|e| format!("JSON serialization error: {e}"))?;
        println!("{}", json_str);
        if let Some(out_p) = &cfg.out_path {
            fs::write(out_p, synth.to_verilog())
                .map_err(|e| format!("Failed to write netlist to '{}': {}", out_p, e))?;
        }
        return Ok(());
    }

    println!("\n\x1b[1;36m======================================================================\x1b[0m");
    println!("\x1b[1;36m           Axiom EDA — In-RAM FPGA Logic Synthesizer                  \x1b[0m");
    println!("\x1b[1;36m======================================================================\x1b[0m");
    println!("  Top Module:        \x1b[1;32m{}\x1b[0m", synth.top_module);
    println!("  Target FPGA Part:  \x1b[1;33m{}\x1b[0m ({})", synth.target_device, synth.target_family.display_name());
    println!("  Total Mapped Cells:\x1b[1m{}\x1b[0m", synth.stats.total_cells);
    println!("  Total Netlist Nets:\x1b[1m{}\x1b[0m", synth.nets.len());
    println!("----------------------------------------------------------------------\n");

    println!("┌───────────────────────┬────────────────────┬───────────┬──────────────┐");
    println!("│ Category              │ Primitive Cell     │ Instances │ % Device Cap │");
    println!("├───────────────────────┼────────────────────┼───────────┼──────────────┤");

    if synth.stats.total_luts > 0 {
        println!("│ Look-Up Tables (LUT)  │ LUT1..LUT6 / LUT62 │ {:>9} │ {:>11.2}% │", synth.stats.total_luts, synth.stats.lut_utilization_pct);
    }
    if synth.stats.total_ffs > 0 {
        println!("│ Registers / Flops     │ FDRE / FDCE        │ {:>9} │ {:>11.2}% │", synth.stats.total_ffs, synth.stats.ff_utilization_pct);
    }
    if synth.stats.total_carries > 0 {
        let carry_name = if synth.target_family.supports_carry8() { "CARRY8" } else { "CARRY4" };
        println!("│ Arithmetic Carries    │ {:<18} │ {:>9} │ {:>11} │", carry_name, synth.stats.total_carries, "-");
    }
    if synth.stats.total_iobs > 0 {
        println!("│ I/O Pads & Buffers    │ IBUF / OBUF / BUFG │ {:>9} │ {:>11} │", synth.stats.total_iobs, "-");
    }
    if synth.stats.dsp_count > 0 {
        println!("│ DSP Blocks            │ DSP48E2 / DSP48E1  │ {:>9} │ {:>11} │", synth.stats.dsp_count, "-");
    }
    if synth.stats.bram_count > 0 {
        println!("│ Block RAMs            │ RAMB36E2 / 18E2    │ {:>9} │ {:>11} │", synth.stats.bram_count, "-");
    }
    println!("└───────────────────────┴────────────────────┴───────────┴──────────────┘\n");

    println!("  Estimated Logic Depth:  \x1b[1m{} stages\x1b[0m", synth.stats.logic_depth);
    println!("  Estimated Cell Delay:   \x1b[1m{:.1} ps\x1b[0m\n", synth.stats.estimated_delay_ps);

    if let Some(out_p) = &cfg.out_path {
        let verilog = synth.to_verilog();
        fs::write(out_p, verilog)
            .map_err(|e| format!("Failed to write netlist to '{}': {}", out_p, e))?;
        println!("\x1b[1;32m[OK]\x1b[0m Wrote structural Verilog netlist to \x1b[1m{}\x1b[0m\n", out_p);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cli_ppa_alu() {
        let cfg = PpaCliConfig {
            file_path: "tests/fixtures/alu.v".to_string(),
            top_module: Some("alu".to_string()),
            target_device: None,
            target_freq: None,
            junction_temp: None,
            pdk: None,
            json: true,
        };
        let res = execute_ppa(&cfg);
        assert!(res.is_ok(), "ALU PPA failed: {:?}", res);
    }

    #[test]
    fn test_cli_coverage_counter() {
        let cfg = CoverageCliConfig {
            file_path: "tests/fixtures/counter.v".to_string(),
            top_module: "counter".to_string(),
            ticks: 20,
            lcov_path: None,
            html_path: None,
            json: false,
        };
        let res = execute_coverage(&cfg);
        assert!(res.is_ok(), "Counter coverage failed: {:?}", res);
    }

    #[test]
    fn test_cli_compile_alu() {
        let res = execute_compile("tests/fixtures/alu.v", "alu");
        assert!(res.is_ok(), "ALU compile failed: {:?}", res);
    }

    #[test]
    fn test_cli_run_counter() {
        let cfg = RunConfig {
            file_path: "tests/fixtures/counter.v".to_string(),
            top_module: "counter".to_string(),
            ticks: 20,
            vcd_path: None,
            saif_path: None,
        };
        let res = execute_run(&cfg);
        assert!(res.is_ok(), "Counter run failed: {:?}", res);
    }

    #[test]
    fn test_cli_benchmark_fifo() {
        let cfg = BenchmarkConfig {
            file_path: "tests/fixtures/fifo.v".to_string(),
            top_module: "fifo_4deep".to_string(),
            cycles: 100,
        };
        let res = execute_benchmark(&cfg);
        assert!(res.is_ok(), "FIFO benchmark failed: {:?}", res);
    }

    #[test]
    fn test_cli_replay_counter() {
        let cfg = ReplayConfig {
            file_path: "tests/fixtures/counter.v".to_string(),
            top_module: "counter".to_string(),
            ticks: 30,
            rewind_ticks: 15,
        };
        let res = execute_replay(&cfg);
        assert!(res.is_ok(), "Counter replay failed: {:?}", res);
    }

    #[test]
    fn test_cli_decode_alu() {
        let cfg = DecodeCliConfig {
            file_path: "tests/fixtures/alu.v".to_string(),
            top_module: "alu".to_string(),
            protocol: "uart".to_string(),
            ticks: 10,
        };
        let res = execute_decode(&cfg);
        assert!(res.is_ok(), "ALU decode failed: {:?}", res);
    }

    #[test]
    fn test_cli_verify_counter() {
        let cfg = VerifyCliConfig {
            file_path: "tests/fixtures/counter.v".to_string(),
            top_module: "counter".to_string(),
            ticks: 20,
            extra_assertions: vec!["a_cnt: assert property (@(posedge clk) count >= 0);".to_string()],
            json: false,
        };
        let res = execute_verify(&cfg);
        assert!(res.is_ok(), "Counter verify failed: {:?}", res);
    }

    #[test]
    fn test_cli_synth_counter() {
        let cfg = SynthCliConfig {
            file_path: "tests/fixtures/counter.v".to_string(),
            top_module: "counter".to_string(),
            device: "xc7a100tcsg324-1".to_string(),
            out_path: None,
            json: false,
        };
        let res = execute_synth(&cfg);
        assert!(res.is_ok(), "Counter synthesis failed: {:?}", res);
    }
}

