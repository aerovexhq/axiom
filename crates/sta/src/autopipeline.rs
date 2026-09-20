use crate::types::TimingPath;
use axiom_core::FileId;
use axiom_syntax::{parse_hdl, ModuleItem};
use serde::{Deserialize, Serialize};

/// Candidate net along the critical path where a pipeline register can be inserted.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineCutCandidate {
    pub net_name: String,
    pub driver_cell: String,
    pub stage1_delay_ps: f32,
    pub stage2_delay_ps: f32,
    pub predicted_stage1_slack_ps: f32,
    pub predicted_stage2_slack_ps: f32,
    pub predicted_wns_ps: f32,
    pub predicted_fmax_mhz: f32,
    pub slack_gain_ps: f32,
    pub fmax_gain_mhz: f32,
    pub is_optimal: bool,
}

/// Comprehensive recommendation produced by Silicon Copilot for a timing path.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoPipelineRecommendation {
    pub path_id: String,
    pub startpoint: String,
    pub endpoint: String,
    pub clock_name: String,
    pub reset_name: Option<String>,
    pub target_clock_period_ps: f32,
    pub current_wns_ps: f32,
    pub current_fmax_mhz: f32,
    pub optimal_cut: Option<PipelineCutCandidate>,
    pub candidates: Vec<PipelineCutCandidate>,
    pub refactored_code: Option<String>,
    pub diff_preview: Option<String>,
}

/// Silicon Copilot: Real-Time Timing Slack Auto-Pipeliner and RTL Refactoring Engine.
pub struct AutoPipeliner;

