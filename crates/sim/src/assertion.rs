use axiom_core::{Logic4, LogicVector, SimTime};
use axiom_ir::{BirCircuit, NetId};
use hashbrown::HashMap;
use serde::{Deserialize, Serialize};

/// Classification of assertion statements.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AssertionKind {
    Assert,
    Assume,
    Cover,
}

/// Active clock transition edge for property evaluation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ClockEdge {
    Posedge,
    Negedge,
}

/// Comparison operators supported in temporal expressions.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CompareOp {
    Eq,
    Ne,
    Lt,
    Le,
    Gt,
    Ge,
}

/// Binary logic operators in temporal expressions.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum BinaryOp {
    And,
    Or,
    Xor,
}

/// Unary logic operators in temporal expressions.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum UnaryOp {
    Not,
}

/// AST of a temporal boolean expression.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum TemporalExpr {
    Signal(String),
    Literal(LogicVector),
    Compare {
        lhs: Box<TemporalExpr>,
        op: CompareOp,
        rhs: Box<TemporalExpr>,
    },
    Binary {
        lhs: Box<TemporalExpr>,
        op: BinaryOp,
        rhs: Box<TemporalExpr>,
    },
    Unary {
        op: UnaryOp,
        operand: Box<TemporalExpr>,
    },
    Rose(String),
    Fell(String),
    Past(String, usize),
    IsUnknown(String),
}

/// Sequence expression including cycle delays and repetitions.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum SequenceExpr {
    Expr(TemporalExpr),
    ConsecutiveRepeat {
        expr: Box<TemporalExpr>,
        count: usize,
    },
    CycleDelay {
        min_delay: u32,
        max_delay: u32,
        target: Box<SequenceExpr>,
    },
}

/// Property expression with optional temporal implication.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum PropertyExpr {
    Simple(SequenceExpr),
    Implication {
        antecedent: SequenceExpr,
        overlapping: bool, // true: |-> , false: |=> (equivalent to |-> ##1)
        delay_min: u32,
        delay_max: u32,
        consequent: SequenceExpr,
    },
}

/// Complete definition of an assertion property.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssertionDef {
    pub id: String,
    pub name: String,
    pub kind: AssertionKind,
    pub clock: String,
    pub edge: ClockEdge,
    pub property: PropertyExpr,
    pub source_text: String,
    pub line: Option<u32>,
    pub col: Option<u32>,
}

/// Active in-flight verification attempt tracking temporal progression.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssertionThread {
    pub id: u64,
    pub start_time: SimTime,
    pub start_cycle: u64,
    pub cycles_elapsed: u32,
    pub delay_min: u32,
    pub delay_max: u32,
    pub consequent: SequenceExpr,
    pub consecutive_matched: usize,
}

/// Record of an assertion violation / protocol breach.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssertionViolation {
    pub attempt_id: u64,
    pub assertion_id: String,
    pub assertion_name: String,
    pub source_text: String,
    pub line: Option<u32>,
    pub fail_time: SimTime,
    pub start_time: SimTime,
    pub fail_cycle: u64,
    pub start_cycle: u64,
    pub message: String,
    pub signals: HashMap<String, String>,
}

/// Live verification statistics for an assertion.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssertionStats {
    pub attempts: u64,
    pub matches: u64,
    pub passes: u64,
    pub failures: u64,
    pub vacuous: u64,
    pub in_flight: usize,
}

/// Summary report for a single assertion.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssertionSummary {
    pub def: AssertionDef,
    pub stats: AssertionStats,
    pub violations: Vec<AssertionViolation>,
    pub status: AssertionStatus,
}

/// Status of an assertion in the radar.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AssertionStatus {
    Passing,
    Violated,
    InFlight,
    Vacuous,
    Inactive,
}

/// Comprehensive report for all assertions in the design.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AssertionReport {
    pub assertions: Vec<AssertionSummary>,
    pub total_assertions: usize,
    pub total_passes: u64,
    pub total_failures: u64,
    pub total_vacuous: u64,
    pub active_in_flight: usize,
    pub overall_pass_rate_pct: f64,
    pub recent_violations: Vec<AssertionViolation>,
}

/// History of sampled signal values at clock edges for temporal evaluation.
#[derive(Debug, Clone, Default)]
pub struct SignalHistory {
    /// Signal name -> ring buffer of historical values sampled at clock edges (most recent at end)
    samples: HashMap<String, Vec<LogicVector>>,
    /// Depth of history to preserve
    max_depth: usize,
}

impl SignalHistory {
    pub fn new(max_depth: usize) -> Self {
        Self {
            samples: HashMap::new(),
            max_depth: max_depth.max(16),
        }
    }

    pub fn record_sample(&mut self, signal: &str, val: LogicVector) {
        let history = self.samples.entry(signal.to_string()).or_default();
        history.push(val);
        if history.len() > self.max_depth {
            history.remove(0);
        }
    }

    pub fn current(&self, signal: &str) -> Option<&LogicVector> {
        self.samples.get(signal).and_then(|h| h.last())
    }

    pub fn past(&self, signal: &str, cycles_ago: usize) -> Option<&LogicVector> {
        let h = self.samples.get(signal)?;
        if h.len() > cycles_ago {
            Some(&h[h.len() - 1 - cycles_ago])
        } else {
            None
        }
    }

