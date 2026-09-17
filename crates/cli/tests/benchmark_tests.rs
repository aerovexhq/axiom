use std::env;
use std::fs;
use std::path::Path;
use std::time::Instant;

use axiom_core::{FileId, LogicVector, SimTime};
use axiom_ir::elaborate;
use axiom_jit::JitEngine;
use axiom_sim::AxiomSimulator;
use axiom_syntax::parse_hdl;

fn resolve_fixture_path(name: &str) -> String {
    let direct = format!("tests/fixtures/{}", name);
    if Path::new(&direct).exists() {
        return direct;
    }
    let parent = format!("../../tests/fixtures/{}", name);
    if Path::new(&parent).exists() {
        return parent;
    }
    if let Ok(manifest_dir) = env::var("CARGO_MANIFEST_DIR") {
        let cand = Path::new(&manifest_dir).join("../../tests/fixtures").join(name);
        if cand.exists() {
            return cand.to_string_lossy().to_string();
        }
    }
    direct
}

#[test]
fn test_benchmark_in_ram_jit_compile_latency() {
    let path = resolve_fixture_path("alu.v");
    let src = fs::read_to_string(&path).expect("Failed to read alu.v");

    // Warmup
    let (ast_warmup, _) = parse_hdl(FileId(1), &src);
    let circuit_warmup = elaborate(&ast_warmup, "alu").unwrap();
    let _ = JitEngine::compile(circuit_warmup).unwrap();

    let iterations = 100;
    let t_start = Instant::now();

    for _ in 0..iterations {
        let (ast, diags) = parse_hdl(FileId(1), &src);
        assert!(diags.is_empty());
        let circuit = elaborate(&ast, "alu").unwrap();
        let _compiled = JitEngine::compile(circuit).unwrap();
    }

    let elapsed = t_start.elapsed();
    let avg_latency = elapsed / iterations;

    println!("\n=== In-RAM JIT Compile Latency Benchmark ===");
    println!(" Iterations: {}", iterations);
    println!(" Total Time: {:?}", elapsed);
    println!(" Average End-to-End JIT Latency: {:?}", avg_latency);

    // Assert sub-5ms compilation target
    assert!(
        avg_latency.as_millis() < 10,
        "JIT compilation took {:?}, exceeding 10ms threshold",
        avg_latency
    );
}

#[test]
fn test_benchmark_simulation_event_throughput() {
    let path = resolve_fixture_path("counter.v");
    let src = fs::read_to_string(&path).expect("Failed to read counter.v");

    let (ast, _) = parse_hdl(FileId(1), &src);
    let circuit = elaborate(&ast, "counter").unwrap();
    let mut sim = AxiomSimulator::new(circuit).unwrap();

    // Enable counter
    sim.force_signal_and_settle("rst_n", &LogicVector::from_u64(1, 1)).unwrap();
    sim.force_signal_and_settle("enable", &LogicVector::from_u64(1, 1)).unwrap();
    sim.force_signal_and_settle("up_down", &LogicVector::from_u64(1, 1)).unwrap();

    let cycles = 2000;
    let t_start = Instant::now();

    for i in 0..cycles {
        let clk_val = i % 2;
        sim.force_signal_and_settle("clk", &LogicVector::from_u64(clk_val, 1)).unwrap();
        let _ = sim.step_delta().unwrap();
        let _ = sim.tick(SimTime::from_picoseconds(500)).unwrap();
    }

    let elapsed = t_start.elapsed();
    let cycles_per_sec = (cycles as f64) / elapsed.as_secs_f64();
    let estimated_events = cycles * 6; // ~6 net transitions and process triggers per cycle
    let events_per_sec = (estimated_events as f64) / elapsed.as_secs_f64();

    println!("\n=== Simulation Throughput Benchmark ===");
    println!(" Simulated Clock Transitions: {}", cycles);
    println!(" Duration: {:?}", elapsed);
    println!(" Throughput: {:.2} cycles/sec ({:.2} kHz simulated)", cycles_per_sec, cycles_per_sec / 1e3);
    println!(" Event Rate: {:.2} events/sec", events_per_sec);

    assert!(cycles_per_sec > 1000.0, "Throughput below 1 kHz");
}
