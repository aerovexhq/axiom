use serde::{Deserialize, Serialize};

/// Definition of a primary clock constraint (`create_clock`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClockConstraint {
    pub name: String,
    pub period_ps: f32,
    pub port_or_pin: String,
    pub waveform_rise_ps: f32,
    pub waveform_fall_ps: f32,
}

/// Definition of an internally generated clock (`create_generated_clock`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedClockConstraint {
    pub name: String,
    pub source_clock: String,
    pub divide_by: u32,
    pub multiply_by: u32,
    pub pin: String,
}

/// Input or output port delay relative to a reference clock.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IoDelayConstraint {
    pub is_input: bool,
    pub clock_name: String,
    pub delay_ps: f32,
    pub is_max: bool,
    pub port_name: String,
}

/// False path timing exception (`set_false_path`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FalsePathConstraint {
    pub from: Option<String>,
    pub to: Option<String>,
    pub through: Option<String>,
}

/// Multi-cycle path multiplier (`set_multicycle_path`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MulticycleConstraint {
    pub multiplier: u32,
    pub is_setup: bool,
    pub from: Option<String>,
    pub to: Option<String>,
}

/// Asynchronous or mutually exclusive clock groups (`set_clock_groups`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClockGroupsConstraint {
    pub is_asynchronous: bool,
    pub groups: Vec<Vec<String>>,
}

/// Maximum or minimum path delay override (`set_max_delay`, `set_min_delay`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DelayConstraint {
    pub is_max: bool,
    pub delay_ps: f32,
    pub from: Option<String>,
    pub to: Option<String>,
}

/// Aggregated set of all parsed timing constraints for a design.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TimingConstraints {
    pub clocks: Vec<ClockConstraint>,
    pub generated_clocks: Vec<GeneratedClockConstraint>,
    pub io_delays: Vec<IoDelayConstraint>,
    pub false_paths: Vec<FalsePathConstraint>,
    pub multicycle_paths: Vec<MulticycleConstraint>,
    pub clock_groups: Vec<ClockGroupsConstraint>,
    pub delay_overrides: Vec<DelayConstraint>,
}

impl TimingConstraints {
    pub fn new() -> Self {
        Self::default()
    }

    /// Check if a path from `from_node` to `to_node` is marked as a false path.
    pub fn is_false_path(&self, from_node: &str, to_node: &str, through_node: Option<&str>) -> bool {
        for fp in &self.false_paths {
            let from_matches = fp.from.as_ref().map_or(true, |p| pattern_matches(p, from_node));
            let to_matches = fp.to.as_ref().map_or(true, |p| pattern_matches(p, to_node));
            let through_matches = match (&fp.through, through_node) {
                (Some(p), Some(th)) => pattern_matches(p, th),
                (Some(_), None) => false,
                (None, _) => true,
            };

            if from_matches && to_matches && through_matches {
                return true;
            }
        }
        false
    }

    /// Check if two clock domains are defined as asynchronous clock groups.
    pub fn are_clocks_asynchronous(&self, clk_a: &str, clk_b: &str) -> bool {
        if clk_a == clk_b {
            return false;
        }
        for cg in &self.clock_groups {
            if !cg.is_asynchronous {
                continue;
            }
            // Check if clk_a is in one group and clk_b is in a different group
            let mut group_a = None;
            let mut group_b = None;
            for (idx, group) in cg.groups.iter().enumerate() {
                if group.iter().any(|c| pattern_matches(c, clk_a)) {
                    group_a = Some(idx);
                }
                if group.iter().any(|c| pattern_matches(c, clk_b)) {
                    group_b = Some(idx);
                }
            }
            if let (Some(ga), Some(gb)) = (group_a, group_b) {
                if ga != gb {
                    return true;
                }
            }
        }
        false
    }

    /// Get multi-cycle setup multiplier between two endpoints (default is 1).
    pub fn get_setup_multicycle(&self, from_node: &str, to_node: &str) -> u32 {
        for mc in &self.multicycle_paths {
            if !mc.is_setup {
                continue;
            }
            let from_matches = mc.from.as_ref().map_or(true, |p| pattern_matches(p, from_node));
            let to_matches = mc.to.as_ref().map_or(true, |p| pattern_matches(p, to_node));
            if from_matches && to_matches {
                return mc.multiplier;
            }
        }
        1
    }

    /// Get multi-cycle hold multiplier between two endpoints (default is 0).
    pub fn get_hold_multicycle(&self, from_node: &str, to_node: &str) -> u32 {
        for mc in &self.multicycle_paths {
            if mc.is_setup {
                continue;
            }
            let from_matches = mc.from.as_ref().map_or(true, |p| pattern_matches(p, from_node));
            let to_matches = mc.to.as_ref().map_or(true, |p| pattern_matches(p, to_node));
            if from_matches && to_matches {
                return mc.multiplier;
            }
        }
        0
    }

    /// Find primary clock constraint matching clock name or port name.
    pub fn find_clock(&self, clk_name: &str) -> Option<&ClockConstraint> {
        self.clocks.iter().find(|c| {
            c.name == clk_name || c.port_or_pin == clk_name || pattern_matches(&c.port_or_pin, clk_name)
        })
    }
}

/// Simple glob-style pattern matching with `*` and `?`.
pub fn pattern_matches(pattern: &str, text: &str) -> bool {
    if pattern == "*" || pattern == text {
        return true;
    }
    // Also check leaf match: e.g. pattern "q2" matches "reg_d:q2" or "foo/q2"
    if let Some((_, leaf)) = text.rsplit_once(':') {
        if leaf == pattern {
            return true;
        }
    }
    if let Some((_, leaf)) = text.rsplit_once('/') {
        if leaf == pattern {
            return true;
        }
    }
    // Simple wildcard matching
    let parts: Vec<&str> = pattern.split('*').collect();
    if parts.len() == 1 {
        return pattern == text;
    }

    let mut remainder = text;
    for (i, part) in parts.iter().enumerate() {
        if part.is_empty() {
            continue;
        }
        if i == 0 {
            if !remainder.starts_with(part) {
                return false;
            }
            remainder = &remainder[part.len()..];
        } else if i == parts.len() - 1 {
            return remainder.ends_with(part);
        } else {
            if let Some(pos) = remainder.find(part) {
                remainder = &remainder[pos + part.len()..];
            } else {
                return false;
            }
        }
    }
    true
}