    pub fn rose(&self, signal: &str) -> bool {
        let h = match self.samples.get(signal) {
            Some(h) if h.len() >= 2 => h,
            _ => return false,
        };
        let prev = &h[h.len() - 2];
        let curr = &h[h.len() - 1];
        prev.get_bit(0) == Logic4::Zero && curr.get_bit(0) == Logic4::One
    }

    pub fn fell(&self, signal: &str) -> bool {
        let h = match self.samples.get(signal) {
            Some(h) if h.len() >= 2 => h,
            _ => return false,
        };
        let prev = &h[h.len() - 2];
        let curr = &h[h.len() - 1];
        prev.get_bit(0) == Logic4::One && curr.get_bit(0) == Logic4::Zero
    }

    pub fn is_unknown(&self, signal: &str) -> bool {
        match self.current(signal) {
            Some(val) => {
                for i in 0..val.width() {
                    let b = val.get_bit(i);
                    if b == Logic4::X || b == Logic4::Z {
                        return true;
                    }
                }
                false
            }
            None => true,
        }
    }
}

/// SVA Expression & Property Parser
pub struct SvaParser<'a> {
    chars: &'a str,
    cursor: usize,
}

impl<'a> SvaParser<'a> {
    pub fn new(input: &'a str) -> Self {
        Self {
            chars: input,
            cursor: 0,
        }
    }

    fn peek(&self) -> Option<char> {
        self.chars[self.cursor..].chars().next()
    }

    fn advance(&mut self) -> Option<char> {
        let c = self.peek()?;
        self.cursor += c.len_utf8();
        Some(c)
    }

    fn skip_whitespace(&mut self) {
        while let Some(c) = self.peek() {
            if c.is_whitespace() {
                self.advance();
            } else if c == '/' && self.chars[self.cursor..].starts_with("//") {
                while let Some(ch) = self.advance() {
                    if ch == '\n' {
                        break;
                    }
                }
            } else {
                break;
            }
        }
    }

    fn match_str(&mut self, s: &str) -> bool {
        self.skip_whitespace();
        if self.chars[self.cursor..].starts_with(s) {
            self.cursor += s.len();
            true
        } else {
            false
        }
    }

    fn parse_ident_or_keyword(&mut self) -> Option<String> {
        self.skip_whitespace();
        let start = self.cursor;

        if let Some('$') = self.peek() {
            self.advance();
        }

        while let Some(c) = self.peek() {
            if c.is_alphanumeric() || c == '_' {
                self.advance();
            } else {
                break;
            }
        }

        if self.cursor > start {
            let res = self.chars[start..self.cursor].to_string();
            Some(res)
        } else {
            None
        }
    }

    fn parse_number(&mut self) -> Option<LogicVector> {
        self.skip_whitespace();
        let start = self.cursor;
        while let Some(c) = self.peek() {
            if c.is_alphanumeric() || c == '\'' || c == '_' {
                self.advance();
            } else {
                break;
            }
        }
        if self.cursor > start {
            let s = &self.chars[start..self.cursor];
            if let Some((_, hex)) = s.split_once("'h").or_else(|| s.split_once("'H")) {
                let clean = hex.replace('_', "");
                LogicVector::from_hex_str(&clean, None).ok()
            } else if let Some((_, bin)) = s.split_once("'b").or_else(|| s.split_once("'B")) {
                let clean = bin.replace('_', "");
                LogicVector::from_bin_str(&clean).ok()
            } else if let Some((width_str, dec)) = s.split_once("'d").or_else(|| s.split_once("'D")) {
                let clean = dec.replace('_', "");
                let width = width_str.parse::<u32>().unwrap_or(32);
                let val = clean.parse::<u64>().ok()?;
                Some(LogicVector::from_u64(val, width))
            } else if let Ok(val) = s.parse::<u64>() {
                Some(LogicVector::from_u64(val, 32))
            } else {
                None
            }
        } else {
            None
        }
    }

    pub fn parse_assertion(&mut self, default_id: &str) -> Option<AssertionDef> {
        self.skip_whitespace();
        let mut label: Option<String> = None;

        // Check for optional label prefix: check_ack : assert ...
        let backup = self.cursor;
        if let Some(id) = self.parse_ident_or_keyword() {
            if self.match_str(":") {
                label = Some(id);
            } else {
                self.cursor = backup;
            }
        }

        // Match keyword: assert / assume / cover
        let kind = if self.match_str("assert") {
            AssertionKind::Assert
        } else if self.match_str("assume") {
            AssertionKind::Assume
        } else if self.match_str("cover") {
            AssertionKind::Cover
        } else {
            // Check if this is a raw property expression (e.g. from AST asrt.expr_text)
            let backup_prop = self.cursor;
            if let Some(property) = self.parse_property_expr() {
                let asrt_id = label.clone().unwrap_or_else(|| default_id.to_string());
                let name = label.unwrap_or_else(|| default_id.to_string());
                return Some(AssertionDef {
                    id: asrt_id,
                    name,
                    kind: AssertionKind::Assert,
                    clock: "clk".to_string(),
                    edge: ClockEdge::Posedge,
                    property,
                    source_text: self.chars.trim().to_string(),
                    line: None,
                    col: None,
                });
            }
            self.cursor = backup_prop;
            return None;
        };

        // Optional 'property' keyword
        let _ = self.match_str("property");

        if !self.match_str("(") {
            return None;
        }

        // Optional clock event: @(posedge clk) or @(negedge clk)
        let mut clock_name = "clk".to_string();
        let mut edge = ClockEdge::Posedge;
        if self.match_str("@") && self.match_str("(") {
            if self.match_str("posedge") {
                edge = ClockEdge::Posedge;
            } else if self.match_str("negedge") {
                edge = ClockEdge::Negedge;
            }
            if let Some(sig) = self.parse_ident_or_keyword() {
                clock_name = sig;
            }
            let _ = self.match_str(")");
        }

        // Parse property expression
        let property = self.parse_property_expr()?;

        // Close assertion property ')'
        let _ = self.match_str(")");

        // Optional action block: else $error("...");
        if self.match_str("else") {
            while let Some(c) = self.peek() {
                if c == ';' {
                    break;
                }
                self.advance();
            }
        }

        let _ = self.match_str(";");

        let asrt_id = label.clone().unwrap_or_else(|| default_id.to_string());
        let name = label.unwrap_or_else(|| default_id.to_string());
        Some(AssertionDef {
            id: asrt_id,
            name,
            kind,
            clock: clock_name,
            edge,
            property,
            source_text: self.chars.trim().to_string(),
            line: None,
            col: None,
        })
    }

