use crate::types::DelayPair;
use axiom_ir::PrimitiveKind;
use axiom_syntax::BinaryOp;

/// Silicon delay database for AMD 7-Series and UltraScale+ architectures.
#[derive(Debug, Clone)]
pub struct DelayModel {
    pub is_ultrascale: bool,
}

impl DelayModel {
    pub fn new(target_device: &str) -> Self {
        let is_ultrascale = target_device.to_lowercase().contains("ultrascale")
            || target_device.to_lowercase().contains("xcku")
            || target_device.to_lowercase().contains("xcvu");
        Self { is_ultrascale }
    }

    /// Clock-to-Q delay for standard flip-flops (FDRE, FDSE, etc.)
    pub fn ff_clock_to_q(&self) -> DelayPair {
        if self.is_ultrascale {
            DelayPair::new(120.0, 220.0)
        } else {
            // 7-Series (Artix-7, Kintex-7)
            DelayPair::new(140.0, 260.0)
        }
    }

    /// Flip-flop setup time requirement (ps)
    pub fn ff_setup_time(&self) -> f32 {
        if self.is_ultrascale {
            38.0
        } else {
            45.0
        }
    }

    /// Flip-flop hold time requirement (ps)
    pub fn ff_hold_time(&self) -> f32 {
        if self.is_ultrascale {
            28.0
        } else {
            35.0
        }
    }

    /// LUT propagation delay (input pin to O/O5/O6)
    pub fn lut_delay(&self, _inputs: u32) -> DelayPair {
        if self.is_ultrascale {
            DelayPair::new(50.0, 98.0)
        } else {
            DelayPair::new(62.0, 124.0)
        }
    }

    /// Carry logic stage delay per bit
    pub fn carry_delay_per_bit(&self) -> DelayPair {
        if self.is_ultrascale {
            DelayPair::new(18.0, 36.0)
        } else {
            DelayPair::new(22.0, 45.0)
        }
    }

    /// Clock buffer propagation delay (BUFG/BUFGCE)
    pub fn bufg_delay(&self) -> DelayPair {
        if self.is_ultrascale {
            DelayPair::new(35.0, 70.0)
        } else {
            DelayPair::new(45.0, 85.0)
        }
    }

    /// Estimated clock tree skew between registers on the same clock net (ps)
    pub fn clock_tree_skew(&self) -> f32 {
        if self.is_ultrascale {
            25.0
        } else {
            35.0
        }
    }

    /// Input buffer (IBUF) delay
    pub fn ibuf_delay(&self) -> DelayPair {
        if self.is_ultrascale {
            DelayPair::new(280.0, 520.0)
        } else {
            DelayPair::new(350.0, 650.0)
        }
    }

    /// Output buffer (OBUF) delay
    pub fn obuf_delay(&self) -> DelayPair {
        if self.is_ultrascale {
            DelayPair::new(480.0, 950.0)
        } else {
            DelayPair::new(600.0, 1200.0)
        }
    }

    /// Delay for known primitive kinds
    pub fn primitive_delay(&self, kind: PrimitiveKind, from_pin: &str, to_pin: &str) -> DelayPair {
        match kind {
            PrimitiveKind::Lut1
            | PrimitiveKind::Lut2
            | PrimitiveKind::Lut3
            | PrimitiveKind::Lut4
            | PrimitiveKind::Lut5
            | PrimitiveKind::Lut6
            | PrimitiveKind::Lut6_2 => self.lut_delay(6),

            PrimitiveKind::Fdre
            | PrimitiveKind::Fdse
            | PrimitiveKind::Fdce
            | PrimitiveKind::Fdpe => {
                if from_pin == "C" && to_pin == "Q" {
                    self.ff_clock_to_q()
                } else {
                    DelayPair::ZERO
                }
            }

            PrimitiveKind::Bufg | PrimitiveKind::Bufgce => self.bufg_delay(),
            PrimitiveKind::Ibuf => self.ibuf_delay(),
            PrimitiveKind::Obuf => self.obuf_delay(),

            PrimitiveKind::Dsp48e2 | PrimitiveKind::Dsp48e1 => {
                if from_pin == "CLK" && to_pin == "P" {
                    // Registered P output
                    if self.is_ultrascale {
                        DelayPair::new(180.0, 320.0)
                    } else {
                        DelayPair::new(220.0, 380.0)
                    }
                } else {
                    // Combinational multiplier / ALU through DSP
                    if self.is_ultrascale {
                        DelayPair::new(750.0, 1550.0)
                    } else {
                        DelayPair::new(900.0, 1850.0)
                    }
                }
            }

            PrimitiveKind::Ramb36e2 | PrimitiveKind::Ramb18e2 => {
                if from_pin.contains("CLK") {
                    if self.is_ultrascale {
                        DelayPair::new(380.0, 820.0)
                    } else {
                        DelayPair::new(450.0, 980.0)
                    }
                } else {
                    DelayPair::ZERO
                }
            }

            PrimitiveKind::Carry4 => {
                let stages = 4.0;
                let single = self.carry_delay_per_bit();
                DelayPair::new(single.min_ps * stages, single.max_ps * stages)
            }
            PrimitiveKind::Carry8 => {
                let stages = 8.0;
                let single = self.carry_delay_per_bit();
                DelayPair::new(single.min_ps * stages, single.max_ps * stages)
            }
        }
    }