impl AutoPipeliner {
    /// Evaluates all candidate cut points along a timing path and finds the optimal cut.
    pub fn analyze_path(
        path: &TimingPath,
        target_period_ps: f32,
        clock_name: Option<&str>,
        reset_name: Option<&str>,
        verilog_source: Option<&str>,
    ) -> AutoPipelineRecommendation {
        let period_ps = if target_period_ps > 0.0 {
            target_period_ps
        } else {
            path.clock_period_ps
        };

        let current_crit_delay = period_ps - path.slack_ps;
        let current_fmax_mhz = if current_crit_delay > 0.0 {
            1_000_000.0 / current_crit_delay
        } else {
            100.0
        };

        let clk = clock_name
            .map(|s| s.to_string())
            .unwrap_or_else(|| {
                if path.launch_clock != "unconstrained" && !path.launch_clock.is_empty() {
                    path.launch_clock.clone()
                } else {
                    "clk".to_string()
                }
            });

        let rst = reset_name.map(|s| s.to_string());

        let t_setup = 45.0f32; // Standard setup window requirement in ps
        let t_co = 200.0f32;  // Clock-to-out propagation delay in ps
        let t_skew = 100.0f32; // Launch clock distribution skew in ps

        // Extract candidate cuts along the path segments
        let mut raw_candidates: Vec<(String, String, f32)> = Vec::new();
        let total_data_delay = path.data_delay_ps.max(path.logic_delay_ps + path.wire_delay_ps);

        let mut last_cell = path.startpoint.clone();
        for seg in &path.segments {
            if seg.segment_type == "cell" {
                last_cell = seg.name.clone();
            } else if seg.segment_type == "net" {
                // Extract net name from "Net (w2)" or raw label
                let net_name = extract_net_name(&seg.name);
                if !net_name.is_empty() && net_name != "clk" && net_name != "rst_n" && net_name != "rst" {
                    // Only include intermediate nets (not final primary output or launch reg)
                    raw_candidates.push((net_name, last_cell.clone(), seg.total_delay_ps));
                }
            }
        }

        // If segments had no explicit "net" tagged segments (e.g. synthetic path), synthesize candidate cuts
        if raw_candidates.is_empty() {
            // Check logic levels
            let levels = path.logic_levels.max(2);
            let step_delay = total_data_delay / (levels as f32);
            for i in 1..levels {
                let delay = step_delay * (i as f32);
                raw_candidates.push((
                    format!("stage_{}_net", i),
                    format!("comb_cell_{}", i),
                    delay,
                ));
            }
        }

        let mut candidates: Vec<PipelineCutCandidate> = Vec::new();
        let mut best_idx: Option<usize> = None;
        let mut best_slack = f32::NEG_INFINITY;

        for (net_name, driver_cell, stage1_delay) in raw_candidates {
            let stage2_delay = (total_data_delay - stage1_delay).max(0.0);

            // Stage 1 Slack: Launch FF -> Pipeline Reg
            let arr_stage1 = t_skew + stage1_delay;
            let req_stage1 = period_ps - t_setup;
            let stage1_slack = req_stage1 - arr_stage1;

            // Stage 2 Slack: Pipeline Reg -> Capture FF
            let arr_stage2 = t_co + stage2_delay;
            let req_stage2 = period_ps - t_setup;
            let stage2_slack = req_stage2 - arr_stage2;

            // New worst slack is min(stage1, stage2)
            let predicted_wns = stage1_slack.min(stage2_slack);

            // New Fmax is determined by the max stage delay
            let max_stage_delay = (arr_stage1 + t_setup).max(arr_stage2 + t_setup);
            let predicted_fmax = if max_stage_delay > 0.0 {
                1_000_000.0 / max_stage_delay
            } else {
                current_fmax_mhz * 2.0
            };

            let slack_gain = predicted_wns - path.slack_ps;
            let fmax_gain = predicted_fmax - current_fmax_mhz;

            let idx = candidates.len();
            if predicted_wns > best_slack {
                best_slack = predicted_wns;
                best_idx = Some(idx);
            }

            candidates.push(PipelineCutCandidate {
                net_name,
                driver_cell,
                stage1_delay_ps: stage1_delay,
                stage2_delay_ps: stage2_delay,
                predicted_stage1_slack_ps: stage1_slack,
                predicted_stage2_slack_ps: stage2_slack,
                predicted_wns_ps: predicted_wns,
                predicted_fmax_mhz: predicted_fmax,
                slack_gain_ps: slack_gain,
                fmax_gain_mhz: fmax_gain,
                is_optimal: false,
            });
        }

        if let Some(idx) = best_idx {
            if let Some(cand) = candidates.get_mut(idx) {
                cand.is_optimal = true;
            }
        }

        let optimal_cut = best_idx.and_then(|i| candidates.get(i).cloned());

        let mut refactored_code = None;
        let mut diff_preview = None;

        if let (Some(opt), Some(src)) = (&optimal_cut, verilog_source) {
            let top_mod = &path.id;
            if let Ok((new_src, diff)) = Self::refactor_verilog(src, top_mod, &opt.net_name, &clk, rst.as_deref()) {
                refactored_code = Some(new_src);
                diff_preview = Some(diff);
            }
        }

        AutoPipelineRecommendation {
            path_id: path.id.clone(),
            startpoint: path.startpoint.clone(),
            endpoint: path.endpoint.clone(),
            clock_name: clk,
            reset_name: rst,
            target_clock_period_ps: period_ps,
            current_wns_ps: path.slack_ps,
            current_fmax_mhz,
            optimal_cut,
            candidates,
            refactored_code,
            diff_preview,
        }
    }