    fn parse_property_expr(&mut self) -> Option<PropertyExpr> {
        let antecedent = self.parse_sequence_expr()?;

        self.skip_whitespace();
        let overlapping = if self.match_str("|->") {
            true
        } else if self.match_str("|=>") {
            false
        } else {
            // Simple property without implication
            return Some(PropertyExpr::Simple(antecedent));
        };

        // Check for delay range or delay on consequent: ##[min:max] or ##N
        let (delay_min, mut delay_max) = self.parse_delay_bounds(overlapping);
        let consequent = self.parse_sequence_expr()?;

        if let SequenceExpr::ConsecutiveRepeat { count, .. } = &consequent {
            delay_max += (count.saturating_sub(1)) as u32;
        }

        Some(PropertyExpr::Implication {
            antecedent,
            overlapping,
            delay_min,
            delay_max,
            consequent,
        })
    }

    fn parse_delay_bounds(&mut self, overlapping: bool) -> (u32, u32) {
        let (default_min, default_max) = if overlapping { (0, 0) } else { (1, 1) };

        if self.match_str("##") {
            if self.match_str("[") {
                let min_str = self.parse_ident_or_keyword().unwrap_or_default();
                let min = min_str.parse::<u32>().unwrap_or(default_min);
                let _ = self.match_str(":");
                let max_str = self.parse_ident_or_keyword().unwrap_or_default();
                let max = max_str.parse::<u32>().unwrap_or(min.max(default_max));
                let _ = self.match_str("]");
                (min, max)
            } else if let Some(n_str) = self.parse_ident_or_keyword() {
                let n = n_str.parse::<u32>().unwrap_or(1);
                (n, n)
            } else {
                (default_min, default_max)
            }
        } else {
            (default_min, default_max)
        }
    }

    fn parse_sequence_expr(&mut self) -> Option<SequenceExpr> {
        let expr = self.parse_temporal_expr()?;

        self.skip_whitespace();
        // Check for consecutive repetition: expr [*N]
        if self.match_str("[*") {
            let n_str = self.parse_ident_or_keyword().unwrap_or_default();
            let count = n_str.parse::<usize>().unwrap_or(1);
            let _ = self.match_str("]");
            Some(SequenceExpr::ConsecutiveRepeat {
                expr: Box::new(expr),
                count,
            })
        } else {
            Some(SequenceExpr::Expr(expr))
        }
    }

    fn parse_temporal_expr(&mut self) -> Option<TemporalExpr> {
        self.parse_logical_or()
    }

    fn parse_logical_or(&mut self) -> Option<TemporalExpr> {
        let mut left = self.parse_logical_and()?;
        while self.match_str("||") {
            let right = self.parse_logical_and()?;
            left = TemporalExpr::Binary {
                lhs: Box::new(left),
                op: BinaryOp::Or,
                rhs: Box::new(right),
            };
        }
        Some(left)
    }

    fn parse_logical_and(&mut self) -> Option<TemporalExpr> {
        let mut left = self.parse_comparison()?;
        while self.match_str("&&") {
            let right = self.parse_comparison()?;
            left = TemporalExpr::Binary {
                lhs: Box::new(left),
                op: BinaryOp::And,
                rhs: Box::new(right),
            };
        }
        Some(left)
    }

    fn parse_comparison(&mut self) -> Option<TemporalExpr> {
        let left = self.parse_unary()?;
        self.skip_whitespace();

        let op = if self.match_str("==") {
            Some(CompareOp::Eq)
        } else if self.match_str("!=") {
            Some(CompareOp::Ne)
        } else if self.match_str("<=") {
            Some(CompareOp::Le)
        } else if self.match_str(">=") {
            Some(CompareOp::Ge)
        } else if self.match_str("<") {
            Some(CompareOp::Lt)
        } else if self.match_str(">") {
            Some(CompareOp::Gt)
        } else {
            None
        };

        if let Some(op) = op {
            let right = self.parse_unary()?;
            Some(TemporalExpr::Compare {
                lhs: Box::new(left),
                op,
                rhs: Box::new(right),
            })
        } else {
            Some(left)
        }
    }

