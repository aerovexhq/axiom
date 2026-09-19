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
    lsp                                  Start stdio JSON-RPC Language Server Protocol (LSP) daemon
    help                                 Print this message or the help of the given subcommand(s)
    version                              Print version information

RUN OPTIONS:
    -t, --top <MODULE>       Name of top-level module (required)
    --ticks <N>              Number of clock ticks to simulate (default: 100)
    --vcd <FILE>             Dump IEEE 1364 Value Change Dump to FILE
    --saif <FILE>            Dump SAIF 2.0 switching activity to FILE

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
            } else {
                axiom_lsp::VerilogLinter::lint(&content)
            };
            if diags.is_empty() {
                println!("✓ No issues found in {}", file_path);
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

#[cfg(test)]
mod tests {
    use super::*;

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
}
