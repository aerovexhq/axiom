use betterado_core::{FileId, Logic4, LogicVector};
use betterado_ir::elaborate;
use betterado_jit::JitEngine;
use betterado_syntax::parse_hdl;

#[test]
fn test_jit_alu_execution() {
    let src = include_str!("../../../tests/fixtures/alu.v");
    let (ast, diags) = parse_hdl(FileId(1), src);
    assert!(diags.is_empty(), "Parsing ALU fixture failed: {diags:?}");

    let circuit = elaborate(&ast, "alu").expect("Elaborating ALU failed");
    let mut compiled = JitEngine::compile(circuit).expect("JIT compiling ALU failed");

    let op_add = LogicVector::from_u64(0, 3); // 3'b000 (ADD)
    let op_sub = LogicVector::from_u64(1, 3); // 3'b001 (SUB)
    let op_and = LogicVector::from_u64(2, 3); // 3'b010 (AND)
    let op_or  = LogicVector::from_u64(3, 3); // 3'b011 (OR)
    let op_xor = LogicVector::from_u64(4, 3); // 3'b100 (XOR)

    let a_val = LogicVector::from_u64(20, 32);
    let b_val = LogicVector::from_u64(5, 32);

    compiled.set_signal("alu.a", &a_val);
    compiled.set_signal("alu.b", &b_val);

    // 1. Test ADD (20 + 5 = 25)
    compiled.set_signal("alu.opcode", &op_add);
    for p in 0..compiled.circuit.processes.len() {
        let _ = compiled.eval_process(betterado_ir::ProcessId(p as u32));
    }
    for a in 0..compiled.circuit.continuous_assigns.len() {
        compiled.eval_continuous_assign(a);
    }

    let res_add = compiled.get_signal("alu.result").unwrap();
    let zero_add = compiled.get_signal("alu.zero").unwrap();
    assert_eq!(res_add.to_u64(), Some(25));
    assert_eq!(zero_add.get_bit(0), Logic4::Zero);

    // 2. Test SUB (20 - 5 = 15)
    compiled.set_signal("alu.opcode", &op_sub);
    for p in 0..compiled.circuit.processes.len() {
        let _ = compiled.eval_process(betterado_ir::ProcessId(p as u32));
    }
    for a in 0..compiled.circuit.continuous_assigns.len() {
        compiled.eval_continuous_assign(a);
    }

    let res_sub = compiled.get_signal("alu.result").unwrap();
    assert_eq!(res_sub.to_u64(), Some(15));

    // 3. Test SUB to zero (20 - 20 = 0 -> zero == 1)
    compiled.set_signal("alu.b", &a_val);
    for p in 0..compiled.circuit.processes.len() {
        let _ = compiled.eval_process(betterado_ir::ProcessId(p as u32));
    }
    for a in 0..compiled.circuit.continuous_assigns.len() {
        compiled.eval_continuous_assign(a);
    }

    let res_zero = compiled.get_signal("alu.result").unwrap();
    let zero_flag = compiled.get_signal("alu.zero").unwrap();
    assert_eq!(res_zero.to_u64(), Some(0));
    assert_eq!(zero_flag.get_bit(0), Logic4::One);

    // 4. Test AND (0xF0 & 0xAA = 0xA0)
    let a_hex = LogicVector::from_u64(0xF0, 32);
    let b_hex = LogicVector::from_u64(0xAA, 32);
    compiled.set_signal("alu.a", &a_hex);
    compiled.set_signal("alu.b", &b_hex);
    compiled.set_signal("alu.opcode", &op_and);
    for p in 0..compiled.circuit.processes.len() {
        let _ = compiled.eval_process(betterado_ir::ProcessId(p as u32));
    }
    let res_and = compiled.get_signal("alu.result").unwrap();
    assert_eq!(res_and.to_u64(), Some(0xA0));

    // 5. Test OR (0xF0 | 0x0A = 0xFA)
    let b_or = LogicVector::from_u64(0x0A, 32);
    compiled.set_signal("alu.b", &b_or);
    compiled.set_signal("alu.opcode", &op_or);
    for p in 0..compiled.circuit.processes.len() {
        let _ = compiled.eval_process(betterado_ir::ProcessId(p as u32));
    }
    let res_or = compiled.get_signal("alu.result").unwrap();
    assert_eq!(res_or.to_u64(), Some(0xFA));

    // 6. Test XOR (0xFF ^ 0x0F = 0xF0)
    let a_xor = LogicVector::from_u64(0xFF, 32);
    let b_xor = LogicVector::from_u64(0x0F, 32);
    compiled.set_signal("alu.a", &a_xor);
    compiled.set_signal("alu.b", &b_xor);
    compiled.set_signal("alu.opcode", &op_xor);
    for p in 0..compiled.circuit.processes.len() {
        let _ = compiled.eval_process(betterado_ir::ProcessId(p as u32));
    }
    let res_xor = compiled.get_signal("alu.result").unwrap();
    assert_eq!(res_xor.to_u64(), Some(0xF0));
}