    fn parse_unary(&mut self) -> Option<TemporalExpr> {
        self.skip_whitespace();
        if self.match_str("!") || self.match_str("~") {
            let inner = self.parse_unary()?;
            Some(TemporalExpr::Unary {
                op: UnaryOp::Not,
                operand: Box::new(inner),
            })
        } else {
            self.parse_primary()
        }
    }

    fn parse_primary(&mut self) -> Option<TemporalExpr> {
        self.skip_whitespace();
        if self.match_str("(") {
            let inner = self.parse_temporal_expr()?;
            let _ = self.match_str(")");
            return Some(inner);
        }

        // Check for temporal sample functions: $rose, $fell, $past, $isunknown
        if self.match_str("$rose") {
            let _ = self.match_str("(");
            let sig = self.parse_ident_or_keyword()?;
            let _ = self.match_str(")");
            return Some(TemporalExpr::Rose(sig));
        }
        if self.match_str("$fell") {
            let _ = self.match_str("(");
            let sig = self.parse_ident_or_keyword()?;
            let _ = self.match_str(")");
            return Some(TemporalExpr::Fell(sig));
        }
        if self.match_str("$isunknown") {
            let _ = self.match_str("(");
            let sig = self.parse_ident_or_keyword()?;
            let _ = self.match_str(")");
            return Some(TemporalExpr::IsUnknown(sig));
        }
        if self.match_str("$past") {
            let _ = self.match_str("(");
            let sig = self.parse_ident_or_keyword()?;
            let mut cycles = 1;
            if self.match_str(",") {
                if let Some(c_str) = self.parse_ident_or_keyword() {
                    cycles = c_str.parse::<usize>().unwrap_or(1);
                }
            }
            let _ = self.match_str(")");
            return Some(TemporalExpr::Past(sig, cycles));
        }

        // Literal number
        if let Some(c) = self.peek() {
            if c.is_ascii_digit() || c == '\'' {
                if let Some(num) = self.parse_number() {
                    return Some(TemporalExpr::Literal(num));
                }
            }
        }

        // Identifier
        self.parse_ident_or_keyword().map(TemporalExpr::Signal)
    }
}

/// Runtime evaluator and multi-threaded attempt tracker for temporal assertions.
#[derive(Debug, Clone)]
pub struct AssertionEvaluator {
    pub assertions: Vec<AssertionDef>,
    pub stats: HashMap<String, AssertionStats>,
    pub active_threads: HashMap<String, Vec<AssertionThread>>,
    pub violations: Vec<AssertionViolation>,
    pub clock_cycles: HashMap<String, u64>,
    pub history: SignalHistory,
    next_thread_id: u64,
}

impl Default for AssertionEvaluator {
    fn default() -> Self {
        Self::new()
    }
}

impl AssertionEvaluator {
    pub fn new() -> Self {
        Self {
            assertions: Vec::new(),
            stats: HashMap::new(),
            active_threads: HashMap::new(),
            violations: Vec::new(),
            clock_cycles: HashMap::new(),
            history: SignalHistory::new(16),
            next_thread_id: 1,
        }
    }

    /// Registers an assertion definition.
    pub fn add_assertion(&mut self, def: AssertionDef) {
        if !self.assertions.iter().any(|a| a.id == def.id) {
            self.stats.insert(def.id.clone(), AssertionStats::default());
            self.active_threads.insert(def.id.clone(), Vec::new());
            self.assertions.push(def);
        }
    }

    /// Parses and registers an assertion string.
    pub fn add_assertion_str(&mut self, text: &str) -> Result<String, String> {
        let id = format!("asrt_{}", self.assertions.len());
        let mut parser = SvaParser::new(text);
        if let Some(def) = parser.parse_assertion(&id) {
            let def_id = def.id.clone();
            self.add_assertion(def);
            Ok(def_id)
        } else {
            Err(format!("Failed to parse SVA assertion: '{text}'"))
        }
    }

    /// Clears all recorded attempts, threads, and violations.
    pub fn reset(&mut self) {
        self.active_threads.clear();
        for a in &self.assertions {
            self.active_threads.insert(a.id.clone(), Vec::new());
            self.stats.insert(a.id.clone(), AssertionStats::default());
        }
        self.violations.clear();
        self.clock_cycles.clear();
        self.history = SignalHistory::new(16);
    }

    /// Called on each clock edge transition during simulation.
    pub fn step_clock(
        &mut self,
        clock_net: &str,
        is_posedge: bool,
        sim_time: SimTime,
        circuit: &BirCircuit,
        net_values: &HashMap<NetId, LogicVector>,
    ) {
        // Find leaf name of clock
        let clk_leaf = clock_net.rsplit('.').next().unwrap_or(clock_net);

        // Check if any assertion monitors this clock edge
        let matching_assertions: Vec<AssertionDef> = self
            .assertions
            .iter()
            .filter(|a| {
                let matches_name = a.clock == clock_net || a.clock == clk_leaf;
                let matches_edge = match a.edge {
                    ClockEdge::Posedge => is_posedge,
                    ClockEdge::Negedge => !is_posedge,
                };
                matches_name && matches_edge
            })
            .cloned()
            .collect();

        if matching_assertions.is_empty() {
            return;
        }

        // Increment cycle count for this clock
        let cycle = self.clock_cycles.entry(clk_leaf.to_string()).or_insert(0);
        *cycle += 1;
        let current_cycle = *cycle;

        // Sample all signals referenced across matching assertions into history
        for asrt in &matching_assertions {
            let signals = Self::collect_referenced_signals(&asrt.property);
            for sig in signals {
                if let Some(val) = Self::read_signal_value(&sig, circuit, net_values) {
                    self.history.record_sample(&sig, val);
                }
            }
        }

        // Evaluate each matching assertion
        for asrt in matching_assertions {
            self.evaluate_assertion(&asrt, sim_time, current_cycle);
        }
    }

