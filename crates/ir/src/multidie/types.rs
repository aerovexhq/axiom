use hashbrown::HashMap;
use serde::{Deserialize, Serialize};

/// Physical type of die in a multi-die system.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DieKind {
    /// Super Logic Region (SLR) on a 2.5D Stacked Silicon Interconnect (SSIT) interposer.
    SlrDie,
    /// Standalone monolithic FPGA connected across PCB / FMC.
    StandaloneFpga,
    /// Modular ASIC chiplet connected across 2.5D / 3D substrate.
    AsicChiplet,
}

/// Physical interconnect medium across a die boundary.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum InterconnectKind {
    /// Super Long Line (SLL) passive interposer track (~1,500 ps delay, ~2.5 pF).
    Sll,
    /// Laguna dedicated interface register (+1 clock cycle pipeline latency, ~350 ps delay).
    Laguna,
    /// High-speed PCB board trace (~4,000 ps delay).
    PcbTrace,
    /// Time-Division Multiplexed SerDes channel (ratio 4:1, 8:1, 16:1, K cycles latency).
    TdmSerDes,
}

/// Hardware resource capacity budget for a single die or SLR.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct DieResourceBudget {
    pub logic_cells: u64,
    pub bram_36k: u32,
    pub dsp_slices: u32,
}

/// Physical die specification in a multi-die device.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DieInfo {
    pub id: String,
    pub name: String,
    pub kind: DieKind,
    pub index: usize,
    pub budget: DieResourceBudget,
}

/// Interconnect boundary between two adjacent dies or SLRs.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DieBoundary {
    pub id: String,
    pub die_a: String,
    pub die_b: String,
    pub max_tracks: u32,
    pub interconnect_kind: InterconnectKind,
    pub propagation_delay_ps: f32,
    pub capacitance_per_track_ff: f32,
}

/// Multi-Die or multi-FPGA system specification.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MultiDieDevice {
    pub id: String,
    pub name: String,
    pub family: String,
    pub dies: Vec<DieInfo>,
    pub boundaries: Vec<DieBoundary>,
}

/// Estimated hardware resource consumption for a netlist submodule.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ModuleResourceEstimate {
    pub module_name: String,
    pub instance_name: String,
    pub logic_cells: u64,
    pub bram_blocks: u32,
    pub dsp_slices: u32,
    pub source_line: Option<u32>,
}

/// A signal net that crosses a physical die / SLR boundary.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CutNet {
    pub net_name: String,
    pub bit_width: u32,
    pub driver_module: String,
    pub driver_die: String,
    pub load_module: String,
    pub load_die: String,
    pub boundary_id: String,
    pub required_tracks: u32,
    pub latency_cycles: u32,
    pub is_laguna_pipelined: bool,
    pub estimated_delay_ps: f32,
}

/// Bandwidth utilization statistics for an inter-die boundary.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BoundaryUtilization {
    pub boundary_id: String,
    pub die_a: String,
    pub die_b: String,
    pub tracks_used: u32,
    pub tracks_capacity: u32,
    pub utilization_pct: f32,
    pub is_overflow: bool,
}

/// Hardware resource utilization statistics for a single die / SLR.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DieUtilization {
    pub die_id: String,
    pub assigned_modules: Vec<String>,
    pub logic_cells_used: u64,
    pub logic_cells_capacity: u64,
    pub logic_cells_pct: f32,
    pub brams_used: u32,
    pub brams_capacity: u32,
    pub dsps_used: u32,
    pub dsps_capacity: u32,
}

/// Configuration settings for automated or manual netlist partitioning.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PartitionConfig {
    pub target_device: String,
    pub max_die_utilization_pct: f32,
    pub user_constraints: HashMap<String, String>,
    pub enable_laguna_insertion: bool,
    pub tdm_ratio: u32,
}

impl Default for PartitionConfig {
    fn default() -> Self {
        Self {
            target_device: "xcvu9p-flgb2104-2-e".to_string(),
            max_die_utilization_pct: 85.0,
            user_constraints: HashMap::new(),
            enable_laguna_insertion: false,
            tdm_ratio: 1,
        }
    }
}

/// Complete result of multi-die / multi-FPGA partitioning.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PartitionResult {
    pub device: MultiDieDevice,
    pub die_utilization: Vec<DieUtilization>,
    pub boundary_utilization: Vec<BoundaryUtilization>,
    pub cut_nets: Vec<CutNet>,
    pub total_cut_nets: usize,
    pub total_tracks_used: u32,
    pub interposer_power_mw: f32,
    pub has_overflow: bool,
    pub warnings: Vec<String>,
}
