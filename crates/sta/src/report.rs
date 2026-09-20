use crate::types::SlackRadarSummary;

/// Generate standard Vivado-style ASCII text report (`report_timing_summary`).
pub fn format_ascii_report(summary: &SlackRadarSummary, top_name: &str, target_device: &str) -> String {
    let mut out = String::new();

    out.push_str("------------------------------------------------------------------------------------\n");
    out.push_str("| Tool Version : Axiom EDA v0.1.0-jit (High-Performance Rust Remake)              |\n");
    out.push_str(&format!("| Design       : {:<67} |\n", top_name));
    out.push_str(&format!("| Device       : {:<67} |\n", target_device));
    out.push_str("------------------------------------------------------------------------------------\n\n");

    out.push_str("Timing Summary\n");
    out.push_str("--------------\n");
    out.push_str("Setup (Max at Slow Process Corner):\n");
    out.push_str(&format!(
        "  Worst Negative Slack (WNS): {:>8.3} ns\n",
        summary.worst_negative_slack_ps / 1000.0
    ));
    out.push_str(&format!(
        "  Total Negative Slack (TNS): {:>8.3} ns\n",
        summary.total_negative_slack_ps / 1000.0
    ));
    out.push_str(&format!("  Number of Failing Endpoints: {:>4}\n", summary.histogram[0].count));
    out.push_str(&format!("  Total Number of Endpoints  : {:>4}\n\n", summary.all_paths.len()));

    out.push_str("Hold (Min at Fast Process Corner):\n");
    out.push_str(&format!(
        "  Worst Hold Slack     (WHS): {:>8.3} ns\n",
        summary.worst_hold_slack_ps / 1000.0
    ));
    out.push_str(&format!(
        "  Total Hold Slack     (THS): {:>8.3} ns\n",
        summary.total_hold_slack_ps / 1000.0
    ));
    out.push_str(&format!("  Achievable Fmax            : {:>8.2} MHz\n\n", summary.fmax_mhz));

    out.push_str("Max Delay Path Details (Critical Path)\n");
    out.push_str("--------------------------------------\n");
    out.push_str(&format!("  Slack       : {:>8.3} ns ({})\n",
        summary.critical_path.slack_ps / 1000.0,
        if summary.critical_path.slack_ps >= 0.0 { "MET" } else { "VIOLATED" }
    ));
    out.push_str(&format!("  Source      : {}\n", summary.critical_path.startpoint));
    out.push_str(&format!("  Destination : {}\n", summary.critical_path.endpoint));
    out.push_str(&format!("  Data Path   : {:>8.3} ns (Logic: {:.1}%, Wire: {:.1}%)\n",
        summary.critical_path.data_delay_ps / 1000.0,
        summary.logic_delay_percent,
        summary.wire_delay_percent
    ));
    out.push_str(&format!("  Logic Depth : {} levels\n\n", summary.logic_levels));

    out.push_str("  Delay (ps)    Total (ps)  Type   Fanout  Location / Element\n");
    out.push_str("  ------------------------------------------------------------------------\n");
    for seg in &summary.critical_path.segments {
        out.push_str(&format!(
            "  {:>10.1}    {:>10.1}  {:<5}  {:>6}  {} ({})\n",
            seg.delay_ps,
            seg.total_delay_ps,
            seg.segment_type,
            seg.fanout,
            seg.name,
            seg.details
        ));
    }
    out.push_str("  ------------------------------------------------------------------------\n\n");

    if !summary.cdc_crossings.is_empty() {
        out.push_str("Clock Domain Crossings (CDC)\n");
        out.push_str("----------------------------\n");
        out.push_str("  Src Clock  Dest Clock  Source Reg          Dest Reg            Status       Stages\n");
        out.push_str("  ----------------------------------------------------------------------------------\n");
        for cdc in &summary.cdc_crossings {
            let status = match cdc.classification {
                crate::types::CdcClassification::Safe => "SAFE",
                crate::types::CdcClassification::Hazard => "HAZARD",
                crate::types::CdcClassification::Constrained => "CONSTRAINED",
            };
            out.push_str(&format!(
                "  {:<9}  {:<10}  {:<18}  {:<18}  {:<11}  {:>6}\n",
                cdc.source_clk, cdc.dest_clk, cdc.source_reg, cdc.dest_reg, status, cdc.stages
            ));
        }
        out.push_str("  ----------------------------------------------------------------------------------\n");
    }

    out
}