    fn evaluate_assertion(
        &mut self,
        asrt: &AssertionDef,
        sim_time: SimTime,
        current_cycle: u64,
    ) {
        let asrt_id = &asrt.id;
        let mut threads_to_keep = Vec::new();
        let existing_threads = self.active_threads.remove(asrt_id).unwrap_or_default();

        // 1. Advance existing in-flight threads
        for mut thread in existing_threads {
            thread.cycles_elapsed += 1;

            if thread.cycles_elapsed >= thread.delay_min && thread.cycles_elapsed <= thread.delay_max {
                let (satisfied, new_consec) = self.eval_sequence(&thread.consequent, thread.consecutive_matched);
                thread.consecutive_matched = new_consec;

                if satisfied {
                    // Attempt passed!
                    if let Some(s) = self.stats.get_mut(asrt_id) {
                        s.passes += 1;
                    }
                    continue; // Done with thread
                } else if thread.consecutive_matched > 0 && thread.cycles_elapsed < thread.delay_max {
                    // Repetition partially matched and in-flight
                    threads_to_keep.push(thread);
                    continue;
                }
            }

            if thread.cycles_elapsed >= thread.delay_max {
                // Delay window expired without satisfaction -> VIOLATION!
                if let Some(s) = self.stats.get_mut(asrt_id) {
                    s.failures += 1;
                }

                let reason = format!(
                    "Protocol violation in '{}': Antecedent matched at {} (cycle {}), but consequent failed to hold within [{}..{}] cycles (timed out at {}, cycle {}).",
                    asrt.name,
                    thread.start_time,
                    thread.start_cycle,
                    thread.delay_min,
                    thread.delay_max,
                    sim_time,
                    current_cycle
                );

                let signals_snapshot = self.capture_signals_snapshot(&asrt.property);

                self.violations.push(AssertionViolation {
                    attempt_id: thread.id,
                    assertion_id: asrt.id.clone(),
                    assertion_name: asrt.name.clone(),
                    source_text: asrt.source_text.clone(),
                    line: asrt.line,
                    fail_time: sim_time,
                    start_time: thread.start_time,
                    fail_cycle: current_cycle,
                    start_cycle: thread.start_cycle,
                    message: reason,
                    signals: signals_snapshot,
                });
            } else {
                // Thread remains active
                threads_to_keep.push(thread);
            }
        }

        // 2. Evaluate antecedent for a new attempt
        match &asrt.property {
            PropertyExpr::Simple(seq) => {
                if let Some(s) = self.stats.get_mut(asrt_id) {
                    s.attempts += 1;
                }
                let (satisfied, _) = self.eval_sequence(seq, 0);
                if satisfied {
                    if let Some(s) = self.stats.get_mut(asrt_id) {
                        s.passes += 1;
                    }
                } else if asrt.kind != AssertionKind::Cover {
                    if let Some(s) = self.stats.get_mut(asrt_id) {
                        s.failures += 1;
                    }
                    let reason = format!(
                        "Immediate assertion '{}' failed at {} (cycle {}).",
                        asrt.name, sim_time, current_cycle
                    );
                    let signals_snapshot = self.capture_signals_snapshot(&asrt.property);
                    self.violations.push(AssertionViolation {
                        attempt_id: self.next_thread_id,
                        assertion_id: asrt.id.clone(),
                        assertion_name: asrt.name.clone(),
                        source_text: asrt.source_text.clone(),
                        line: asrt.line,
                        fail_time: sim_time,
                        start_time: sim_time,
                        fail_cycle: current_cycle,
                        start_cycle: current_cycle,
                        message: reason,
                        signals: signals_snapshot,
                    });
                    self.next_thread_id += 1;
                }
            }
            PropertyExpr::Implication {
                antecedent,
                overlapping,
                delay_min,
                delay_max,
                consequent,
            } => {
                if let Some(s) = self.stats.get_mut(asrt_id) {
                    s.attempts += 1;
                }

                let (antecedent_match, _) = self.eval_sequence(antecedent, 0);
                if antecedent_match {
                    if let Some(s) = self.stats.get_mut(asrt_id) {
                        s.matches += 1;
                    }

                    if *overlapping && *delay_min == 0 && *delay_max == 0 {
                        // Immediate evaluation on same cycle
                        let (consequent_match, _) = self.eval_sequence(consequent, 0);
                        if consequent_match {
                            if let Some(s) = self.stats.get_mut(asrt_id) {
                                s.passes += 1;
                            }
                        } else {
                            if let Some(s) = self.stats.get_mut(asrt_id) {
                                s.failures += 1;
                            }
                            let reason = format!(
                                "Overlapping implication in '{}' failed at {} (cycle {}): antecedent matched but consequent was false.",
                                asrt.name, sim_time, current_cycle
                            );
                            let signals_snapshot = self.capture_signals_snapshot(&asrt.property);
                            self.violations.push(AssertionViolation {
                                attempt_id: self.next_thread_id,
                                assertion_id: asrt.id.clone(),
                                assertion_name: asrt.name.clone(),
                                source_text: asrt.source_text.clone(),
                                line: asrt.line,
                                fail_time: sim_time,
                                start_time: sim_time,
                                fail_cycle: current_cycle,
                                start_cycle: current_cycle,
                                message: reason,
                                signals: signals_snapshot,
                            });
                            self.next_thread_id += 1;
                        }
                    } else {
                        // Spawn new tracking thread
                        let thread = AssertionThread {
                            id: self.next_thread_id,
                            start_time: sim_time,
                            start_cycle: current_cycle,
                            cycles_elapsed: 0,
                            delay_min: *delay_min,
                            delay_max: *delay_max,
                            consequent: consequent.clone(),
                            consecutive_matched: 0,
                        };
                        self.next_thread_id += 1;
                        threads_to_keep.push(thread);
                    }
                } else {
                    // Vacuous pass
                    if let Some(s) = self.stats.get_mut(asrt_id) {
                        s.vacuous += 1;
                    }
                }
            }
        }

        // Update in-flight count
        if let Some(s) = self.stats.get_mut(asrt_id) {
            s.in_flight = threads_to_keep.len();
        }
        self.active_threads.insert(asrt_id.clone(), threads_to_keep);
    }

