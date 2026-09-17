#[cfg(feature = "native-jit")]
use cranelift_codegen::ir::{condcodes::IntCC, types, AbiParam, InstBuilder, MemFlagsData, Value};
#[cfg(feature = "native-jit")]
use cranelift_frontend::{FunctionBuilder, FunctionBuilderContext};
#[cfg(feature = "native-jit")]
use cranelift_jit::{JITBuilder, JITModule};
#[cfg(feature = "native-jit")]
use cranelift_module::{Linkage, Module};

use betterado_ir::{BirCircuit, BirContinuousAssign, BirExpr};
use betterado_syntax::{BinaryOp, UnaryOp};

/// Function pointer to a JIT-compiled native logic block in RAM.
/// Parameters:
/// - `values`: raw pointer to `SimStateArena.values`
/// - `masks`: raw pointer to `SimStateArena.masks`
/// Returns:
/// - `1` if the target net changed state, `0` otherwise.
pub type NativeBlockFn = unsafe extern "C" fn(values: *mut u64, masks: *mut u64) -> u32;

#[cfg(feature = "native-jit")]
pub struct CraneliftJit {
    module: JITModule,
    ctx: cranelift_codegen::Context,
    fn_builder_ctx: FunctionBuilderContext,
}

#[cfg(feature = "native-jit")]
impl CraneliftJit {
    pub fn new() -> Result<Self, String> {
        let builder = JITBuilder::new(cranelift_module::default_libcall_names())
            .map_err(|e| format!("Failed to create JITBuilder: {e}"))?;
        let module = JITModule::new(builder);
        let ctx = module.make_context();
        let fn_builder_ctx = FunctionBuilderContext::new();

        Ok(Self {
            module,
            ctx,
            fn_builder_ctx,
        })
    }

    /// Compiles a continuous assignment into native machine code in RAM.
    pub fn compile_continuous_assign(
        &mut self,
        assign: &BirContinuousAssign,
        circuit: &BirCircuit,
        fn_name: &str,
    ) -> Result<NativeBlockFn, String> {
        self.ctx.func.clear();
        self.ctx.func.name = cranelift_codegen::ir::UserFuncName::user(0, 0);

        // Signature: (values: i64, masks: i64) -> i32
        self.ctx.func.signature.params.push(AbiParam::new(types::I64)); // values_ptr
        self.ctx.func.signature.params.push(AbiParam::new(types::I64)); // masks_ptr
        self.ctx.func.signature.returns.push(AbiParam::new(types::I32)); // changed

        let target_net = circuit.get_net(assign.target)
            .ok_or_else(|| format!("Target net {:?} not found", assign.target))?;
        let target_offset = (target_net.word_offset * 8) as i32;

        let target_config = self.module.target_config();
        {
            let mut builder = FunctionBuilder::new(&mut self.ctx.func, &mut self.fn_builder_ctx);
            let entry_block = builder.create_block();
            builder.append_block_params_for_function_params(entry_block);
            builder.switch_to_block(entry_block);
            builder.seal_block(entry_block);

            let values_ptr = builder.block_params(entry_block)[0];
            let masks_ptr = builder.block_params(entry_block)[1];

            // 1. Compile RHS expression
            let (new_val, new_mask) = Self::compile_expr(&mut builder, &assign.expr, circuit, values_ptr, masks_ptr)?;

            // 2. Load old target value and mask
            let old_val = builder.ins().load(types::I64, MemFlagsData::trusted(), values_ptr, target_offset);
            let old_mask = builder.ins().load(types::I64, MemFlagsData::trusted(), masks_ptr, target_offset);

            // 3. Check if target changed: (old_val ^ new_val) | (old_mask ^ new_mask) != 0
            let diff_val = builder.ins().bxor(old_val, new_val);
            let diff_mask = builder.ins().bxor(old_mask, new_mask);
            let diff = builder.ins().bor(diff_val, diff_mask);
            let changed_bool = builder.ins().icmp_imm_u(IntCC::NotEqual, diff, 0);
            let changed_i32 = builder.ins().uextend(types::I32, changed_bool);

            // 4. Store updated target value and mask
            builder.ins().store(MemFlagsData::trusted(), new_val, values_ptr, target_offset);
            builder.ins().store(MemFlagsData::trusted(), new_mask, masks_ptr, target_offset);

            // 5. Return changed flag
            builder.ins().return_(&[changed_i32]);
            builder.finalize(target_config);
        }

        let func_id = self.module.declare_function(fn_name, Linkage::Local, &self.ctx.func.signature)
            .map_err(|e| format!("Declare function error: {e}"))?;

        self.module.define_function(func_id, &mut self.ctx)
            .map_err(|e| format!("Define function error: {e}"))?;

        self.module.clear_context(&mut self.ctx);
        self.module.finalize_definitions().map_err(|e| format!("Finalize error: {e}"))?;

        let code_ptr = self.module.get_finalized_function(func_id);
        let fn_ptr: NativeBlockFn = unsafe { std::mem::transmute(code_ptr) };
        Ok(fn_ptr)
    }