    /// Performs SystemVerilog AST / source text refactoring to insert a pipeline register stage.
    /// Returns (refactored_code, unified_diff).
    pub fn refactor_verilog(
        source: &str,
        _top_module: &str,
        cut_net: &str,
        clock_name: &str,
        reset_name: Option<&str>,
    ) -> Result<(String, String), String> {
        let (ast, _) = parse_hdl(FileId(0), source);

        // Find bit width of cut_net from declarations
        let mut net_width_str = String::new();
        let mut detected_clock = clock_name.to_string();
        let mut detected_reset = reset_name.map(|s| s.to_string());

        for module in &ast.modules {
            // Check ports
            for port in &module.ports {
                if port.name == cut_net {
                    if let Some(ref rng) = port.range {
                        let msb_text = &source[rng.msb.span().start as usize..rng.msb.span().end as usize];
                        let lsb_text = &source[rng.lsb.span().start as usize..rng.lsb.span().end as usize];
                        net_width_str = format!("[{}:{}] ", msb_text, lsb_text);
                    }
                }
                // Auto-detect clock if needed
                if port.name.eq_ignore_ascii_case("clk")
                    || port.name.eq_ignore_ascii_case("clock")
                    || port.name.eq_ignore_ascii_case("sys_clk")
                {
                    detected_clock = port.name.clone();
                }
                // Auto-detect reset if needed
                if detected_reset.is_none()
                    && (port.name.eq_ignore_ascii_case("rst_n")
                        || port.name.eq_ignore_ascii_case("reset_n")
                        || port.name.eq_ignore_ascii_case("rst")
                        || port.name.eq_ignore_ascii_case("reset"))
                {
                    detected_reset = Some(port.name.clone());
                }
            }

            // Check net declarations
            for item in &module.items {
                if let ModuleItem::NetDecl(decl) = item {
                    if decl.names.iter().any(|n| n == cut_net) {
                        if let Some(ref rng) = decl.range {
                            let msb_text = &source[rng.msb.span().start as usize..rng.msb.span().end as usize];
                            let lsb_text = &source[rng.lsb.span().start as usize..rng.lsb.span().end as usize];
                            net_width_str = format!("[{}:{}] ", msb_text, lsb_text);
                        }
                    }
                }
            }
        }

        // Generate the pipeline register stage code
        let rst_signal = detected_reset.as_deref().unwrap_or("rst_n");
        let is_neg_reset = rst_signal.ends_with("_n") || rst_signal.ends_with("_b");

        let reset_sens = if is_neg_reset {
            format!(" or negedge {}", rst_signal)
        } else {
            format!(" or posedge {}", rst_signal)
        };

        let reset_cond = if is_neg_reset {
            format!("!{}", rst_signal)
        } else {
            rst_signal.to_string()
        };

        let assign_pattern_simple = format!("assign {} =", cut_net);
        let assign_pattern_space = format!("assign {}  =", cut_net);

        let lines: Vec<&str> = source.lines().collect();
        let mut new_lines = Vec::new();
        let mut replaced = false;

        for line in lines {
            let trimmed = line.trim();
            // Check if this line declares wire `cut_net`
            if (trimmed.starts_with("wire ") || trimmed.starts_with("reg ") || trimmed.starts_with("logic "))
                && (trimmed.contains(&format!(" {};", cut_net))
                    || trimmed.contains(&format!(" {} ", cut_net))
                    || trimmed.ends_with(&format!(" {}", cut_net)))
                && !trimmed.contains("assign")
            {
                // Replace wire declaration with wire stage1 and reg declaration
                new_lines.push(format!("    wire {} {}_stage1;", net_width_str.trim(), cut_net));
                new_lines.push(format!("    reg {} {};", net_width_str.trim(), cut_net));
                continue;
            }

            if !replaced && (line.contains(&assign_pattern_simple) || line.contains(&assign_pattern_space)) {
                // Determine indentation
                let indent = line.chars().take_while(|c| c.is_whitespace()).collect::<String>();
                let replaced_line = line.replacen(
                    &format!("assign {} =", cut_net),
                    &format!("assign {}_stage1 =", cut_net),
                    1,
                );
                new_lines.push(replaced_line);

                // Add pipeline register process right after assignment
                new_lines.push(String::new());
                new_lines.push(format!("{indent}// Silicon Copilot: Auto-pipelined register stage for timing closure"));
                new_lines.push(format!("{indent}always @(posedge {}{}) begin", detected_clock, reset_sens));
                new_lines.push(format!("{indent}    if ({}) begin", reset_cond));
                new_lines.push(format!("{indent}        {} <= '0;", cut_net));
                new_lines.push(format!("{indent}    end else begin"));
                new_lines.push(format!("{indent}        {} <= {}_stage1;", cut_net, cut_net));
                new_lines.push(format!("{indent}    end"));
                new_lines.push(format!("{indent}end"));

                replaced = true;
            } else {
                new_lines.push(line.to_string());
            }
        }

        if !replaced {
            // Fallback pattern: append pipeline register stage at the end of the module
            let mut endmodule_found = false;
            let mut fallback_lines = Vec::new();

            for line in new_lines {
                if line.trim().starts_with("endmodule") && !endmodule_found {
                    fallback_lines.push(format!("    // Silicon Copilot: Auto-pipelined register stage for timing closure"));
                    fallback_lines.push(format!("    reg {} {}_pipe_q;", net_width_str.trim(), cut_net));
                    fallback_lines.push(format!("    always @(posedge {}{}) begin", detected_clock, reset_sens));
                    fallback_lines.push(format!("        if ({}) begin", reset_cond));
                    fallback_lines.push(format!("            {}_pipe_q <= '0;", cut_net));
                    fallback_lines.push(format!("        end else begin"));
                    fallback_lines.push(format!("            {}_pipe_q <= {};", cut_net, cut_net));
                    fallback_lines.push(format!("        end"));
                    fallback_lines.push(format!("    end\n"));
                    fallback_lines.push(line);
                    endmodule_found = true;
                } else {
                    fallback_lines.push(line);
                }
            }
            new_lines = fallback_lines;
        }

        let refactored_code = new_lines.join("\n");
        let diff_preview = generate_unified_diff(source, &refactored_code, cut_net);

        Ok((refactored_code, diff_preview))
    }
}

