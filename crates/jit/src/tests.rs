#[cfg(test)]
mod tests {
    use crate::*;
    use betterado_core::{FileId, LogicVector};
    use betterado_ir::{elaborate, BirCircuit};
    use betterado_syntax::parse_hdl;

    #[test]
    fn test_sim_state_arena_rw() {
        let mut circuit = BirCircuit::new("test_top");
        let net1 = circuit.add_net("test_top.a", 8, LogicVector::zeros(8));
        let net2 = circuit.add_net("test_top.b", 64, LogicVector::unknowns(64));

        let mut arena = SimStateArena::from_circuit(&circuit);
        let val_a = arena.read_net(circuit.get_net(net1).unwrap());
        assert_eq!(val_a.width(), 8);
        assert_eq!(val_a.to_u64(), Some(0));

        let val_b = arena.read_net(circuit.get_net(net2).unwrap());
        assert_eq!(val_b.width(), 64);
        assert_eq!(val_b.is_all_known(), false);

        // Write new state to net1
        let new_a = LogicVector::from_hex_str("5A", Some(8)).unwrap();
        let changed = arena.write_net(circuit.get_net(net1).unwrap(), &new_a);
        assert!(changed);

        let reread_a = arena.read_net(circuit.get_net(net1).unwrap());
        assert_eq!(reread_a.to_hex_string(), "5A");

        // Write same state - should return false for changed
        let unchanged = arena.write_net(circuit.get_net(net1).unwrap(), &new_a);
        assert!(!unchanged);
    }

    #[test]
    fn test_jit_compile_and_execute_continuous_assign() {
        let src = r#"
module logic_unit (
    input wire [7:0] a,
    input wire [7:0] b,
    output wire [7:0] and_out,
    output wire [7:0] add_out
);
    assign and_out = a & b;
    assign add_out = a + b;
endmodule
"#;
        let (ast, diags) = parse_hdl(FileId(1), src);
        assert!(diags.is_empty(), "Parsing failed: {diags:?}");

        let circuit = elaborate(&ast, "logic_unit").expect("Elaboration failed");
        let mut compiled = JitEngine::compile(circuit).expect("JIT compilation failed");

        // Set inputs: a = 0x0F, b = 0x03
        let val_a = LogicVector::from_hex_str("0F", Some(8)).unwrap();
        let val_b = LogicVector::from_hex_str("03", Some(8)).unwrap();
        compiled.set_signal("logic_unit.a", &val_a);
        compiled.set_signal("logic_unit.b", &val_b);

        // Execute continuous assigns
        for idx in 0..compiled.circuit.continuous_assigns.len() {
            compiled.eval_continuous_assign(idx);
        }

        // Verify outputs in RAM
        let and_out = compiled.get_signal("logic_unit.and_out").expect("and_out missing");
        let add_out = compiled.get_signal("logic_unit.add_out").expect("add_out missing");

        assert_eq!(and_out.to_hex_string(), "03"); // 0x0F & 0x03 = 0x03
        assert_eq!(add_out.to_hex_string(), "12"); // 0x0F + 0x03 = 0x12
    }
}
