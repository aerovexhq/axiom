use crate::synth::FpgaFamily;
use hashbrown::HashMap;
use serde::{Deserialize, Serialize};

/// Physical FPGA Silicon Site Types.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum SiteType {
    /// Standard Logic Slice (LUTs, Flip-Flops, Multiplexers, Carry Logic).
    SliceL,
    /// Memory-Capable Logic Slice (Distributed RAM / Shift Register SRL16/SRL32 capable).
    SliceM,
    /// Multiplier / Multiply-Accumulate block (DSP48E1 / DSP48E2).
    Dsp48,
    /// 36Kb Dual-Port Block RAM (RAMB36E2 / RAMB18E2).
    Ramb36,
    /// Primary Input/Output Buffer block on silicon perimeter.
    Iob,
    /// Global Clock Buffer distribution spine (BUFG / BUFGCE).
    Bufg,
}

impl SiteType {
    pub fn display_name(&self) -> &'static str {
        match self {
            Self::SliceL => "SLICEL",
            Self::SliceM => "SLICEM",
            Self::Dsp48 => "DSP48",
            Self::Ramb36 => "RAMB36",
            Self::Iob => "IOB",
            Self::Bufg => "BUFG",
        }
    }

    pub fn max_bels(&self) -> u32 {
        match self {
            Self::SliceL | Self::SliceM => 8,
            Self::Dsp48 => 1,
            Self::Ramb36 => 1,
            Self::Iob => 2,
            Self::Bufg => 1,
        }
    }
}

/// A physical site location on the 2D FPGA silicon die fabric.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DieSite {
    pub id: String,
    pub site_type: SiteType,
    pub col: u32,
    pub row: u32,
    pub clock_region: String,
    pub occupied_bels: Vec<String>,
    pub max_bels: u32,
}

/// Standard Clock Region definition on the FPGA die.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ClockRegionDef {
    pub name: String,
    pub grid_x: u32,
    pub grid_y: u32,
    pub min_col: u32,
    pub max_col: u32,
    pub min_row: u32,
    pub max_row: u32,
}

/// A technology-mapped cell placed at a specific silicon site and BEL slot.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PlacedCell {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub site_name: String,
    pub site_type: SiteType,
    pub col: u32,
    pub row: u32,
    pub bel_slot: String,
    pub logic_delay_ps: f32,
}

/// A point-to-point transition hop along the physical critical timing path.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CriticalPathHop {
    pub hop_index: u32,
    pub source_cell: String,
    pub source_pin: String,
    pub source_site: String,
    pub source_col: u32,
    pub source_row: u32,
    pub dest_cell: String,
    pub dest_pin: String,
    pub dest_site: String,
    pub dest_col: u32,
    pub dest_row: u32,
    pub net_name: String,
    pub logic_delay_ps: f32,
    pub routing_delay_ps: f32,
    pub cumulative_delay_ps: f32,
    pub slack_ps: f32,
}

/// Full physical critical timing path with silicon placement coordinates.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PlacedCriticalPath {
    pub total_delay_ps: f32,
    pub logic_delay_ps: f32,
    pub routing_delay_ps: f32,
    pub slack_ps: f32,
    pub logic_levels: u32,
    pub hops: Vec<CriticalPathHop>,
}

/// Tile density and routing congestion metric for 2D heatmap rendering.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct HeatmapTile {
    pub col: u32,
    pub row: u32,
    pub utilization_pct: f32,
    pub congestion_score: f32,
}

/// Column definition in the FPGA fabric array.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SiteColumnDef {
    pub col_index: u32,
    pub site_type: SiteType,
}

/// Complete Physical FPGA Silicon Die Floorplan.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DieFloorplan {
    pub device_name: String,
    pub family: FpgaFamily,
    pub grid_width: u32,
    pub grid_height: u32,
    pub clock_regions: Vec<ClockRegionDef>,
    pub site_columns: Vec<SiteColumnDef>,
    pub placed_cells: HashMap<String, PlacedCell>,
    pub heatmap_tiles: Vec<HeatmapTile>,
    pub critical_path: Option<PlacedCriticalPath>,
    pub total_wirelength: f32,
}