/// Extracts clean signal identifier from path segment label (e.g. "Net (w2)" -> "w2").
fn extract_net_name(raw: &str) -> String {
    let trimmed = raw.trim();
    if let Some(stripped) = trimmed.strip_prefix("Net (") {
        if let Some(end) = stripped.strip_suffix(')') {
            return end.trim().to_string();
        }
    }
    if let Some(stripped) = trimmed.strip_prefix("Cell (") {
        if let Some(end) = stripped.strip_suffix(')') {
            return end.trim().to_string();
        }
    }
    trimmed.to_string()
}

/// Generates a unified diff format string for visual inspection.
fn generate_unified_diff(original: &str, refactored: &str, target_net: &str) -> String {
    let orig_lines: Vec<&str> = original.lines().collect();
    let ref_lines: Vec<&str> = refactored.lines().collect();

    let n = orig_lines.len();
    let m = ref_lines.len();

    // Standard LCS DP table
    let mut dp = vec![vec![0u32; m + 1]; n + 1];
    for i in (0..n).rev() {
        for j in (0..m).rev() {
            if orig_lines[i] == ref_lines[j] {
                dp[i][j] = 1 + dp[i + 1][j + 1];
            } else {
                dp[i][j] = dp[i + 1][j].max(dp[i][j + 1]);
            }
        }
    }

    let mut diff = Vec::new();
    diff.push(format!("--- original.v (unpipelined, critical net: {})", target_net));
    diff.push("+++ refactored.v (Silicon Copilot auto-pipelined, +1 stage)".to_string());
    diff.push("@@ -timing-closure @@".to_string());

    let mut i = 0;
    let mut j = 0;
    while i < n && j < m {
        if orig_lines[i] == ref_lines[j] {
            diff.push(format!(" {}", orig_lines[i]));
            i += 1;
            j += 1;
        } else if dp[i + 1][j] >= dp[i][j + 1] {
            diff.push(format!("-{}", orig_lines[i]));
            i += 1;
        } else {
            diff.push(format!("+{}", ref_lines[j]));
            j += 1;
        }
    }

    while i < n {
        diff.push(format!("-{}", orig_lines[i]));
        i += 1;
    }

    while j < m {
        diff.push(format!("+{}", ref_lines[j]));
        j += 1;
    }

    diff.join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::PathSegment;

    #[test]
    fn test_optimal_cut_point_calculation() {
        let segments = vec![
            PathSegment {
                name: "Clock Skew (clk)".to_string(),
                segment_type: "clock".to_string(),
                delay_ps: 100.0,
                total_delay_ps: 100.0,
                fanout: 1,
                details: "".to_string(),
            },
            PathSegment {
                name: "r_a (Tco)".to_string(),
                segment_type: "cell".to_string(),
                delay_ps: 200.0,
                total_delay_ps: 300.0,
                fanout: 1,
                details: "".to_string(),
            },
            PathSegment {
                name: "Net (w1)".to_string(),
                segment_type: "net".to_string(),
                delay_ps: 300.0,
                total_delay_ps: 600.0,
                fanout: 1,
                details: "".to_string(),
            },
            PathSegment {
                name: "and1".to_string(),
                segment_type: "cell".to_string(),
                delay_ps: 500.0,
                total_delay_ps: 1100.0,
                fanout: 1,
                details: "".to_string(),
            },
            PathSegment {
                name: "Net (w2)".to_string(),
                segment_type: "net".to_string(),
                delay_ps: 300.0,
                total_delay_ps: 1400.0,
                fanout: 1,
                details: "".to_string(),
            },
            PathSegment {
                name: "or1".to_string(),
                segment_type: "cell".to_string(),
                delay_ps: 500.0,
                total_delay_ps: 1900.0,
                fanout: 1,
                details: "".to_string(),
            },
            PathSegment {
                name: "Net (w3)".to_string(),
                segment_type: "net".to_string(),
                delay_ps: 300.0,
                total_delay_ps: 2200.0,
                fanout: 1,
                details: "".to_string(),
            },
        ];

        let path = TimingPath {
            id: "crit_path".to_string(),
            startpoint: "r_a".to_string(),
            endpoint: "r_out".to_string(),
            launch_clock: "clk".to_string(),
            capture_clock: "clk".to_string(),
            slack_ps: -700.0,
            hold_slack_ps: 200.0,
            data_delay_ps: 2200.0,
            logic_delay_ps: 1200.0,
            wire_delay_ps: 1000.0,
            logic_levels: 3,
            clock_period_ps: 1500.0,
            segments,
            is_multicycle: false,
            is_false_path: false,
        };

        let rec = AutoPipeliner::analyze_path(&path, 1500.0, Some("clk"), Some("rst_n"), None);

        assert!(rec.optimal_cut.is_some());
        let opt = rec.optimal_cut.unwrap();
        assert_eq!(opt.net_name, "w2");
        assert!(opt.predicted_wns_ps > path.slack_ps);
        assert!(opt.slack_gain_ps > 0.0);
        assert!(opt.fmax_gain_mhz > 0.0);
    }

    #[test]
    fn test_verilog_refactoring_driver_shadow() {
        let verilog = r#"module test_pipe(
    input  wire clk,
    input  wire rst_n,
    input  wire [7:0] a,
    input  wire [7:0] b,
    output wire [7:0] out
);
    wire [7:0] w_sum;
    assign w_sum = a + b;
    assign out = w_sum ^ 8'hAA;
endmodule
"#;

        let (refactored, diff) = AutoPipeliner::refactor_verilog(
            verilog,
            "test_pipe",
            "w_sum",
            "clk",
            Some("rst_n"),
        ).unwrap();

        assert!(refactored.contains("wire [7:0] w_sum_stage1;"));
        assert!(refactored.contains("reg [7:0] w_sum;"));
        assert!(refactored.contains("assign w_sum_stage1 = a + b;"));
        assert!(refactored.contains("always @(posedge clk or negedge rst_n) begin"));
        assert!(refactored.contains("w_sum <= w_sum_stage1;"));
        assert!(refactored.contains("assign out = w_sum ^ 8'hAA;"));
        assert!(diff.contains("+    always @(posedge clk or negedge rst_n) begin"));
    }
}
