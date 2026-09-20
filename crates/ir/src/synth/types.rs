use crate::bir::PrimitiveKind;
use axiom_syntax::PortDirection;
use hashbrown::HashMap;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum SynthError {
    #[error("Target FPGA device '{0}' is not supported")]
    UnsupportedDevice(String),
    #[error("Circuit has no ports or logic to synthesize")]
    EmptyCircuit,
    #[error("Failed to map boolean logic for net '{0}': {1}")]
    MappingError(String, String),
}

/// Target FPGA Silicon Families with distinct technology mapping rules.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum FpgaFamily {
    Artix7,
    Kintex7,
    Virtex7,
    Zynq7000,
    UltraScalePlus,
    VirtualSilicon,
}

impl FpgaFamily {
    pub fn from_device_name(device: &str) -> Self {
        let dev = device.to_lowercase();
        if dev.starts_with("xc7a") {
            Self::Artix7
        } else if dev.starts_with("xc7k") {
            Self::Kintex7
        } else if dev.starts_with("xc7v") {
            Self::Virtex7
        } else if dev.starts_with("xc7z") {
            Self::Zynq7000
        } else if dev.starts_with("xcku") || dev.starts_with("xcvu") {
            Self::UltraScalePlus
        } else {
            Self::VirtualSilicon
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            Self::Artix7 => "Artix-7",
            Self::Kintex7 => "Kintex-7",
            Self::Virtex7 => "Virtex-7",
            Self::Zynq7000 => "Zynq-7000",
            Self::UltraScalePlus => "Kintex/Virtex UltraScale+",
            Self::VirtualSilicon => "Axiom Virtual Silicon",
        }
    }

    pub fn supports_carry8(&self) -> bool {
        matches!(self, Self::UltraScalePlus)
    }

    pub fn lut_capacity(&self) -> u64 {
        match self {
            Self::Artix7 => 63_400,
            Self::Kintex7 => 203_800,
            Self::Virtex7 => 257_600,
            Self::Zynq7000 => 53_200,
            Self::UltraScalePlus => 216_960,
            Self::VirtualSilicon => 100_000,
        }
    }

    pub fn ff_capacity(&self) -> u64 {
        match self {
            Self::Artix7 => 126_800,
            Self::Kintex7 => 407_600,
            Self::Virtex7 => 515_200,
            Self::Zynq7000 => 106_400,
            Self::UltraScalePlus => 433_920,
            Self::VirtualSilicon => 200_000,
        }
    }
}

/// Synthesis and technology mapping configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SynthConfig {
    pub target_device: String,
    pub target_family: FpgaFamily,
    pub flatten_hierarchy: bool,
    pub optimize_constants: bool,
}

impl Default for SynthConfig {
    fn default() -> Self {
        Self {
            target_device: "xcku5p-ffvb676-2-e".to_string(),
            target_family: FpgaFamily::UltraScalePlus,
            flatten_hierarchy: true,
            optimize_constants: true,
        }
    }
}

impl SynthConfig {
    pub fn for_device(device: &str) -> Self {
        let family = FpgaFamily::from_device_name(device);
        Self {
            target_device: device.to_string(),
            target_family: family,
            flatten_hierarchy: true,
            optimize_constants: true,
        }
    }
}

/// Primary top-level I/O port of the synthesized circuit.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SynthesizedPort {
    pub name: String,
    pub direction: PortDirection,
    pub width: u32,
    pub is_clock: bool,
    pub is_reset: bool,
}

/// Mapped physical FPGA primitive cell instance.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SynthesizedCell {
    pub id: String,
    pub name: String,
    pub kind: PrimitiveKind,
    pub scope: String,
    /// Formal pin name -> connected net name (e.g. "I0" -> "A_ibuf", "O" -> "w1")
    pub ports: HashMap<String, String>,
    /// Primitive parameters (e.g. "INIT" -> 0x8)
    pub params: HashMap<String, u64>,
    /// Boolean logic equation (for LUTs, e.g. "O = (I0 & ~I1) | I2")
    pub equation: Option<String>,
    pub source_line: Option<u32>,
    pub delay_ps: f32,
}

/// Interconnect wire in the synthesized netlist.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SynthesizedNet {
    pub name: String,
    pub width: u32,
    pub driver_cell: Option<String>,
    pub driver_pin: Option<String>,
    pub load_cells: Vec<(String, String)>, // (cell_id, pin_name)
    pub is_clock: bool,
    pub is_reset: bool,
}

/// Synthesis resource utilization and performance metrics.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SynthesisStats {
    pub lut1_count: u32,
    pub lut2_count: u32,
    pub lut3_count: u32,
    pub lut4_count: u32,
    pub lut5_count: u32,
    pub lut6_count: u32,
    pub lut6_2_count: u32,
    pub total_luts: u32,

    pub fdre_count: u32,
    pub fdce_count: u32,
    pub total_ffs: u32,

    pub carry4_count: u32,
    pub carry8_count: u32,
    pub total_carries: u32,

    pub ibuf_count: u32,
    pub obuf_count: u32,
    pub bufg_count: u32,
    pub total_iobs: u32,

    pub dsp_count: u32,
    pub bram_count: u32,
    pub total_cells: u32,

    pub target_lut_capacity: u64,
    pub target_ff_capacity: u64,
    pub lut_utilization_pct: f32,
    pub ff_utilization_pct: f32,

    pub logic_depth: u32,
    pub estimated_delay_ps: f32,
}

/// Complete synthesized gate-level hardware netlist.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SynthesizedCircuit {
    pub top_module: String,
    pub target_device: String,
    pub target_family: FpgaFamily,
    pub ports: Vec<SynthesizedPort>,
    pub cells: Vec<SynthesizedCell>,
    pub nets: Vec<SynthesizedNet>,
    pub stats: SynthesisStats,
}
