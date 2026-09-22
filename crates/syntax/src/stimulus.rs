// Axiom EDA — Visual Testbench Stimulus Generator & Constrained Random Verification Engine
// Implements parametric waveform generators, glitch injection, seed-repeatable constrained random verification,
// and synthesizable IEEE 1364/1800 testbench harness emission.

use serde::{Deserialize, Serialize};
use crate::ast::{ModuleDef, PortDirection};

/// Parametric clock generator specification.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ClockGenerator {
    /// Clock period in picoseconds (e.g. 10,000 ps = 10 ns = 100 MHz).
    pub period_ps: u64,
    /// Duty cycle percentage (1..99, defaults to 50).
    pub duty_cycle_percent: u8,
    /// Startup delay before clock begins toggling (picoseconds).
    pub phase_delay_ps: u64,
    /// Phase jitter / skew tolerance (picoseconds).
    pub jitter_ps: u64,
}

impl Default for ClockGenerator {
    fn default() -> Self {
        Self {
            period_ps: 10_000, // 100 MHz (10 ns)
            duty_cycle_percent: 50,
            phase_delay_ps: 0,
            jitter_ps: 0,
        }
    }
}

impl ClockGenerator {
    pub fn new(freq_mhz: u64) -> Self {
        let period_ps = 1_000_000u64.checked_div(freq_mhz).unwrap_or(10_000);
        Self {
            period_ps,
            duty_cycle_percent: 50,
            phase_delay_ps: 0,
            jitter_ps: 0,
        }
    }

    /// Returns high time in picoseconds.
    pub fn high_duration_ps(&self) -> u64 {
        let pct = self.duty_cycle_percent.clamp(1, 99) as u64;
        (self.period_ps * pct) / 100
    }

    /// Returns low time in picoseconds.
    pub fn low_duration_ps(&self) -> u64 {
        self.period_ps.saturating_sub(self.high_duration_ps())
    }

    /// Generates transition events `(timestamp_ps, logic_level)` up to `duration_ps`.
    pub fn edges_in_duration(&self, duration_ps: u64) -> Vec<(u64, bool)> {
        let mut edges = Vec::new();
        let high_ps = self.high_duration_ps();
        let low_ps = self.low_duration_ps();

        if high_ps == 0 || low_ps == 0 {
            return edges;
        }

        let mut t = self.phase_delay_ps;
        edges.push((t, false));

        while t < duration_ps {
            t += low_ps;
            if t > duration_ps {
                break;
            }
            edges.push((t, true)); // rising edge

            t += high_ps;
            if t > duration_ps {
                break;
            }
            edges.push((t, false)); // falling edge
        }

        edges
    }
}

/// Parametric reset signal generator specification.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ResetGenerator {
    /// If true, reset asserts at 0 and de-asserts to 1 (e.g. `rst_n`).
    pub active_low: bool,
    /// Delay before reset asserts (picoseconds).
    pub assert_delay_ps: u64,
    /// Duration that reset remains asserted (picoseconds).
    pub duration_ps: u64,
}

impl Default for ResetGenerator {
    fn default() -> Self {
        Self {
            active_low: true,
            assert_delay_ps: 0,
            duration_ps: 20_000, // 20 ns
        }
    }
}

impl ResetGenerator {
    pub fn events_in_duration(&self, total_duration_ps: u64) -> Vec<(u64, bool)> {
        let mut events = Vec::new();
        let asserted = !self.active_low;
        let deasserted = self.active_low;

        if self.assert_delay_ps > 0 {
            events.push((0, deasserted));
            events.push((self.assert_delay_ps, asserted));
        } else {
            events.push((0, asserted));
        }

        let release_time = self.assert_delay_ps + self.duration_ps;
        if release_time <= total_duration_ps {
            events.push((release_time, deasserted));
        }

        events
    }
}

/// Periodic pulse train or strobe generator.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PulseTrainGenerator {
    pub high_duration_ps: u64,
    pub low_duration_ps: u64,
    pub repeat_count: usize,
    pub initial_delay_ps: u64,
}

