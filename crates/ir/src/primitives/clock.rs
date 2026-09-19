use crate::bir::*;
use axiom_core::LogicVector;
use axiom_syntax::BinaryOp;
use hashbrown::HashMap;

pub fn elaborate_clock(
    kind: PrimitiveKind,
    _inst_name: &str,
    _scope_prefix: &str,
    circuit: &mut BirCircuit,
    port_nets: &HashMap<String, NetId>,
    params: &HashMap<String, u64>,
) {
    match kind {
        PrimitiveKind::Bufg | PrimitiveKind::Ibuf | PrimitiveKind::Obuf => {
            if let (Some(&i), Some(&o)) = (port_nets.get("I"), port_nets.get("O")) {
                circuit.add_continuous_assign(o, BirExpr::Net(i));
            }
        }
        PrimitiveKind::Bufgce => {
            if let (Some(&i), Some(&ce), Some(&o)) = (
                port_nets.get("I"),
                port_nets.get("CE"),
                port_nets.get("O"),
            ) {
                let is_ce_inv = params.get("IS_CE_INVERTED").copied().unwrap_or(0) != 0;
                let is_i_inv = params.get("IS_I_INVERTED").copied().unwrap_or(0) != 0;

                let i_expr = if is_i_inv {
                    BirExpr::Binary {
                        op: BinaryOp::BitXor,
                        lhs: Box::new(BirExpr::Net(i)),
                        rhs: Box::new(BirExpr::Const(LogicVector::from_u64(1, 1))),
                    }
                } else {
                    BirExpr::Net(i)
                };

                let ce_expr = if is_ce_inv {
                    BirExpr::Binary {
                        op: BinaryOp::BitXor,
                        lhs: Box::new(BirExpr::Net(ce)),
                        rhs: Box::new(BirExpr::Const(LogicVector::from_u64(1, 1))),
                    }
                } else {
                    BirExpr::Net(ce)
                };

                let gated_expr = BirExpr::Binary {
                    op: BinaryOp::BitAnd,
                    lhs: Box::new(i_expr),
                    rhs: Box::new(ce_expr),
                };

                circuit.add_continuous_assign(o, gated_expr);
            }
        }
        _ => {}
    }
}