    fn eval_sequence(&self, seq: &SequenceExpr, consecutive_matched: usize) -> (bool, usize) {
        match seq {
            SequenceExpr::Expr(expr) => (self.eval_expr(expr), 0),
            SequenceExpr::ConsecutiveRepeat { expr, count } => {
                let holds = self.eval_expr(expr);
                if holds {
                    let next_count = consecutive_matched + 1;
                    (next_count >= *count, next_count)
                } else {
                    (false, 0)
                }
            }
            SequenceExpr::CycleDelay { target, .. } => self.eval_sequence(target, consecutive_matched),
        }
    }

    fn eval_expr(&self, expr: &TemporalExpr) -> bool {
        match expr {
            TemporalExpr::Signal(name) => {
                if let Some(val) = self.history.current(name) {
                    val.get_bit(0) == Logic4::One
                } else {
                    false
                }
            }
            TemporalExpr::Literal(vec) => vec.get_bit(0) == Logic4::One,
            TemporalExpr::Rose(sig) => self.history.rose(sig),
            TemporalExpr::Fell(sig) => self.history.fell(sig),
            TemporalExpr::IsUnknown(sig) => self.history.is_unknown(sig),
            TemporalExpr::Past(sig, cycles) => {
                if let Some(val) = self.history.past(sig, *cycles) {
                    val.get_bit(0) == Logic4::One
                } else {
                    false
                }
            }
            TemporalExpr::Unary { op, operand } => {
                let inner = self.eval_expr(operand);
                match op {
                    UnaryOp::Not => !inner,
                }
            }
            TemporalExpr::Binary { lhs, op, rhs } => {
                let l = self.eval_expr(lhs);
                let r = self.eval_expr(rhs);
                match op {
                    BinaryOp::And => l && r,
                    BinaryOp::Or => l || r,
                    BinaryOp::Xor => l ^ r,
                }
            }
            TemporalExpr::Compare { lhs, op, rhs } => {
                let l_val = self.eval_expr_to_u64(lhs);
                let r_val = self.eval_expr_to_u64(rhs);
                match (l_val, r_val) {
                    (Some(l), Some(r)) => match op {
                        CompareOp::Eq => l == r,
                        CompareOp::Ne => l != r,
                        CompareOp::Lt => l < r,
                        CompareOp::Le => l <= r,
                        CompareOp::Gt => l > r,
                        CompareOp::Ge => l >= r,
                    },
                    _ => false,
                }
            }
        }
    }

    fn eval_expr_to_u64(&self, expr: &TemporalExpr) -> Option<u64> {
        match expr {
            TemporalExpr::Signal(name) => {
                self.history.current(name).and_then(|v| v.to_u64())
            }
            TemporalExpr::Literal(vec) => vec.to_u64(),
            TemporalExpr::Past(name, cycles) => {
                self.history.past(name, *cycles).and_then(|v| v.to_u64())
            }
            _ => {
                if self.eval_expr(expr) {
                    Some(1)
                } else {
                    Some(0)
                }
            }
        }
    }

    fn capture_signals_snapshot(&self, property: &PropertyExpr) -> HashMap<String, String> {
        let mut map = HashMap::new();
        for sig in Self::collect_referenced_signals(property) {
            if let Some(val) = self.history.current(&sig) {
                map.insert(sig, format!("{val:?}"));
            }
        }
        map
    }

    fn collect_referenced_signals(property: &PropertyExpr) -> Vec<String> {
        let mut set = Vec::new();
        match property {
            PropertyExpr::Simple(seq) => Self::collect_sequence_signals(seq, &mut set),
            PropertyExpr::Implication {
                antecedent,
                consequent,
                ..
            } => {
                Self::collect_sequence_signals(antecedent, &mut set);
                Self::collect_sequence_signals(consequent, &mut set);
            }
        }
        set.sort();
        set.dedup();
        set
    }