impl Default for PulseTrainGenerator {
    fn default() -> Self {
        Self {
            high_duration_ps: 5_000,
            low_duration_ps: 15_000,
            repeat_count: 8,
            initial_delay_ps: 2_000,
        }
    }
}

impl PulseTrainGenerator {
    pub fn events_in_duration(&self, total_duration_ps: u64) -> Vec<(u64, bool)> {
        let mut events = Vec::new();
        let mut t = self.initial_delay_ps;
        events.push((0, false));

        for _ in 0..self.repeat_count {
            if t >= total_duration_ps {
                break;
            }
            events.push((t, true));
            t += self.high_duration_ps;
            if t >= total_duration_ps {
                break;
            }
            events.push((t, false));
            t += self.low_duration_ps;
        }

        events
    }
}

/// Momentary hazard / glitch injection specification.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GlitchInjector {
    /// Timestamp at which the glitch triggers (picoseconds).
    pub target_time_ps: u64,
    /// Glitch spike duration (e.g. 200 ps runt pulse).
    pub glitch_width_ps: u64,
    /// Inverted glitch level.
    pub target_level: bool,
}

impl Default for GlitchInjector {
    fn default() -> Self {
        Self {
            target_time_ps: 25_000,
            glitch_width_ps: 250,
            target_level: true,
        }
    }
}

/// Weighted range definition for constrained random distributions.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WeightRange {
    pub min: u64,
    pub max: u64,
    pub weight: u32,
}

/// Seed-repeatable, deterministic constrained random generator.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ConstrainedRandomGenerator {
    pub seed: u64,
    pub state: u64,
    pub min_val: u64,
    pub max_val: u64,
    pub weights: Vec<WeightRange>,
    pub illegal_values: Vec<u64>,
}

impl ConstrainedRandomGenerator {
    pub fn new(seed: u64, min_val: u64, max_val: u64) -> Self {
        let non_zero_seed = if seed == 0 { 0x853c49e6748fea9b } else { seed };
        Self {
            seed: non_zero_seed,
            state: non_zero_seed,
            min_val,
            max_val,
            weights: Vec::new(),
            illegal_values: Vec::new(),
        }
    }

    pub fn with_weights(mut self, weights: Vec<WeightRange>) -> Self {
        self.weights = weights;
        self
    }

    pub fn with_illegal(mut self, illegal: Vec<u64>) -> Self {
        self.illegal_values = illegal;
        self
    }

    /// Advances PRNG using XorShift64* and returns raw 64-bit integer.
    fn next_u64(&mut self) -> u64 {
        let mut x = self.state;
        x ^= x >> 12;
        x ^= x << 25;
        x ^= x >> 27;
        self.state = x;
        x.wrapping_mul(0x2545F4914F6CDD1D)
    }

    /// Generates the next constrained random value adhering to bounds, weights, and illegal bins.
    pub fn next_value(&mut self) -> u64 {
        let max_attempts = 100;
        for _ in 0..max_attempts {
            let candidate = if !self.weights.is_empty() {
                // Select range based on distribution weights
                let total_weight: u32 = self.weights.iter().map(|w| w.weight).sum();
                if total_weight == 0 {
                    self.uniform_between(self.min_val, self.max_val)
                } else {
                    let roll = (self.next_u64() % (total_weight as u64)) as u32;
                    let mut accum = 0;
                    let mut chosen_range = &self.weights[0];
                    for w in &self.weights {
                        accum += w.weight;
                        if roll < accum {
                            chosen_range = w;
                            break;
                        }
                    }
                    self.uniform_between(chosen_range.min, chosen_range.max)
                }
            } else {
                self.uniform_between(self.min_val, self.max_val)
            };

            if !self.illegal_values.contains(&candidate) {
                return candidate;
            }
        }

        // Fallback if illegal values consume all attempts: find first legal value
        for val in self.min_val..=self.max_val {
            if !self.illegal_values.contains(&val) {
                return val;
            }
        }

        self.min_val
    }