#[test]
fn test_jit_counter_execution() {
    let src = include_str!("../../../tests/fixtures/counter.v");
    let (ast, diags) = parse_hdl(FileId(2), src);
    assert!(diags.is_empty(), "Parsing Counter fixture failed: {diags:?}");

    let circuit = elaborate(&ast, "counter").expect("Elaborating Counter failed");
    let mut compiled = JitEngine::compile(circuit).expect("JIT compiling Counter failed");

    let logic_one = LogicVector::fill(1, Logic4::One);
    let logic_zero = LogicVector::fill(1, Logic4::Zero);

    // Initial state: reset active (rst_n = 0)
    compiled.set_signal("counter.rst_n", &logic_zero);
    compiled.set_signal("counter.enable", &logic_one);
    compiled.set_signal("counter.up_down", &logic_one);

    // Clock edge: eval process
    let nbas = compiled.eval_process(betterado_ir::ProcessId(0));
    for (target, val) in nbas {
        let target_net = compiled.circuit.get_net(target).unwrap().clone();
        compiled.arena.write_net(&target_net, &val);
    }

    let count_val = compiled.get_signal("counter.count").unwrap();
    assert_eq!(count_val.to_u64(), Some(0));

    // Release reset (rst_n = 1)
    compiled.set_signal("counter.rst_n", &logic_one);

    // Clock cycle 1 (up_down = 1 -> count increments to 1)
    let nbas = compiled.eval_process(betterado_ir::ProcessId(0));
    for (target, val) in nbas {
        let target_net = compiled.circuit.get_net(target).unwrap().clone();
        compiled.arena.write_net(&target_net, &val);
    }
    let count_val = compiled.get_signal("counter.count").unwrap();
    assert_eq!(count_val.to_u64(), Some(1));

    // Clock cycle 2 (count increments to 2)
    let nbas = compiled.eval_process(betterado_ir::ProcessId(0));
    for (target, val) in nbas {
        let target_net = compiled.circuit.get_net(target).unwrap().clone();
        compiled.arena.write_net(&target_net, &val);
    }
    let count_val = compiled.get_signal("counter.count").unwrap();
    assert_eq!(count_val.to_u64(), Some(2));

    // Clock cycle 3 (up_down = 0 -> count decrements to 1)
    compiled.set_signal("counter.up_down", &logic_zero);
    let nbas = compiled.eval_process(betterado_ir::ProcessId(0));
    for (target, val) in nbas {
        let target_net = compiled.circuit.get_net(target).unwrap().clone();
        compiled.arena.write_net(&target_net, &val);
    }
    let count_val = compiled.get_signal("counter.count").unwrap();
    assert_eq!(count_val.to_u64(), Some(1));
}