    fn collect_sequence_signals(seq: &SequenceExpr, out: &mut Vec<String>) {
        match seq {
            SequenceExpr::Expr(e) => Self::collect_expr_signals(e, out),
            SequenceExpr::ConsecutiveRepeat { expr, .. } => Self::collect_expr_signals(expr, out),
            SequenceExpr::CycleDelay { target, .. } => Self::collect_sequence_signals(target, out),
        }
    }

    fn collect_expr_signals(expr: &TemporalExpr, out: &mut Vec<String>) {
        match expr {
            TemporalExpr::Signal(s) => out.push(s.clone()),
            TemporalExpr::Rose(s) => out.push(s.clone()),
            TemporalExpr::Fell(s) => out.push(s.clone()),
            TemporalExpr::IsUnknown(s) => out.push(s.clone()),
            TemporalExpr::Past(s, _) => out.push(s.clone()),
            TemporalExpr::Unary { operand, .. } => Self::collect_expr_signals(operand, out),
            TemporalExpr::Binary { lhs, rhs, .. } => {
                Self::collect_expr_signals(lhs, out);
                Self::collect_expr_signals(rhs, out);
            }
            TemporalExpr::Compare { lhs, rhs, .. } => {
                Self::collect_expr_signals(lhs, out);
                Self::collect_expr_signals(rhs, out);
            }
            TemporalExpr::Literal(_) => {}
        }
    }

    fn read_signal_value(
        sig_name: &str,
        circuit: &BirCircuit,
        net_values: &HashMap<NetId, LogicVector>,
    ) -> Option<LogicVector> {
        if let Some(net) = circuit.get_net_by_name(sig_name) {
            if let Some(val) = net_values.get(&net.id) {
                return Some(val.clone());
            }
        }
        None
    }