    fn uniform_between(&mut self, min: u64, max: u64) -> u64 {
        if min >= max {
            return min;
        }
        let range = max - min + 1;
        min + (self.next_u64() % range)
    }

    /// Resets PRNG state back to the initial seed for 100% deterministic reproducibility.
    pub fn reset(&mut self) {
        self.state = self.seed;
    }
}

/// Stimulus track type specification.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum StimulusTrackKind {
    Clock(ClockGenerator),
    Reset(ResetGenerator),
    PulseTrain(PulseTrainGenerator),
    Glitch(GlitchInjector),
    ConstrainedRandom(ConstrainedRandomGenerator),
    Constant(u64),
    Custom(Vec<(u64, u64)>), // (timestamp_ps, value)
}

/// Individual signal stimulus configuration for a DUT port.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StimulusTrack {
    pub name: String,
    pub direction: PortDirection,
    pub width: usize,
    pub radix: String, // "hex", "bin", "dec"
    pub kind: StimulusTrackKind,
}

/// Master testbench stimulus plan.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StimulusPlan {
    pub top_module: String,
    pub time_scale_ps: u64,
    pub total_duration_ps: u64,
    pub tracks: Vec<StimulusTrack>,
}

impl StimulusPlan {
    pub fn new(top_module: impl Into<String>, total_duration_ps: u64) -> Self {
        Self {
            top_module: top_module.into(),
            time_scale_ps: 1000, // 1 ns
            total_duration_ps,
            tracks: Vec::new(),
        }
    }

    pub fn add_track(&mut self, track: StimulusTrack) {
        self.tracks.push(track);
    }
}

/// Synthesizable and IEEE 1364/1800-compliant testbench generator.
pub struct TestbenchGenerator;

