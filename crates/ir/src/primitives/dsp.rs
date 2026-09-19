use crate::bir::*;
use axiom_core::LogicVector;
use axiom_syntax::{BinaryOp, EdgeKind};
use hashbrown::HashMap;

pub fn elaborate_dsp48(
    _kind: PrimitiveKind,
    inst_name: &str,
    scope_prefix: &str,
    circuit: &mut BirCircuit,
    port_nets: &HashMap<String, NetId>,
    params: &HashMap<String, u64>,
) {
    let dummy_zero = circuit.add_net(format!("{scope_prefix}.{inst_name}._zero"), 1, LogicVector::zeros(1));
    let dummy_zero_48 = circuit.add_net(format!("{scope_prefix}.{inst_name}._zero48"), 48, LogicVector::zeros(48));
    let dummy_one = circuit.add_net(format!("{scope_prefix}.{inst_name}._one"), 1, LogicVector::from_u64(1, 1));

    let preg = params.get("PREG").copied().unwrap_or(1);
    let mreg = params.get("MREG").copied().unwrap_or(1);

    let clk = port_nets.get("CLK").copied();
    let cep = port_nets.get("CEP").copied().unwrap_or(dummy_one);
    let rstp = port_nets.get("RSTP").copied().unwrap_or(dummy_zero);

    let a_in = port_nets.get("A").copied();
    let b_in = port_nets.get("B").copied();
    let c_in = port_nets.get("C").copied().unwrap_or(dummy_zero_48);
    let p_out = port_nets.get("P").copied();
    let pcout = port_nets.get("PCOUT").copied();

    let a_net = a_in.unwrap_or(dummy_zero);
    let b_net = b_in.unwrap_or(dummy_zero);

    // Multiplier output net (48-bit wide)
    let mult_net = circuit.add_net(
        format!("{scope_prefix}.{inst_name}._mult_product"),
        48,
        LogicVector::zeros(48),
    );

    // Continuous multiplier calculation: mult_net = A * B
    circuit.add_continuous_assign(
        mult_net,
        BirExpr::Binary {
            op: BinaryOp::Mul,
            lhs: Box::new(BirExpr::Net(a_net)),
            rhs: Box::new(BirExpr::Net(b_net)),
        },
    );

    // Registered or combinational M stage
    let m_stage_net = if mreg > 0 && clk.is_some() {
        let m_reg = circuit.add_net(
            format!("{scope_prefix}.{inst_name}._m_reg"),
            48,
            LogicVector::zeros(48),
        );
        let cem = port_nets.get("CEM").copied().unwrap_or(dummy_one);
        let rstm = port_nets.get("RSTM").copied().unwrap_or(dummy_zero);

        circuit.add_process(
            format!("{scope_prefix}.{inst_name}.m_stage"),
            BirProcessKind::Clocked,
            vec![BirTrigger { net: clk.unwrap(), edge: EdgeKind::Posedge }],
            vec![BirStatement::If {
                cond: BirExpr::Net(rstm),
                then_body: vec![BirStatement::Assign {
                    target: m_reg,
                    expr: BirExpr::Const(LogicVector::zeros(48)),
                    is_nonblocking: true,
                }],
                else_body: vec![BirStatement::If {
                    cond: BirExpr::Net(cem),
                    then_body: vec![BirStatement::Assign {
                        target: m_reg,
                        expr: BirExpr::Net(mult_net),
                        is_nonblocking: true,
                    }],
                    else_body: Vec::new(),
                }],
            }],
        );
        m_reg
    } else {
        mult_net
    };

    // Next ALU accumulator value: next_p = C + M (or P + M if accumulation)
    let next_p_net = circuit.add_net(
        format!("{scope_prefix}.{inst_name}._alu_sum"),
        48,
        LogicVector::zeros(48),
    );

    // If P register exists and OPMODE specifies feedback accumulation, accumulate P + M
    // By default: ALU calculates (C != 0 ? C + M : (accumulate P + M))
    // We connect next_p = (C + M)
    circuit.add_continuous_assign(
        next_p_net,
        BirExpr::Binary {
            op: BinaryOp::Add,
            lhs: Box::new(BirExpr::Net(c_in)),
            rhs: Box::new(BirExpr::Net(m_stage_net)),
        },
    );

    if let Some(target_p) = p_out {
        if preg > 0 && clk.is_some() {
            // Pipelined P register
            circuit.add_process(
                format!("{scope_prefix}.{inst_name}.p_stage"),
                BirProcessKind::Clocked,
                vec![BirTrigger { net: clk.unwrap(), edge: EdgeKind::Posedge }],
                vec![BirStatement::If {
                    cond: BirExpr::Net(rstp),
                    then_body: vec![BirStatement::Assign {
                        target: target_p,
                        expr: BirExpr::Const(LogicVector::zeros(48)),
                        is_nonblocking: true,
                    }],
                    else_body: vec![BirStatement::If {
                        cond: BirExpr::Net(cep),
                        then_body: vec![BirStatement::Assign {
                            target: target_p,
                            expr: BirExpr::Net(next_p_net),
                            is_nonblocking: true,
                        }],
                        else_body: Vec::new(),
                    }],
                }],
            );
        } else {
            // Unpipelined output
            circuit.add_continuous_assign(target_p, BirExpr::Net(next_p_net));
        }

        // Cascade out: PCOUT = P
        if let Some(target_pcout) = pcout {
            circuit.add_continuous_assign(target_pcout, BirExpr::Net(target_p));
        }
    }
}