    /// Compiles full design-wide report.
    pub fn get_report(&self) -> AssertionReport {
        let mut summaries = Vec::new();
        let mut total_passes = 0;
        let mut total_failures = 0;
        let mut total_vacuous = 0;
        let mut active_in_flight = 0;

        for asrt in &self.assertions {
            let stats = self.stats.get(&asrt.id).cloned().unwrap_or_default();
            let violations: Vec<AssertionViolation> = self
                .violations
                .iter()
                .filter(|v| v.assertion_id == asrt.id)
                .cloned()
                .collect();

            let status = if stats.failures > 0 {
                AssertionStatus::Violated
            } else if stats.in_flight > 0 {
                AssertionStatus::InFlight
            } else if stats.passes > 0 {
                AssertionStatus::Passing
            } else if stats.vacuous > 0 {
                AssertionStatus::Vacuous
            } else {
                AssertionStatus::Inactive
            };

            total_passes += stats.passes;
            total_failures += stats.failures;
            total_vacuous += stats.vacuous;
            active_in_flight += stats.in_flight;

            summaries.push(AssertionSummary {
                def: asrt.clone(),
                stats,
                violations,
                status,
            });
        }

        let total_evals = total_passes + total_failures;
        let overall_pass_rate_pct = if total_evals > 0 {
            (total_passes as f64 / total_evals as f64) * 100.0
        } else {
            100.0
        };

        AssertionReport {
            assertions: summaries,
            total_assertions: self.assertions.len(),
            total_passes,
            total_failures,
            total_vacuous,
            active_in_flight,
            overall_pass_rate_pct,
            recent_violations: self.violations.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sva_parser_overlapping_implication() {
        let text = "check_ack: assert property (@(posedge clk) req |-> ##[1:4] ack);";
        let mut parser = SvaParser::new(text);
        let asrt = parser.parse_assertion("asrt_0").expect("Should parse");
        assert_eq!(asrt.name, "check_ack");
        assert_eq!(asrt.clock, "clk");
        assert_eq!(asrt.edge, ClockEdge::Posedge);

        if let PropertyExpr::Implication {
            overlapping,
            delay_min,
            delay_max,
            ..
        } = asrt.property
        {
            assert!(overlapping);
            assert_eq!(delay_min, 1);
            assert_eq!(delay_max, 4);
        } else {
            panic!("Expected implication property");
        }
    }

    #[test]
    fn test_sva_parser_non_overlapping_implication() {
        let text = "assert property (@(posedge clk) req |=> ack);";
        let mut parser = SvaParser::new(text);
        let asrt = parser.parse_assertion("asrt_0").expect("Should parse");
        assert_eq!(asrt.name, "asrt_0");

        if let PropertyExpr::Implication {
            overlapping,
            delay_min,
            delay_max,
            ..
        } = asrt.property
        {
            assert!(!overlapping);
            assert_eq!(delay_min, 1);
            assert_eq!(delay_max, 1);
        } else {
            panic!("Expected implication property");
        }
    }

    #[test]
    fn test_sva_parser_sample_functions() {
        let text = "assert property (@(posedge clk) $rose(req) |=> $past(ack, 2) && !$isunknown(data));";
        let mut parser = SvaParser::new(text);
        let asrt = parser.parse_assertion("asrt_0").expect("Should parse");
        assert!(asrt.source_text.contains("$rose"));
        assert!(asrt.source_text.contains("$past"));
    }

    #[test]
    fn test_sva_evaluator_pass_within_range() {
        let mut eval = AssertionEvaluator::new();
        eval.add_assertion_str("check_ack: assert property (@(posedge clk) req |-> ##[1:3] ack);")
            .unwrap();

        let circuit = BirCircuit::new("top");
        let net_vals = HashMap::new();

        // Cycle 1: req = 1, ack = 0 -> Antecedent match!
        eval.history.record_sample("req", LogicVector::fill(1, Logic4::One));
        eval.history.record_sample("ack", LogicVector::zeros(1));
        eval.step_clock("clk", true, SimTime::from_ps(1000), &circuit, &net_vals);

        let report1 = eval.get_report();
        assert_eq!(report1.assertions[0].stats.matches, 1);
        assert_eq!(report1.assertions[0].stats.in_flight, 1);

        // Cycle 2: req = 0, ack = 1 -> ack asserts at cycle 1 (within [1:3]) -> PASS!
        eval.history.record_sample("req", LogicVector::zeros(1));
        eval.history.record_sample("ack", LogicVector::fill(1, Logic4::One));
        eval.step_clock("clk", true, SimTime::from_ps(2000), &circuit, &net_vals);

        let report2 = eval.get_report();
        assert_eq!(report2.assertions[0].stats.passes, 1);
        assert_eq!(report2.assertions[0].stats.failures, 0);
        assert_eq!(report2.assertions[0].stats.in_flight, 0);
    }

    #[test]
    fn test_sva_evaluator_timeout_violation() {
        let mut eval = AssertionEvaluator::new();
        eval.add_assertion_str("check_ack: assert property (@(posedge clk) req |-> ##[1:2] ack);")
            .unwrap();

        let circuit = BirCircuit::new("top");
        let net_vals = HashMap::new();

        // Cycle 1: req = 1, ack = 0
        eval.history.record_sample("req", LogicVector::fill(1, Logic4::One));
        eval.history.record_sample("ack", LogicVector::zeros(1));
        eval.step_clock("clk", true, SimTime::from_ps(1000), &circuit, &net_vals);

        // Cycle 2: req = 0, ack = 0 (elapsed 1)
        eval.history.record_sample("req", LogicVector::zeros(1));
        eval.history.record_sample("ack", LogicVector::zeros(1));
        eval.step_clock("clk", true, SimTime::from_ps(2000), &circuit, &net_vals);

        // Cycle 3: req = 0, ack = 0 (elapsed 2 == max_delay) -> VIOLATION!
        eval.history.record_sample("req", LogicVector::zeros(1));
        eval.history.record_sample("ack", LogicVector::zeros(1));
        eval.step_clock("clk", true, SimTime::from_ps(3000), &circuit, &net_vals);

        let report = eval.get_report();
        assert_eq!(report.assertions[0].stats.failures, 1);
        assert_eq!(report.assertions[0].violations.len(), 1);
        assert!(report.assertions[0].violations[0].message.contains("timed out"));
    }

    #[test]
    fn test_sva_evaluator_rose_fell() {
        let mut eval = AssertionEvaluator::new();
        eval.history.record_sample("sig", LogicVector::zeros(1));
        eval.history.record_sample("sig", LogicVector::fill(1, Logic4::One));
        assert!(eval.history.rose("sig"));
        assert!(!eval.history.fell("sig"));

        eval.history.record_sample("sig", LogicVector::zeros(1));
        assert!(!eval.history.rose("sig"));
        assert!(eval.history.fell("sig"));
    }

    #[test]
    fn test_sva_evaluator_past() {
        let mut eval = AssertionEvaluator::new();
        eval.history.record_sample("data", LogicVector::from_u64(10, 32));
        eval.history.record_sample("data", LogicVector::from_u64(20, 32));
        eval.history.record_sample("data", LogicVector::from_u64(30, 32));

        let current = eval.history.current("data").unwrap().to_u64().unwrap();
        let past_1 = eval.history.past("data", 1).unwrap().to_u64().unwrap();
        let past_2 = eval.history.past("data", 2).unwrap().to_u64().unwrap();

        assert_eq!(current, 30);
        assert_eq!(past_1, 20);
        assert_eq!(past_2, 10);
    }

    #[test]
    fn test_sva_evaluator_consecutive_repeat() {
        let mut eval = AssertionEvaluator::new();
        eval.add_assertion_str("check_busy: assert property (@(posedge clk) req |=> ack [*2]);")
            .unwrap();

        let circuit = BirCircuit::new("top");
        let net_vals = HashMap::new();

        // Cycle 1: req = 1
        eval.history.record_sample("req", LogicVector::fill(1, Logic4::One));
        eval.history.record_sample("ack", LogicVector::zeros(1));
        eval.step_clock("clk", true, SimTime::from_ps(1000), &circuit, &net_vals);

        // Cycle 2: ack = 1 (1st repetition match)
        eval.history.record_sample("req", LogicVector::zeros(1));
        eval.history.record_sample("ack", LogicVector::fill(1, Logic4::One));
        eval.step_clock("clk", true, SimTime::from_ps(2000), &circuit, &net_vals);

        assert_eq!(eval.get_report().assertions[0].stats.in_flight, 1);

        // Cycle 3: ack = 1 (2nd repetition match -> COMPLETE!)
        eval.history.record_sample("req", LogicVector::zeros(1));
        eval.history.record_sample("ack", LogicVector::fill(1, Logic4::One));
        eval.step_clock("clk", true, SimTime::from_ps(3000), &circuit, &net_vals);

        let report = eval.get_report();
        assert_eq!(report.assertions[0].stats.passes, 1);
        assert_eq!(report.assertions[0].stats.in_flight, 0);
    }
}
