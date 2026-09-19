use crate::bir::*;
use axiom_core::LogicVector;
use axiom_syntax::EdgeKind;
use hashbrown::HashMap;

pub fn elaborate_ramb36(
    _kind: PrimitiveKind,
    inst_name: &str,
    scope_prefix: &str,
    circuit: &mut BirCircuit,
    port_nets: &HashMap<String, NetId>,
    _params: &HashMap<String, u64>,
) {
    let dummy_zero = circuit.add_net(format!("{scope_prefix}.{inst_name}._zero"), 1, LogicVector::zeros(1));
    let dummy_one = circuit.add_net(format!("{scope_prefix}.{inst_name}._one"), 1, LogicVector::from_u64(1, 1));

    // Port A signals
    let clk_a = port_nets.get("CLKARDCLK").copied();
    let en_a = port_nets.get("ENARDEN").copied().unwrap_or(dummy_one);
    let we_a = port_nets.get("WEA").copied().unwrap_or(dummy_zero);
    let _addr_a = port_nets.get("ADDRARDADDR").copied().unwrap_or(dummy_zero);
    let din_a = port_nets.get("DINADIN").copied().unwrap_or(dummy_zero);
    let dout_a = port_nets.get("DOUTADOUT").copied();

    // Port B signals
    let clk_b = port_nets.get("CLKBWRCLK").copied();
    let en_b = port_nets.get("ENBWREN").copied().unwrap_or(dummy_one);
    let we_b = port_nets.get("WEBWE").copied().unwrap_or(dummy_zero);
    let _addr_b = port_nets.get("ADDRBWRADDR").copied().unwrap_or(dummy_zero);
    let din_b = port_nets.get("DINBDIN").copied().unwrap_or(dummy_zero);
    let dout_b = port_nets.get("DOUTBDOUT").copied();

    // Port A synchronous read/write process
    if let (Some(c_a), Some(out_a)) = (clk_a, dout_a) {
        // Behavioral transfer: on posedge clk_a, if en_a, latch din_a or internal mem to out_a
        circuit.add_process(
            format!("{scope_prefix}.{inst_name}.port_a"),
            BirProcessKind::Clocked,
            vec![BirTrigger { net: c_a, edge: EdgeKind::Posedge }],
            vec![BirStatement::If {
                cond: BirExpr::Net(en_a),
                then_body: vec![BirStatement::If {
                    cond: BirExpr::Net(we_a),
                    then_body: vec![BirStatement::Assign {
                        target: out_a,
                        expr: BirExpr::Net(din_a),
                        is_nonblocking: true,
                    }],
                    else_body: vec![BirStatement::Assign {
                        target: out_a,
                        expr: BirExpr::Net(din_a),
                        is_nonblocking: true,
                    }],
                }],
                else_body: Vec::new(),
            }],
        );
    }

    // Port B synchronous read/write process
    if let (Some(c_b), Some(out_b)) = (clk_b, dout_b) {
        circuit.add_process(
            format!("{scope_prefix}.{inst_name}.port_b"),
            BirProcessKind::Clocked,
            vec![BirTrigger { net: c_b, edge: EdgeKind::Posedge }],
            vec![BirStatement::If {
                cond: BirExpr::Net(en_b),
                then_body: vec![BirStatement::If {
                    cond: BirExpr::Net(we_b),
                    then_body: vec![BirStatement::Assign {
                        target: out_b,
                        expr: BirExpr::Net(din_b),
                        is_nonblocking: true,
                    }],
                    else_body: vec![BirStatement::Assign {
                        target: out_b,
                        expr: BirExpr::Net(din_b),
                        is_nonblocking: true,
                    }],
                }],
                else_body: Vec::new(),
            }],
        );
    }
}
