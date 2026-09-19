use crate::bir::*;
use axiom_core::LogicVector;
use axiom_syntax::BinaryOp;
use hashbrown::HashMap;

pub fn elaborate_lut(
    kind: PrimitiveKind,
    inst_name: &str,
    scope_prefix: &str,
    circuit: &mut BirCircuit,
    port_nets: &HashMap<String, NetId>,
    params: &HashMap<String, u64>,
) {
    let init = params.get("INIT").copied().unwrap_or(0);
    let dummy_zero = circuit.add_net(format!("{scope_prefix}.{inst_name}._zero"), 1, LogicVector::zeros(1));
    let get_net = |name: &str| port_nets.get(name).copied().unwrap_or(dummy_zero);
    let one_const = BirExpr::Const(LogicVector::from_u64(1, 1));

    match kind {
        PrimitiveKind::Lut6_2 => {
            let i0 = get_net("I0");
            let i1 = get_net("I1");
            let i2 = get_net("I2");
            let i3 = get_net("I3");
            let i4 = get_net("I4");
            let i5 = get_net("I5");

            let init_const = BirExpr::Const(LogicVector::from_u64(init, 64));

            if let Some(&o6) = port_nets.get("O6") {
                let idx6 = BirExpr::Concat(vec![
                    BirExpr::Net(i5),
                    BirExpr::Net(i4),
                    BirExpr::Net(i3),
                    BirExpr::Net(i2),
                    BirExpr::Net(i1),
                    BirExpr::Net(i0),
                ]);
                let expr_o6 = BirExpr::Binary {
                    op: BinaryOp::BitAnd,
                    lhs: Box::new(BirExpr::Binary {
                        op: BinaryOp::Shr,
                        lhs: Box::new(init_const.clone()),
                        rhs: Box::new(idx6),
                    }),
                    rhs: Box::new(one_const.clone()),
                };
                circuit.add_continuous_assign(o6, expr_o6);
            }

            if let Some(&o5) = port_nets.get("O5") {
                let idx5 = BirExpr::Concat(vec![
                    BirExpr::Net(dummy_zero),
                    BirExpr::Net(i4),
                    BirExpr::Net(i3),
                    BirExpr::Net(i2),
                    BirExpr::Net(i1),
                    BirExpr::Net(i0),
                ]);
                let expr_o5 = BirExpr::Binary {
                    op: BinaryOp::BitAnd,
                    lhs: Box::new(BirExpr::Binary {
                        op: BinaryOp::Shr,
                        lhs: Box::new(init_const),
                        rhs: Box::new(idx5),
                    }),
                    rhs: Box::new(one_const),
                };
                circuit.add_continuous_assign(o5, expr_o5);
            }
        }
        PrimitiveKind::Lut6 => {
            if let Some(&o) = port_nets.get("O") {
                let idx = BirExpr::Concat(vec![
                    BirExpr::Net(get_net("I5")),
                    BirExpr::Net(get_net("I4")),
                    BirExpr::Net(get_net("I3")),
                    BirExpr::Net(get_net("I2")),
                    BirExpr::Net(get_net("I1")),
                    BirExpr::Net(get_net("I0")),
                ]);
                let expr = BirExpr::Binary {
                    op: BinaryOp::BitAnd,
                    lhs: Box::new(BirExpr::Binary {
                        op: BinaryOp::Shr,
                        lhs: Box::new(BirExpr::Const(LogicVector::from_u64(init, 64))),
                        rhs: Box::new(idx),
                    }),
                    rhs: Box::new(one_const),
                };
                circuit.add_continuous_assign(o, expr);
            }
        }
        PrimitiveKind::Lut5 => {
            if let Some(&o) = port_nets.get("O") {
                let idx = BirExpr::Concat(vec![
                    BirExpr::Net(get_net("I4")),
                    BirExpr::Net(get_net("I3")),
                    BirExpr::Net(get_net("I2")),
                    BirExpr::Net(get_net("I1")),
                    BirExpr::Net(get_net("I0")),
                ]);
                let expr = BirExpr::Binary {
                    op: BinaryOp::BitAnd,
                    lhs: Box::new(BirExpr::Binary {
                        op: BinaryOp::Shr,
                        lhs: Box::new(BirExpr::Const(LogicVector::from_u64(init, 32))),
                        rhs: Box::new(idx),
                    }),
                    rhs: Box::new(one_const),
                };
                circuit.add_continuous_assign(o, expr);
            }
        }
        PrimitiveKind::Lut4 => {
            if let Some(&o) = port_nets.get("O") {
                let idx = BirExpr::Concat(vec![
                    BirExpr::Net(get_net("I3")),
                    BirExpr::Net(get_net("I2")),
                    BirExpr::Net(get_net("I1")),
                    BirExpr::Net(get_net("I0")),
                ]);
                let expr = BirExpr::Binary {
                    op: BinaryOp::BitAnd,
                    lhs: Box::new(BirExpr::Binary {
                        op: BinaryOp::Shr,
                        lhs: Box::new(BirExpr::Const(LogicVector::from_u64(init, 16))),
                        rhs: Box::new(idx),
                    }),
                    rhs: Box::new(one_const),
                };
                circuit.add_continuous_assign(o, expr);
            }
        }
        PrimitiveKind::Lut3 => {
            if let Some(&o) = port_nets.get("O") {
                let idx = BirExpr::Concat(vec![
                    BirExpr::Net(get_net("I2")),
                    BirExpr::Net(get_net("I1")),
                    BirExpr::Net(get_net("I0")),
                ]);
                let expr = BirExpr::Binary {
                    op: BinaryOp::BitAnd,
                    lhs: Box::new(BirExpr::Binary {
                        op: BinaryOp::Shr,
                        lhs: Box::new(BirExpr::Const(LogicVector::from_u64(init, 8))),
                        rhs: Box::new(idx),
                    }),
                    rhs: Box::new(one_const),
                };
                circuit.add_continuous_assign(o, expr);
            }
        }
        PrimitiveKind::Lut2 => {
            if let Some(&o) = port_nets.get("O") {
                let idx = BirExpr::Concat(vec![
                    BirExpr::Net(get_net("I1")),
                    BirExpr::Net(get_net("I0")),
                ]);
                let expr = BirExpr::Binary {
                    op: BinaryOp::BitAnd,
                    lhs: Box::new(BirExpr::Binary {
                        op: BinaryOp::Shr,
                        lhs: Box::new(BirExpr::Const(LogicVector::from_u64(init, 4))),
                        rhs: Box::new(idx),
                    }),
                    rhs: Box::new(one_const),
                };
                circuit.add_continuous_assign(o, expr);
            }
        }
        PrimitiveKind::Lut1 => {
            if let Some(&o) = port_nets.get("O") {
                let idx = BirExpr::Net(get_net("I0"));
                let expr = BirExpr::Binary {
                    op: BinaryOp::BitAnd,
                    lhs: Box::new(BirExpr::Binary {
                        op: BinaryOp::Shr,
                        lhs: Box::new(BirExpr::Const(LogicVector::from_u64(init, 2))),
                        rhs: Box::new(idx),
                    }),
                    rhs: Box::new(one_const),
                };
                circuit.add_continuous_assign(o, expr);
            }
        }
        _ => {}
    }
}
