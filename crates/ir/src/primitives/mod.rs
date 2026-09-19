pub mod lut;
pub mod clock;
pub mod seq;
pub mod dsp;
pub mod bram;

pub use lut::*;
pub use clock::*;
pub use seq::*;
pub use dsp::*;
pub use bram::*;

use crate::bir::PrimitiveKind;
use axiom_syntax::PortDirection;

#[derive(Debug, Clone)]
pub struct PrimitivePortSpec {
    pub name: &'static str,
    pub direction: PortDirection,
    pub width: u32,
    pub is_clock: bool,
    pub is_reset: bool,
}

#[derive(Debug, Clone)]
pub struct PrimitiveParamSpec {
    pub name: &'static str,
    pub default_val: u64,
}

pub struct PrimitiveCatalog;

impl PrimitiveCatalog {
    pub fn lookup(name: &str) -> Option<PrimitiveKind> {
        let upper = name.to_ascii_uppercase();
        match upper.as_str() {
            "LUT6_2" => Some(PrimitiveKind::Lut6_2),
            "LUT6" => Some(PrimitiveKind::Lut6),
            "LUT5" => Some(PrimitiveKind::Lut5),
            "LUT4" => Some(PrimitiveKind::Lut4),
            "LUT3" => Some(PrimitiveKind::Lut3),
            "LUT2" => Some(PrimitiveKind::Lut2),
            "LUT1" => Some(PrimitiveKind::Lut1),
            "BUFG" => Some(PrimitiveKind::Bufg),
            "BUFGCE" => Some(PrimitiveKind::Bufgce),
            "IBUF" => Some(PrimitiveKind::Ibuf),
            "OBUF" => Some(PrimitiveKind::Obuf),
            "FDRE" => Some(PrimitiveKind::Fdre),
            "FDSE" => Some(PrimitiveKind::Fdse),
            "FDCE" => Some(PrimitiveKind::Fdce),
            "FDPE" => Some(PrimitiveKind::Fdpe),
            "DSP48E2" => Some(PrimitiveKind::Dsp48e2),
            "DSP48E1" => Some(PrimitiveKind::Dsp48e1),
            "RAMB36E2" => Some(PrimitiveKind::Ramb36e2),
            "RAMB18E2" => Some(PrimitiveKind::Ramb18e2),
            "CARRY4" => Some(PrimitiveKind::Carry4),
            "CARRY8" => Some(PrimitiveKind::Carry8),
            _ => None,
        }
    }

    pub fn is_primitive(name: &str) -> bool {
        Self::lookup(name).is_some()
    }
}