    fn compile_expr(
        builder: &mut FunctionBuilder,
        expr: &BirExpr,
        circuit: &BirCircuit,
        values_ptr: Value,
        masks_ptr: Value,
    ) -> Result<(Value, Value), String> {
        match expr {
            BirExpr::Net(id) => {
                let net = circuit.get_net(*id)
                    .ok_or_else(|| format!("Net {:?} not found", id))?;
                let offset = (net.word_offset * 8) as i32;
                let val = builder.ins().load(types::I64, MemFlagsData::trusted(), values_ptr, offset);
                let mask = builder.ins().load(types::I64, MemFlagsData::trusted(), masks_ptr, offset);
                Ok((val, mask))
            }
            BirExpr::Const(vec) => {
                let raw_val = vec.to_u64().unwrap_or(0) as i64;
                let raw_mask = vec.raw_masks().first().copied().unwrap_or(0) as i64;
                let val = builder.ins().iconst(types::I64, raw_val);
                let mask = builder.ins().iconst(types::I64, raw_mask);
                Ok((val, mask))
            }
            BirExpr::Unary { op, expr } => {
                let (v, m) = Self::compile_expr(builder, expr, circuit, values_ptr, masks_ptr)?;
                match op {
                    UnaryOp::Not => {
                        // ~A: val = ~val & ~mask, mask = mask
                        let not_v = builder.ins().bnot(v);
                        let not_m = builder.ins().bnot(m);
                        let res_v = builder.ins().band(not_v, not_m);
                        Ok((res_v, m))
                    }
                    UnaryOp::LogicNot => {
                        let or_all = builder.ins().bor(v, m);
                        let is_zero = builder.ins().icmp_imm_u(IntCC::Equal, or_all, 0);
                        let res_v = builder.ins().uextend(types::I64, is_zero);
                        let zero_mask = builder.ins().iconst(types::I64, 0);
                        Ok((res_v, zero_mask))
                    }
                    _ => Ok((v, m)),
                }
            }
            BirExpr::Binary { op, lhs, rhs } => {
                let (vl, ml) = Self::compile_expr(builder, lhs, circuit, values_ptr, masks_ptr)?;
                let (vr, mr) = Self::compile_expr(builder, rhs, circuit, values_ptr, masks_ptr)?;

                match op {
                    BinaryOp::Add => {
                        let val = builder.ins().iadd(vl, vr);
                        let mask = builder.ins().bor(ml, mr);
                        Ok((val, mask))
                    }
                    BinaryOp::Sub => {
                        let val = builder.ins().isub(vl, vr);
                        let mask = builder.ins().bor(ml, mr);
                        Ok((val, mask))
                    }
                    BinaryOp::Mul => {
                        let val = builder.ins().imul(vl, vr);
                        let mask = builder.ins().bor(ml, mr);
                        Ok((val, mask))
                    }
                    BinaryOp::BitAnd => {
                        // val = vl & vr
                        // mask = (ml & (vr | mr)) | (mr & (vl | ml))
                        let val = builder.ins().band(vl, vr);
                        let t1 = builder.ins().bor(vr, mr);
                        let t2 = builder.ins().band(ml, t1);
                        let t3 = builder.ins().bor(vl, ml);
                        let t4 = builder.ins().band(mr, t3);
                        let mask = builder.ins().bor(t2, t4);
                        Ok((val, mask))
                    }
                    BinaryOp::BitOr => {
                        // val = vl | vr
                        // mask = (ml & ~vr) | (mr & ~vl)
                        let val = builder.ins().bor(vl, vr);
                        let not_vr = builder.ins().bnot(vr);
                        let t1 = builder.ins().band(ml, not_vr);
                        let not_vl = builder.ins().bnot(vl);
                        let t2 = builder.ins().band(mr, not_vl);
                        let mask = builder.ins().bor(t1, t2);
                        Ok((val, mask))
                    }
                    BinaryOp::BitXor => {
                        let val = builder.ins().bxor(vl, vr);
                        let mask = builder.ins().bor(ml, mr);
                        Ok((val, mask))
                    }
                    BinaryOp::Eq | BinaryOp::CaseEq => {
                        let diff_v = builder.ins().bxor(vl, vr);
                        let diff_m = builder.ins().bor(ml, mr);
                        let diff = builder.ins().bor(diff_v, diff_m);
                        let is_eq = builder.ins().icmp_imm_u(IntCC::Equal, diff, 0);
                        let val = builder.ins().uextend(types::I64, is_eq);
                        let mask = builder.ins().iconst(types::I64, 0);
                        Ok((val, mask))
                    }
                    BinaryOp::Shl | BinaryOp::ShlArith => {
                        let val = builder.ins().ishl(vl, vr);
                        let mask = builder.ins().bor(ml, mr);
                        Ok((val, mask))
                    }
                    BinaryOp::Shr | BinaryOp::ShrArith => {
                        let val = builder.ins().ushr(vl, vr);
                        let mask = builder.ins().bor(ml, mr);
                        Ok((val, mask))
                    }
                    _ => {
                        let zero = builder.ins().iconst(types::I64, 0);
                        Ok((zero, zero))
                    }
                }
            }
            BirExpr::Slice { target, lsb, width: _ } => {
                let (v, m) = Self::compile_expr(builder, target, circuit, values_ptr, masks_ptr)?;
                let lsb_val = builder.ins().iconst(types::I64, *lsb as i64);
                let shifted_v = builder.ins().ushr(v, lsb_val);
                let shifted_m = builder.ins().ushr(m, lsb_val);
                Ok((shifted_v, shifted_m))
            }
            _ => {
                let zero = builder.ins().iconst(types::I64, 0);
                Ok((zero, zero))
            }
        }
    }
}
