use axiom_ir::NetId;
use axiom_syntax::coverage::{AstCoveragePoints, BranchPoint, StatementPoint};
use hashbrown::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct BranchHits {
    pub true_hits: u64,
    pub false_hits: u64,
}

impl BranchHits {
    pub fn is_fully_covered(&self) -> bool {
        self.true_hits > 0 && self.false_hits > 0
    }

    pub fn is_partially_covered(&self) -> bool {
        (self.true_hits > 0 && self.false_hits == 0) || (self.true_hits == 0 && self.false_hits > 0)
    }

    pub fn total(&self) -> u64 {
        self.true_hits + self.false_hits
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct BitToggle {
    pub toggled_0_to_1: bool,
    pub toggled_1_to_0: bool,
}

impl BitToggle {
    pub fn is_fully_covered(&self) -> bool {
        self.toggled_0_to_1 && self.toggled_1_to_0
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct FsmCoverageData {
    pub fsm_name: String,
    pub state_hits: HashMap<String, u64>,
    pub transition_hits: HashMap<String, u64>, // Key: "from->to"
    pub total_states: usize,
    pub total_transitions: usize,
}

impl FsmCoverageData {
    pub fn states_covered(&self) -> usize {
        self.state_hits.values().filter(|&&count| count > 0).count()
    }

    pub fn transitions_covered(&self) -> usize {
        self.transition_hits.values().filter(|&&count| count > 0).count()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LineCoverageStatus {
    Covered,
    Partial,
    Uncovered,
    NonExecutable,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LineCoverageInfo {
    pub line: usize,
    pub hits: u64,
    pub status: LineCoverageStatus,
    pub branch_true: Option<u64>,
    pub branch_false: Option<u64>,
    pub snippet: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoverageReport {
    pub statement_total: usize,
    pub statement_hit: usize,
    pub statement_pct: f32,

    pub branch_total: usize,
    pub branch_covered: usize,
    pub branch_partial: usize,
    pub branch_pct: f32,

    pub toggle_total: usize,
    pub toggle_covered: usize,
    pub toggle_pct: f32,

    pub fsm_state_total: usize,
    pub fsm_state_hit: usize,
    pub fsm_state_pct: f32,

    pub fsm_transition_total: usize,
    pub fsm_transition_hit: usize,
    pub fsm_transition_pct: f32,

    pub overall_pct: f32,
    pub lines: Vec<LineCoverageInfo>,
    pub fsm_details: HashMap<String, FsmCoverageData>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CoverageTracker {
    pub statement_hits: HashMap<usize, u64>,
    pub line_hits: HashMap<usize, u64>,
    pub branch_hits: HashMap<usize, BranchHits>,
    pub toggle_hits: HashMap<NetId, Vec<BitToggle>>,
    pub fsm_coverage: HashMap<String, FsmCoverageData>,
    pub points: Option<AstCoveragePoints>,
    /// Maps NetId to statement IDs that drive this net
    pub net_to_statement_ids: HashMap<NetId, Vec<usize>>,
}

impl CoverageTracker {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn set_points(&mut self, points: AstCoveragePoints) {
        self.statement_hits.clear();
        self.branch_hits.clear();
        self.line_hits.clear();

        for stmt in &points.statements {
            self.statement_hits.insert(stmt.id, 0);
            self.line_hits.insert(stmt.line, 0);
        }

        for branch in &points.branches {
            self.branch_hits.insert(branch.id, BranchHits::default());
            self.line_hits.insert(branch.line, 0);
        }

        self.points = Some(points);
    }

    pub fn init_toggles(&mut self, net_widths: &[(NetId, u32)]) {
        for &(net, width) in net_widths {
            self.toggle_hits.entry(net).or_insert_with(|| {
                vec![BitToggle::default(); width as usize]
            });
        }
    }

    pub fn record_statement_hit(&mut self, stmt_id: usize) {
        let count = self.statement_hits.entry(stmt_id).or_insert(0);
        *count = count.saturating_add(1);

        if let Some(pts) = &self.points {
            if let Some(stmt) = pts.statements.get(stmt_id) {
                let l_count = self.line_hits.entry(stmt.line).or_insert(0);
                *l_count = l_count.saturating_add(1);
            }
        }
    }

    pub fn record_line_hit(&mut self, line: usize) {
        let count = self.line_hits.entry(line).or_insert(0);
        *count = count.saturating_add(1);
    }

    pub fn record_branch_hit(&mut self, branch_id: usize, condition_true: bool) {
        let hits = self.branch_hits.entry(branch_id).or_default();
        if condition_true {
            hits.true_hits = hits.true_hits.saturating_add(1);
        } else {
            hits.false_hits = hits.false_hits.saturating_add(1);
        }

        if let Some(pts) = &self.points {
            if let Some(branch) = pts.branches.get(branch_id) {
                let l_count = self.line_hits.entry(branch.line).or_insert(0);
                *l_count = l_count.saturating_add(1);
            }
        }
    }

    pub fn record_toggle(&mut self, net: NetId, bit_idx: usize, is_rising: bool) {
        if let Some(toggles) = self.toggle_hits.get_mut(&net) {
            if let Some(bit) = toggles.get_mut(bit_idx) {
                if is_rising {
                    bit.toggled_0_to_1 = true;
                } else {
                    bit.toggled_1_to_0 = true;
                }
            }
        }
    }

    pub fn record_fsm_state(&mut self, fsm_name: &str, state: &str) {
        let fsm = self.fsm_coverage.entry(fsm_name.to_string()).or_default();
        fsm.fsm_name = fsm_name.to_string();
        let count = fsm.state_hits.entry(state.to_string()).or_insert(0);
        *count = count.saturating_add(1);
    }

    pub fn record_fsm_transition(&mut self, fsm_name: &str, from_state: &str, to_state: &str) {
        let fsm = self.fsm_coverage.entry(fsm_name.to_string()).or_default();
        fsm.fsm_name = fsm_name.to_string();
        let key = format!("{from_state}->{to_state}");
        let count = fsm.transition_hits.entry(key).or_insert(0);
        *count = count.saturating_add(1);
    }

    pub fn reset(&mut self) {
        for val in self.statement_hits.values_mut() {
            *val = 0;
        }
        for val in self.line_hits.values_mut() {
            *val = 0;
        }
        for val in self.branch_hits.values_mut() {
            *val = BranchHits::default();
        }
        for bits in self.toggle_hits.values_mut() {
            for b in bits.iter_mut() {
                *b = BitToggle::default();
            }
        }
        for fsm in self.fsm_coverage.values_mut() {
            for v in fsm.state_hits.values_mut() {
                *v = 0;
            }
            for v in fsm.transition_hits.values_mut() {
                *v = 0;
            }
        }
    }

    pub fn generate_report(&self) -> CoverageReport {
        let points = self.points.as_ref();
        let total_lines = points.map(|p| p.total_lines).unwrap_or_else(|| {
            self.line_hits.keys().copied().max().unwrap_or(1)
        });

        // 1. Statement Coverage
        let stmt_total = points.map(|p| p.statements.len()).unwrap_or(self.statement_hits.len());
        let stmt_hit = self.statement_hits.values().filter(|&&hits| hits > 0).count();
        let stmt_pct = if stmt_total > 0 {
            (stmt_hit as f32 / stmt_total as f32) * 100.0
        } else {
            100.0
        };

        // 2. Branch Coverage
        let branch_total = points.map(|p| p.branches.len()).unwrap_or(self.branch_hits.len());
        let mut branch_covered = 0;
        let mut branch_partial = 0;
        for hits in self.branch_hits.values() {
            if hits.is_fully_covered() {
                branch_covered += 1;
            } else if hits.is_partially_covered() {
                branch_partial += 1;
            }
        }
        let branch_pct = if branch_total > 0 {
            ((branch_covered as f32 + (branch_partial as f32 * 0.5)) / branch_total as f32) * 100.0
        } else {
            100.0
        };

        // 3. Toggle Coverage
        let mut toggle_total_bits = 0;
        let mut toggle_covered_bits = 0;
        for bits in self.toggle_hits.values() {
            for bit in bits {
                toggle_total_bits += 2; // rising and falling
                if bit.toggled_0_to_1 {
                    toggle_covered_bits += 1;
                }
                if bit.toggled_1_to_0 {
                    toggle_covered_bits += 1;
                }
            }
        }
        let toggle_pct = if toggle_total_bits > 0 {
            (toggle_covered_bits as f32 / toggle_total_bits as f32) * 100.0
        } else {
            100.0
        };

        // 4. FSM Coverage
        let mut fsm_state_total = 0;
        let mut fsm_state_hit = 0;
        let mut fsm_trans_total = 0;
        let mut fsm_trans_hit = 0;

        for fsm in self.fsm_coverage.values() {
            let s_total = fsm.total_states.max(fsm.state_hits.len());
            let s_hit = fsm.states_covered();
            let t_total = fsm.total_transitions.max(fsm.transition_hits.len());
            let t_hit = fsm.transitions_covered();

            fsm_state_total += s_total;
            fsm_state_hit += s_hit;
            fsm_trans_total += t_total;
            fsm_trans_hit += t_hit;
        }

        let fsm_state_pct = if fsm_state_total > 0 {
            (fsm_state_hit as f32 / fsm_state_total as f32) * 100.0
        } else {
            100.0
        };

        let fsm_trans_pct = if fsm_trans_total > 0 {
            (fsm_trans_hit as f32 / fsm_trans_total as f32) * 100.0
        } else {
            100.0
        };

        // Overall Quality Score (Weighted Average: 35% Stmt, 30% Branch, 20% Toggle, 15% FSM)
        let overall_pct = if fsm_state_total > 0 {
            (stmt_pct * 0.35) + (branch_pct * 0.30) + (toggle_pct * 0.20) + (fsm_state_pct * 0.15)
        } else {
            (stmt_pct * 0.40) + (branch_pct * 0.35) + (toggle_pct * 0.25)
        };

        // 5. Line-by-Line breakdown
        let mut lines = Vec::with_capacity(total_lines);
        let mut line_to_branches: HashMap<usize, Vec<&BranchPoint>> = HashMap::new();
        let mut line_to_stmts: HashMap<usize, Vec<&StatementPoint>> = HashMap::new();

        if let Some(pts) = points {
            for b in &pts.branches {
                line_to_branches.entry(b.line).or_default().push(b);
            }
            for s in &pts.statements {
                line_to_stmts.entry(s.line).or_default().push(s);
            }
        }

        for line_num in 1..=total_lines {
            let hits = *self.line_hits.get(&line_num).unwrap_or(&0);
            let has_stmts = line_to_stmts.contains_key(&line_num);
            let branches = line_to_branches.get(&line_num);

            let (status, branch_true, branch_false, snippet) = if let Some(brs) = branches {
                let first_br = brs[0];
                let br_hits = self.branch_hits.get(&first_br.id).copied().unwrap_or_default();
                let status = if br_hits.is_fully_covered() {
                    LineCoverageStatus::Covered
                } else if br_hits.is_partially_covered() {
                    LineCoverageStatus::Partial
                } else if hits > 0 {
                    LineCoverageStatus::Covered
                } else {
                    LineCoverageStatus::Uncovered
                };
                (
                    status,
                    Some(br_hits.true_hits),
                    Some(br_hits.false_hits),
                    Some(first_br.cond_text.clone()),
                )
            } else if has_stmts {
                let stmts = &line_to_stmts[&line_num];
                let snippet = stmts.first().map(|s| s.snippet.clone());
                let status = if hits > 0 {
                    LineCoverageStatus::Covered
                } else {
                    LineCoverageStatus::Uncovered
                };
                (status, None, None, snippet)
            } else if hits > 0 {
                (LineCoverageStatus::Covered, None, None, None)
            } else {
                (LineCoverageStatus::NonExecutable, None, None, None)
            };

            lines.push(LineCoverageInfo {
                line: line_num,
                hits,
                status,
                branch_true,
                branch_false,
                snippet,
            });
        }

        CoverageReport {
            statement_total: stmt_total,
            statement_hit: stmt_hit,
            statement_pct: (stmt_pct * 10.0).round() / 10.0,
            branch_total,
            branch_covered,
            branch_partial,
            branch_pct: (branch_pct * 10.0).round() / 10.0,
            toggle_total: toggle_total_bits,
            toggle_covered: toggle_covered_bits,
            toggle_pct: (toggle_pct * 10.0).round() / 10.0,
            fsm_state_total,
            fsm_state_hit,
            fsm_state_pct: (fsm_state_pct * 10.0).round() / 10.0,
            fsm_transition_total: fsm_trans_total,
            fsm_transition_hit: fsm_trans_hit,
            fsm_transition_pct: (fsm_trans_pct * 10.0).round() / 10.0,
            overall_pct: (overall_pct * 10.0).round() / 10.0,
            lines,
            fsm_details: self.fsm_coverage.clone(),
        }
    }
}

/// Generates a standard LCOV (.info) string compatible with SonarQube, Codecov, Coveralls, and CI/CD pipelines.
pub fn generate_lcov(report: &CoverageReport, source_file_path: &str) -> String {
    let mut out = String::new();
    out.push_str("TN:AxiomSim\n");
    out.push_str(&format!("SF:{source_file_path}\n"));

    let mut executable_lines = 0;
    let mut covered_lines = 0;

    for line in &report.lines {
        if line.status != LineCoverageStatus::NonExecutable {
            executable_lines += 1;
            if line.hits > 0 {
                covered_lines += 1;
            }
            out.push_str(&format!("DA:{},{}\n", line.line, line.hits));

            if let (Some(bt), Some(bf)) = (line.branch_true, line.branch_false) {
                out.push_str(&format!("BRDA:{},0,0,{}\n", line.line, bt));
                out.push_str(&format!("BRDA:{},0,1,{}\n", line.line, bf));
            }
        }
    }

    out.push_str(&format!("LF:{executable_lines}\n"));
    out.push_str(&format!("LH:{covered_lines}\n"));
    out.push_str(&format!("BRF:{}\n", report.branch_total * 2));
    out.push_str(&format!(
        "BRH:{}\n",
        (report.branch_covered * 2) + report.branch_partial
    ));
    out.push_str("end_of_record\n");
    out
}

/// Generates a standalone, dark-themed interactive HTML report.
pub fn generate_html(report: &CoverageReport, source_name: &str, source_code: &str) -> String {
    let lines_html: Vec<String> = source_code
        .lines()
        .enumerate()
        .map(|(idx, line_text)| {
            let line_num = idx + 1;
            let info = report.lines.get(idx);
            let (badge_class, badge_text, bg_color) = match info.map(|i| i.status) {
                Some(LineCoverageStatus::Covered) => (
                    "cov-covered",
                    format!("{}x", info.unwrap().hits),
                    "rgba(16, 185, 129, 0.12)",
                ),
                Some(LineCoverageStatus::Partial) => (
                    "cov-partial",
                    format!("T:{} F:{}", info.unwrap().branch_true.unwrap_or(0), info.unwrap().branch_false.unwrap_or(0)),
                    "rgba(245, 158, 11, 0.14)",
                ),
                Some(LineCoverageStatus::Uncovered) => (
                    "cov-uncovered",
                    "0x".to_string(),
                    "rgba(239, 68, 68, 0.14)",
                ),
                _ => ("cov-neutral", "".to_string(), "transparent"),
            };

            let escaped = line_text
                .replace('&', "&amp;")
                .replace('<', "&lt;")
                .replace('>', "&gt;");

            format!(
                r#"<tr style="background-color: {bg_color};"><td class="line-num">{line_num}</td><td class="hits {badge_class}">{badge_text}</td><td class="code"><code>{escaped}</code></td></tr>"#
            )
        })
        .collect();

    format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Axiom RTL Coverage — {source_name}</title>
  <style>
    body {{ background: #0c1017; color: #f0f6fc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 24px; }}
    h1 {{ font-size: 20px; margin-bottom: 8px; color: #58a6ff; }}
    .subtitle {{ color: #8b949e; font-size: 13px; margin-bottom: 24px; }}
    .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }}
    .card {{ background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px; text-align: center; }}
    .card .val {{ font-size: 28px; font-weight: bold; margin-top: 4px; }}
    .card .lbl {{ font-size: 12px; color: #8b949e; text-transform: uppercase; letter-spacing: 0.5px; }}
    .good {{ color: #10b981; }}
    .warn {{ color: #f59e0b; }}
    .bad {{ color: #ef4444; }}
    table.code-table {{ width: 100%; border-collapse: collapse; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; background: #0d1117; border: 1px solid #30363d; border-radius: 8px; overflow: hidden; }}
    td.line-num {{ width: 44px; text-align: right; color: #6e7681; padding: 2px 10px; user-select: none; border-right: 1px solid #21262d; }}
    td.hits {{ width: 70px; text-align: right; padding: 2px 8px; font-size: 11px; border-right: 1px solid #21262d; }}
    td.code {{ padding: 2px 12px; white-space: pre; }}
    .cov-covered {{ color: #10b981; font-weight: bold; }}
    .cov-partial {{ color: #f59e0b; font-weight: bold; }}
    .cov-uncovered {{ color: #ef4444; font-weight: bold; }}
  </style>
</head>
<body>
  <h1>Axiom RTL Code Coverage — {source_name}</h1>
  <div class="subtitle">Generated by Axiom High-Performance Hardware Engine &bull; Overall Quality Score: <strong class="{score_class}">{overall_pct}%</strong></div>
  
  <div class="grid">
    <div class="card"><div class="lbl">Statement Coverage</div><div class="val {stmt_class}">{stmt_pct}%</div><div style="font-size: 11px; color: #8b949e; margin-top: 4px;">{stmt_hit} / {stmt_total} statements</div></div>
    <div class="card"><div class="lbl">Branch Coverage</div><div class="val {br_class}">{br_pct}%</div><div style="font-size: 11px; color: #8b949e; margin-top: 4px;">{br_covered} covered, {br_partial} partial</div></div>
    <div class="card"><div class="lbl">Toggle Coverage</div><div class="val {tgl_class}">{tgl_pct}%</div><div style="font-size: 11px; color: #8b949e; margin-top: 4px;">{tgl_covered} / {tgl_total} edges</div></div>
    <div class="card"><div class="lbl">FSM Coverage</div><div class="val {fsm_class}">{fsm_pct}%</div><div style="font-size: 11px; color: #8b949e; margin-top: 4px;">{fsm_hit} / {fsm_total} states</div></div>
  </div>

  <table class="code-table">
    <tbody>
      {lines_joined}
    </tbody>
  </table>
</body>
</html>"#,
        source_name = source_name,
        score_class = if report.overall_pct >= 80.0 { "good" } else if report.overall_pct >= 50.0 { "warn" } else { "bad" },
        overall_pct = report.overall_pct,
        stmt_class = if report.statement_pct >= 80.0 { "good" } else { "bad" },
        stmt_pct = report.statement_pct,
        stmt_hit = report.statement_hit,
        stmt_total = report.statement_total,
        br_class = if report.branch_pct >= 80.0 { "good" } else { "bad" },
        br_pct = report.branch_pct,
        br_covered = report.branch_covered,
        br_partial = report.branch_partial,
        tgl_class = if report.toggle_pct >= 80.0 { "good" } else { "bad" },
        tgl_pct = report.toggle_pct,
        tgl_covered = report.toggle_covered,
        tgl_total = report.toggle_total,
        fsm_class = if report.fsm_state_pct >= 80.0 { "good" } else { "bad" },
        fsm_pct = report.fsm_state_pct,
        fsm_hit = report.fsm_state_hit,
        fsm_total = report.fsm_state_total,
        lines_joined = lines_html.join("\n")
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use axiom_core::FileId;
    use axiom_syntax::coverage::CoveragePointExtractor;
    use axiom_syntax::parse_hdl;

    #[test]
    fn test_coverage_accumulation_and_report() {
        let source = r#"
module counter (
    input wire clk,
    input wire rst_n,
    output reg [3:0] count
);
    always @(posedge clk) begin
        if (!rst_n) begin
            count <= 4'b0000;
        end else begin
            count <= count + 1;
        end
    end
endmodule
"#;
        let (ast, diags) = parse_hdl(FileId(1), source);
        assert!(diags.is_empty());

        let points = CoveragePointExtractor::extract(FileId(1), source, &ast);
        let mut tracker = CoverageTracker::new();
        tracker.set_points(points);
        tracker.init_toggles(&[(NetId(0), 1), (NetId(1), 1), (NetId(2), 4)]);

        // Record hits
        tracker.record_statement_hit(0);
        tracker.record_branch_hit(0, true); // rst_n active
        tracker.record_toggle(NetId(0), 0, true);
        tracker.record_toggle(NetId(0), 0, false);

        let report = tracker.generate_report();
        assert!(report.statement_hit > 0);
        assert_eq!(report.branch_partial, 1, "Branch evaluated only true, should be partial");

        let lcov = generate_lcov(&report, "counter.v");
        assert!(lcov.contains("SF:counter.v"));
        assert!(lcov.contains("end_of_record"));

        let html = generate_html(&report, "counter.v", source);
        assert!(html.contains("Axiom RTL Code Coverage"));
        assert!(html.contains("Statement Coverage"));
    }
}