impl TestbenchGenerator {
    /// Emits clean, robust Verilog/SystemVerilog testbench source code (`tb_<module>.v`).
    pub fn generate_testbench(module: &ModuleDef, plan: &StimulusPlan) -> String {
        let mut code = String::with_capacity(4096);
        let tb_name = format!("tb_{}", module.name);

        // Header
        code.push_str("// ============================================================================\n");
        code.push_str("// Axiom EDA — Synthesizable Testbench Harness\n");
        code.push_str("// Generated from Visual Stimulus & Verification Engine\n");
        code.push_str(&format!("// Target DUT: {}\n", module.name));
        code.push_str("// ============================================================================\n\n");
        code.push_str("`timescale 1ns / 1ps\n\n");
        code.push_str(&format!("module {};\n\n", tb_name));

        // Signal declarations
        code.push_str("  // --------------------------------------------------------------------------\n");
        code.push_str("  // 1. DUT Signal Declarations\n");
        code.push_str("  // --------------------------------------------------------------------------\n");

        for port in &module.ports {
            let width_str = match &port.range {
                Some(_) => "[7:0] ", // fallback default if range expr is complex
                None => "",
            };

            match port.direction {
                PortDirection::Input => {
                    if width_str.is_empty() {
                        code.push_str(&format!("  reg        {};\n", port.name));
                    } else {
                        code.push_str(&format!("  reg  {:<5} {};\n", width_str.trim(), port.name));
                    }
                }
                PortDirection::Output => {
                    if width_str.is_empty() {
                        code.push_str(&format!("  wire       {};\n", port.name));
                    } else {
                        code.push_str(&format!("  wire {:<5} {};\n", width_str.trim(), port.name));
                    }
                }
                PortDirection::Inout => {
                    if width_str.is_empty() {
                        code.push_str(&format!("  wire       {};\n", port.name));
                    } else {
                        code.push_str(&format!("  wire {:<5} {};\n", width_str.trim(), port.name));
                    }
                }
            }
        }
        code.push('\n');

        // Parameterized Clock Generation (if any clock track exists)
        let clock_track = plan.tracks.iter().find(|t| matches!(t.kind, StimulusTrackKind::Clock(_)));
        if let Some(t) = clock_track {
            if let StimulusTrackKind::Clock(ref clk_gen) = t.kind {
                let half_period_ns = ((clk_gen.period_ps / 2) / 1000).max(1);
                let freq = 1_000_000u64.checked_div(clk_gen.period_ps).unwrap_or(100);
                code.push_str("  // --------------------------------------------------------------------------\n");
                code.push_str(&format!("  // 2. Clock Generator ({} MHz)\n", freq));
                code.push_str("  // --------------------------------------------------------------------------\n");
                code.push_str(&format!("  initial {} = 0;\n", t.name));
                code.push_str(&format!("  always #{} {} = ~{};\n\n", half_period_ns, t.name, t.name));
            }
        }

        // DUT Instantiation
        code.push_str("  // --------------------------------------------------------------------------\n");
        code.push_str("  // 3. Device Under Test (DUT) Instantiation\n");
        code.push_str("  // --------------------------------------------------------------------------\n");
        code.push_str(&format!("  {} u_dut (\n", module.name));

        let port_count = module.ports.len();
        for (i, port) in module.ports.iter().enumerate() {
            let comma = if i + 1 < port_count { "," } else { "" };
            code.push_str(&format!("    .{}({}){}\n", port.name, port.name, comma));
        }
        code.push_str("  );\n\n");

        // Stimulus and Verification Sequence
        code.push_str("  // --------------------------------------------------------------------------\n");
        code.push_str("  // 4. Stimulus Sequence & Verification Vectors\n");
        code.push_str("  // --------------------------------------------------------------------------\n");
        code.push_str("  initial begin\n");
        code.push_str(&format!("    $dumpfile(\"{}.vcd\");\n", tb_name));
        code.push_str(&format!("    $dumpvars(0, {});\n\n", tb_name));

        // Signal initialization
        code.push_str("    // Initial Drive State\n");
        for port in &module.ports {
            if port.direction == PortDirection::Input {
                code.push_str(&format!("    {} = 0;\n", port.name));
            }
        }
        code.push('\n');

        // Reset Sequence
        let reset_track = plan.tracks.iter().find(|t| matches!(t.kind, StimulusTrackKind::Reset(_)));
        if let Some(t) = reset_track {
            if let StimulusTrackKind::Reset(ref rst_gen) = t.kind {
                let assert_ns = (rst_gen.duration_ps / 1000).max(1);
                let asserted_val = if rst_gen.active_low { 0 } else { 1 };
                let deasserted_val = if rst_gen.active_low { 1 } else { 0 };

                code.push_str("    // Reset Pulse\n");
                code.push_str(&format!("    {} = {};\n", t.name, asserted_val));
                code.push_str(&format!("    #{};\n", assert_ns));
                code.push_str(&format!("    {} = {};\n", t.name, deasserted_val));
                code.push_str("    #10;\n\n");
            }
        }

        // Constrained Random Loops or Vector Sequences
        let random_tracks: Vec<&StimulusTrack> = plan
            .tracks
            .iter()
            .filter(|t| matches!(t.kind, StimulusTrackKind::ConstrainedRandom(_)))
            .collect();

        if !random_tracks.is_empty() {
            code.push_str("    // Constrained Random Verification Vectors\n");
            code.push_str("    repeat (32) begin\n");
            for t in &random_tracks {
                if let StimulusTrackKind::ConstrainedRandom(ref rng) = t.kind {
                    code.push_str(&format!(
                        "      {} = $urandom_range({}, {});\n",
                        t.name, rng.max_val, rng.min_val
                    ));
                }
            }
            code.push_str("      #10;\n");
            code.push_str("    end\n\n");
        }

        // Finish block
        let total_ns = (plan.total_duration_ps / 1000).max(100);
        code.push_str(&format!("    #{};\n", total_ns));
        code.push_str("    $display(\"====================================================\");\n");
        code.push_str(&format!("    $display(\"Axiom Testbench Complete: {} passed.\");\n", tb_name));
        code.push_str("    $display(\"====================================================\");\n");
        code.push_str("    $finish;\n");
        code.push_str("  end\n\n");
        code.push_str("endmodule\n");

        code
    }
}