    /// Delay for Verilog binary operations mapped to FPGA logic
    pub fn binary_op_delay(&self, op: BinaryOp, bit_width: u32) -> DelayPair {
        match op {
            BinaryOp::Add | BinaryOp::Sub => {
                // LUT + Carry chain
                let lut = self.lut_delay(2);
                let carry = self.carry_delay_per_bit();
                let carry_stages = (bit_width.max(1) as f32).min(64.0);
                DelayPair::new(
                    lut.min_ps + carry.min_ps * carry_stages,
                    lut.max_ps + carry.max_ps * carry_stages,
                )
            }
            BinaryOp::Mul => {
                // If small width (<= 4), can be LUTs, otherwise uses DSP
                if bit_width <= 4 {
                    let lut = self.lut_delay(6);
                    DelayPair::new(lut.min_ps * 3.0, lut.max_ps * 3.0)
                } else {
                    self.primitive_delay(PrimitiveKind::Dsp48e2, "A", "P")
                }
            }
            BinaryOp::Div | BinaryOp::Mod => {
                // Iterative division / non-restoring divider ~ N stages
                let lut = self.lut_delay(4);
                let carry = self.carry_delay_per_bit();
                let stages = (bit_width.max(1) as f32).min(32.0);
                DelayPair::new(
                    lut.min_ps * stages + carry.min_ps * stages,
                    lut.max_ps * stages + carry.max_ps * stages,
                )
            }
            BinaryOp::BitAnd
            | BinaryOp::BitOr
            | BinaryOp::BitXor
            | BinaryOp::BitXnor => self.lut_delay(2),

            BinaryOp::LogicAnd | BinaryOp::LogicOr => self.lut_delay(4),

            BinaryOp::Eq
            | BinaryOp::Neq
            | BinaryOp::CaseEq
            | BinaryOp::CaseNeq
            | BinaryOp::Lt
            | BinaryOp::LtEq
            | BinaryOp::Gt
            | BinaryOp::GtEq => {
                let lut = self.lut_delay(4);
                let carry = self.carry_delay_per_bit();
                let stages = bit_width.div_ceil(4) as f32;
                DelayPair::new(
                    lut.min_ps + carry.min_ps * stages,
                    lut.max_ps + carry.max_ps * stages,
                )
            }

            BinaryOp::Shl
            | BinaryOp::Shr
            | BinaryOp::ShlArith
            | BinaryOp::ShrArith => {
                // Barrel shifter mapped to 1-3 LUT levels
                let levels = if bit_width <= 8 { 1.0 } else { 2.0 };
                let lut = self.lut_delay(4);
                DelayPair::new(lut.min_ps * levels, lut.max_ps * levels)
            }
        }
    }

    /// Wire load model: logarithmic scaling with fanout
    /// d_wire = 25ps + 12ps * log2(max(1, fanout))
    pub fn wire_delay(&self, fanout: u32) -> DelayPair {
        let fo = fanout.max(1) as f32;
        let log_fo = fo.log2();
        let max_ps = 25.0 + 12.0 * log_fo;
        let min_ps = max_ps * 0.55; // Fast corner is ~55% of slow corner
        DelayPair::new(min_ps, max_ps)
    }

    /// Interposer Super Long Line (SLL) boundary crossing delay.
    /// Traverses silicon micro-bumps and interposer metal track.
    pub fn sll_crossing_delay(&self) -> DelayPair {
        DelayPair::new(950.0, 1500.0)
    }

    /// Laguna pipeline interface register delay.
    /// Insertion of a Laguna flip-flop breaks the combinational path into a 1-cycle pipeline.
    pub fn laguna_reg_delay(&self) -> DelayPair {
        DelayPair::new(200.0, 350.0)
    }

    /// Inter-chip PCB trace / FMC cable delay.
    pub fn pcb_trace_delay(&self) -> DelayPair {
        DelayPair::new(2500.0, 4500.0)
    }
}
