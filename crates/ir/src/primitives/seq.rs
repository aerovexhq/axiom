use crate::bir::*;
use axiom_core::LogicVector;
use axiom_syntax::{BinaryOp, EdgeKind};
use hashbrown::HashMap;

pub fn elaborate_seq(
    kind: PrimitiveKind,
    inst_name: &str,
    scope_prefix: &str,
    circuit: &mut BirCircuit,
    port_nets: &HashMap<String, NetId>,
    params: &HashMap<String, u64>,
) {
    let dummy_zero = circuit.add_net(format!("{scope_prefix}.{inst_name}._zero"), 1, LogicVector::zeros(1));
    let dummy_one = circuit.add_net(format!("{scope_prefix}.{inst_name}._one"), 1, LogicVector::from_u64(1, 1));
    let get_net_or_one = |name: &str| port_nets.get(name).copied().unwrap_or(dummy_one);
    let get_net_or_zero = |name: &str| port_nets.get(name).copied().unwrap_or(dummy_zero);

    match kind {
        PrimitiveKind::Fdre => {
            if let (Some(&c), Some(&d), Some(&q)) = (
                port_nets.get("C"),
                port_nets.get("D"),
                port_nets.get("Q"),
            ) {
                let ce = get_net_or_one("CE");
                let r = get_net_or_zero("R");
                let _init = params.get("INIT").copied().unwrap_or(0);

                let body = vec![
                    BirStatement::If {
                        cond: BirExpr::Net(r),
                        then_body: vec![BirStatement::Assign {
                            target: q,
                            expr: BirExpr::Const(LogicVector::from_u64(0, 1)),
                            is_nonblocking: true,
                        }],
                        else_body: vec![BirStatement::If {
                            cond: BirExpr::Net(ce),
                            then_body: vec![BirStatement::Assign {
                                target: q,
                                expr: BirExpr::Net(d),
                                is_nonblocking: true,
                            }],
                            else_body: Vec::new(),
                        }],
                    },
                ];

                circuit.add_process(
                    format!("{scope_prefix}.{inst_name}"),
                    BirProcessKind::Clocked,
                    vec![BirTrigger { net: c, edge: EdgeKind::Posedge }],
                    body,
                );
            }
        }
        PrimitiveKind::Fdse => {
            if let (Some(&c), Some(&d), Some(&q)) = (
                port_nets.get("C"),
                port_nets.get("D"),
                port_nets.get("Q"),
            ) {
                let ce = get_net_or_one("CE");
                let s = get_net_or_zero("S");

                let body = vec![
                    BirStatement::If {
                        cond: BirExpr::Net(s),
                        then_body: vec![BirStatement::Assign {
                            target: q,
                            expr: BirExpr::Const(LogicVector::from_u64(1, 1)),
                            is_nonblocking: true,
                        }],
                        else_body: vec![BirStatement::If {
                            cond: BirExpr::Net(ce),
                            then_body: vec![BirStatement::Assign {
                                target: q,
                                expr: BirExpr::Net(d),
                                is_nonblocking: true,
                            }],
                            else_body: Vec::new(),
                        }],
                    },
                ];

                circuit.add_process(
                    format!("{scope_prefix}.{inst_name}"),
                    BirProcessKind::Clocked,
                    vec![BirTrigger { net: c, edge: EdgeKind::Posedge }],
                    body,
                );
            }
        }
        PrimitiveKind::Fdce => {
            if let (Some(&c), Some(&d), Some(&q)) = (
                port_nets.get("C"),
                port_nets.get("D"),
                port_nets.get("Q"),
            ) {
                let ce = get_net_or_one("CE");
                let clr = get_net_or_zero("CLR");

                let body = vec![
                    BirStatement::If {
                        cond: BirExpr::Net(clr),
                        then_body: vec![BirStatement::Assign {
                            target: q,
                            expr: BirExpr::Const(LogicVector::from_u64(0, 1)),
                            is_nonblocking: true,
                        }],
                        else_body: vec![BirStatement::If {
                            cond: BirExpr::Net(ce),
                            then_body: vec![BirStatement::Assign {
                                target: q,
                                expr: BirExpr::Net(d),
                                is_nonblocking: true,
                            }],
                            else_body: Vec::new(),
                        }],
                    },
                ];

                circuit.add_process(
                    format!("{scope_prefix}.{inst_name}"),
                    BirProcessKind::Clocked,
                    vec![
                        BirTrigger { net: c, edge: EdgeKind::Posedge },
                        BirTrigger { net: clr, edge: EdgeKind::Posedge },
                    ],
                    body,
                );
            }
        }
        PrimitiveKind::Fdpe => {
            if let (Some(&c), Some(&d), Some(&q)) = (
                port_nets.get("C"),
                port_nets.get("D"),
                port_nets.get("Q"),
            ) {
                let ce = get_net_or_one("CE");
                let pre = get_net_or_zero("PRE");

                let body = vec![
                    BirStatement::If {
                        cond: BirExpr::Net(pre),
                        then_body: vec![BirStatement::Assign {
                            target: q,
                            expr: BirExpr::Const(LogicVector::from_u64(1, 1)),
                            is_nonblocking: true,
                        }],
                        else_body: vec![BirStatement::If {
                            cond: BirExpr::Net(ce),
                            then_body: vec![BirStatement::Assign {
                                target: q,
                                expr: BirExpr::Net(d),
                                is_nonblocking: true,
                            }],
                            else_body: Vec::new(),
                        }],
                    },
                ];

                circuit.add_process(
                    format!("{scope_prefix}.{inst_name}"),
                    BirProcessKind::Clocked,
                    vec![
                        BirTrigger { net: c, edge: EdgeKind::Posedge },
                        BirTrigger { net: pre, edge: EdgeKind::Posedge },
                    ],
                    body,
                );
            }
        }
        PrimitiveKind::Carry4 => {
            // CARRY4 logic
            let ci = port_nets.get("CI").copied().unwrap_or(dummy_zero);
            let cyinit = port_nets.get("CYINIT").copied().unwrap_or(dummy_zero);
            let di = port_nets.get("DI").copied().unwrap_or(dummy_zero);
            let s = port_nets.get("S").copied().unwrap_or(dummy_zero);

            if let Some(&o) = port_nets.get("O") {
                // O = S ^ carry_in
                let cin = BirExpr::Binary {
                    op: BinaryOp::BitOr,
                    lhs: Box::new(BirExpr::Net(ci)),
                    rhs: Box::new(BirExpr::Net(cyinit)),
                };
                let expr = BirExpr::Binary {
                    op: BinaryOp::BitXor,
                    lhs: Box::new(BirExpr::Net(s)),
                    rhs: Box::new(cin),
                };
                circuit.add_continuous_assign(o, expr);
            }

            if let Some(&co) = port_nets.get("CO") {
                // Approximate carry out
                let expr = BirExpr::Binary {
                    op: BinaryOp::BitOr,
                    lhs: Box::new(BirExpr::Net(di)),
                    rhs: Box::new(BirExpr::Net(s)),
                };
                circuit.add_continuous_assign(co, expr);
            }
        }
        _ => {}
    }
}
