use crate::bir::*;
use axiom_core::{Logic4, LogicVector};
use axiom_syntax::*;
use hashbrown::HashMap;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ElaborationError {
    #[error("Top module '{0}' not found in source definitions")]
    TopModuleNotFound(String),
    #[error("Module '{0}' instantiated as '{1}' not found")]
    ModuleNotFound(String, String),
    #[error("Signal '{0}' not found in scope '{1}'")]
    SignalNotFound(String, String),
    #[error("Cannot evaluate constant expression: {0}")]
    ConstEvalError(String),
}

pub struct Elaborator<'a> {
    _source: &'a SourceFile,
    modules: HashMap<&'a str, &'a ModuleDef>,
    circuit: BirCircuit,
}

impl<'a> Elaborator<'a> {
    pub fn elaborate(source: &'a SourceFile, top_name: &str) -> Result<BirCircuit, ElaborationError> {
        let mut modules = HashMap::new();
        for m in &source.modules {
            modules.insert(m.name.as_str(), m);
        }

        let mut elab = Self {
            _source: source,
            modules,
            circuit: BirCircuit::new(top_name),
        };

        let top_module = elab.modules.get(top_name)
            .ok_or_else(|| ElaborationError::TopModuleNotFound(top_name.to_string()))?;

        let top_params = HashMap::new();
        elab.elaborate_instance(top_module, top_name, &top_params, &[])?;

        Ok(elab.circuit)
    }

    fn elaborate_instance(
        &mut self,
        module: &'a ModuleDef,
        scope_prefix: &str,
        param_overrides: &HashMap<String, u64>,
        port_connections: &[(String, NetId)],
    ) -> Result<(), ElaborationError> {
        // 1. Resolve parameters
        let mut resolved_params = HashMap::new();
        for param in &module.params {
            let default_val = self.eval_const_expr(&param.value, &resolved_params)?;
            let val = param_overrides.get(&param.name).copied().unwrap_or(default_val);
            resolved_params.insert(param.name.clone(), val);
        }

        // Scope net lookup: local_name -> NetId
        let mut local_nets: HashMap<String, NetId> = HashMap::new();

        // 2. Resolve port declarations
        for port in &module.ports {
            let width = if let Some(range) = &port.range {
                self.eval_range_width(range, &resolved_params)?
            } else {
                1
            };

            let full_name = format!("{scope_prefix}.{}", port.name);
            let net_id = self.circuit.add_net(full_name, width, LogicVector::zeros(width));
            local_nets.insert(port.name.clone(), net_id);
        }

        // Connect formal ports to actual parent nets
        for (port_name, parent_net_id) in port_connections {
            if let Some(&child_net_id) = local_nets.get(port_name) {
                // Buffer driving child from parent
                self.circuit.add_continuous_assign(
                    child_net_id,
                    BirExpr::Net(*parent_net_id),
                );
            }
        }

        // 3. Resolve module items
        for item in &module.items {
            match item {
                ModuleItem::NetDecl(decl) => {
                    let width = if let Some(range) = &decl.range {
                        self.eval_range_width(range, &resolved_params)?
                    } else {
                        1
                    };

                    for name in &decl.names {
                        if !local_nets.contains_key(name) {
                            let full_name = format!("{scope_prefix}.{name}");
                            let init = match decl.data_type {
                                DataType::Reg | DataType::Logic => LogicVector::zeros(width),
                                _ => LogicVector::fill(width, Logic4::Z),
                            };
                            let id = self.circuit.add_net(full_name, width, init);
                            local_nets.insert(name.clone(), id);
                        }
                    }

                    if let Some(init_expr) = &decl.init {
                        for name in &decl.names {
                            let assign = AssignStmt {
                                lhs: Expr::Ident(name.clone(), decl.span),
                                rhs: init_expr.clone(),
                                span: decl.span,
                            };
                            self.elaborate_continuous_assign(&assign, &local_nets, &resolved_params)?;
                        }
                    }
                }
                ModuleItem::ParamDecl(decl) => {
                    let val = self.eval_const_expr(&decl.value, &resolved_params)?;
                    resolved_params.insert(decl.name.clone(), val);
                }
                ModuleItem::ContinuousAssign(assign) => {
                    self.elaborate_continuous_assign(assign, &local_nets, &resolved_params)?;
                }
                ModuleItem::ProceduralBlock(proc) => {
                    self.elaborate_procedural_block(proc, scope_prefix, &local_nets)?;
                }
                ModuleItem::Instance(inst) => {
                    if let Some(child_module) = self.modules.get(inst.module_name.as_str()).copied() {
                        let mut child_param_overrides = HashMap::new();
                        for (pname, pexpr) in &inst.param_bindings {
                            let pval = self.eval_const_expr(pexpr, &resolved_params)?;
                            child_param_overrides.insert(pname.clone(), pval);
                        }

                        let mut child_port_conns = Vec::new();
                        for (pname, expr) in &inst.port_bindings {
                            if let Some(net_id) = self.resolve_port_expr_to_net(expr, &local_nets, scope_prefix)? {
                                child_port_conns.push((pname.clone(), net_id));
                            }
                        }

                        let child_prefix = format!("{scope_prefix}.{}", inst.instance_name);
                        self.elaborate_instance(child_module, &child_prefix, &child_param_overrides, &child_port_conns)?;
                    } else if let Some(prim_kind) = crate::primitives::PrimitiveCatalog::lookup(&inst.module_name) {
                        self.elaborate_primitive_instance(prim_kind, inst, scope_prefix, &local_nets, &resolved_params)?;
                    } else {
                        return Err(ElaborationError::ModuleNotFound(inst.module_name.clone(), inst.instance_name.clone()));
                    }
                }
                ModuleItem::GenerateBlock(gen) => {
                    // For now, inline generate items
                    for subitem in &gen.items {
                        // Expand basic items
                        if let ModuleItem::ContinuousAssign(assign) = subitem {
                            self.elaborate_continuous_assign(assign, &local_nets, &resolved_params)?;
                        }
                    }
                }
            }
        }

        Ok(())
    }

    fn elaborate_continuous_assign(
        &mut self,
        assign: &AssignStmt,
        nets: &HashMap<String, NetId>,
        _params: &HashMap<String, u64>,
    ) -> Result<(), ElaborationError> {
        let target_id = self.resolve_lvalue_net(&assign.lhs, nets)?;
        let expr = self.lower_expr(&assign.rhs, nets)?;
        self.circuit.add_continuous_assign(target_id, expr);
        Ok(())
    }

    fn elaborate_procedural_block(
        &mut self,
        proc: &ProceduralBlock,
        scope_prefix: &str,
        nets: &HashMap<String, NetId>,
    ) -> Result<(), ElaborationError> {
        let (kind, triggers) = match proc.kind {
            ProceduralKind::Initial => (BirProcessKind::Initial, Vec::new()),
            ProceduralKind::AlwaysComb => {
                // Auto-infer sensitivity from read nets
                let mut trig_nets = Vec::new();
                self.collect_read_nets(&proc.body, nets, &mut trig_nets);
                let triggers = trig_nets.into_iter().map(|id| BirTrigger { net: id, edge: EdgeKind::AnyChange }).collect();
                (BirProcessKind::Combinational, triggers)
            }
            ProceduralKind::Always | ProceduralKind::AlwaysFf => {
                let mut triggers = Vec::new();
                if let Some(sens_list) = &proc.sensitivity {
                    for item in sens_list {
                        if let Expr::Ident(ref name, _) = item.signal {
                            if let Some(&net_id) = nets.get(name) {
                                triggers.push(BirTrigger { net: net_id, edge: item.edge });
                            }
                        }
                    }
                }
                let kind = if triggers.iter().any(|t| matches!(t.edge, EdgeKind::Posedge | EdgeKind::Negedge)) {
                    BirProcessKind::Clocked
                } else {
                    BirProcessKind::Combinational
                };
                (kind, triggers)
            }
            ProceduralKind::AlwaysLatch => (BirProcessKind::Combinational, Vec::new()),
        };

        let body = self.lower_statement(&proc.body, nets)?;
        let name = format!("{scope_prefix}.proc_{}", self.circuit.processes.len());
        self.circuit.add_process(name, kind, triggers, body);
        Ok(())
    }

    fn lower_statement(&self, stmt: &Statement, nets: &HashMap<String, NetId>) -> Result<Vec<BirStatement>, ElaborationError> {
        let mut stmts = Vec::new();
        match stmt {
            Statement::Block(inner) => {
                for s in inner {
                    stmts.extend(self.lower_statement(s, nets)?);
                }
            }
            Statement::BlockingAssign { lhs, rhs, .. } => {
                let target = self.resolve_lvalue_net(lhs, nets)?;
                let expr = self.lower_expr(rhs, nets)?;
                stmts.push(BirStatement::Assign { target, expr, is_nonblocking: false });
            }
            Statement::NonBlockingAssign { lhs, rhs, .. } => {
                let target = self.resolve_lvalue_net(lhs, nets)?;
                let expr = self.lower_expr(rhs, nets)?;
                stmts.push(BirStatement::Assign { target, expr, is_nonblocking: true });
            }
            Statement::If { cond, then_branch, else_branch, .. } => {
                let cond_expr = self.lower_expr(cond, nets)?;
                let then_body = self.lower_statement(then_branch, nets)?;
                let else_body = if let Some(else_b) = else_branch {
                    self.lower_statement(else_b, nets)?
                } else {
                    Vec::new()
                };
                stmts.push(BirStatement::If {
                    cond: cond_expr,
                    then_body,
                    else_body,
                });
            }
            Statement::Case { expr, items, .. } => {
                let case_target = self.lower_expr(expr, nets)?;
                let mut current_else = Vec::new();

                // Lower items in reverse order to form nested if-else chain
                for item in items.iter().rev() {
                    let body = self.lower_statement(&item.body, nets)?;
                    if item.patterns.is_empty() {
                        // Default branch
                        current_else = body;
                    } else {
                        // Condition: (case_target == pat0) || (case_target == pat1)...
                        let mut cond = None;
                        for pat in &item.patterns {
                            let pat_expr = self.lower_expr(pat, nets)?;
                            let eq_expr = BirExpr::Binary {
                                op: BinaryOp::Eq,
                                lhs: Box::new(case_target.clone()),
                                rhs: Box::new(pat_expr),
                            };
                            cond = Some(match cond {
                                Some(prev) => BirExpr::Binary {
                                    op: BinaryOp::LogicOr,
                                    lhs: Box::new(prev),
                                    rhs: Box::new(eq_expr),
                                },
                                None => eq_expr,
                            });
                        }
                        if let Some(c) = cond {
                            current_else = vec![BirStatement::If {
                                cond: c,
                                then_body: body,
                                else_body: current_else,
                            }];
                        }
                    }
                }
                stmts.extend(current_else);
            }
            Statement::Delay { stmt, .. } => {
                if let Some(inner) = stmt {
                    stmts.extend(self.lower_statement(inner, nets)?);
                }
            }
            Statement::TaskCall { .. } => {}
            _ => {}
        }
        Ok(stmts)
    }

    fn lower_expr(&self, expr: &Expr, nets: &HashMap<String, NetId>) -> Result<BirExpr, ElaborationError> {
        match expr {
            Expr::Ident(name, _) => {
                let id = *nets.get(name).ok_or_else(|| ElaborationError::SignalNotFound(name.clone(), "expression".into()))?;
                Ok(BirExpr::Net(id))
            }
            Expr::Number(vec, _) => Ok(BirExpr::Const(vec.clone())),
            Expr::UnsizedInt(val, _) => Ok(BirExpr::Const(LogicVector::from_u64(*val, 32))),
            Expr::Unary { op, expr, .. } => {
                let inner = self.lower_expr(expr, nets)?;
                Ok(BirExpr::Unary { op: *op, expr: Box::new(inner) })
            }
            Expr::Binary { op, lhs, rhs, .. } => {
                let l = self.lower_expr(lhs, nets)?;
                let r = self.lower_expr(rhs, nets)?;
                Ok(BirExpr::Binary { op: *op, lhs: Box::new(l), rhs: Box::new(r) })
            }
            Expr::Slice { target, msb, lsb, .. } => {
                let t = self.lower_expr(target, nets)?;
                let lsb_val = self.eval_const_expr(lsb, &HashMap::new()).unwrap_or(0) as u32;
                let msb_val = self.eval_const_expr(msb, &HashMap::new()).unwrap_or(0) as u32;
                let width = msb_val - lsb_val + 1;
                Ok(BirExpr::Slice { target: Box::new(t), lsb: lsb_val, width })
            }
            Expr::Concat(items, _) => {
                let mut lowered = Vec::new();
                for item in items {
                    lowered.push(self.lower_expr(item, nets)?);
                }
                Ok(BirExpr::Concat(lowered))
            }
            Expr::Replication { count, expr, .. } => {
                let c = self.eval_const_expr(count, &HashMap::new()).unwrap_or(1) as usize;
                let inner = self.lower_expr(expr, nets)?;
                let mut items = Vec::new();
                for _ in 0..c {
                    items.push(inner.clone());
                }
                Ok(BirExpr::Concat(items))
            }
            _ => Ok(BirExpr::Const(LogicVector::zeros(1))),
        }
    }

    fn collect_read_nets(&self, stmt: &Statement, nets: &HashMap<String, NetId>, out: &mut Vec<NetId>) {
        match stmt {
            Statement::Block(inner) => {
                for s in inner {
                    self.collect_read_nets(s, nets, out);
                }
            }
            Statement::BlockingAssign { rhs, .. } | Statement::NonBlockingAssign { rhs, .. } => {
                self.collect_expr_read_nets(rhs, nets, out);
            }
            Statement::If { cond, then_branch, else_branch, .. } => {
                self.collect_expr_read_nets(cond, nets, out);
                self.collect_read_nets(then_branch, nets, out);
                if let Some(eb) = else_branch {
                    self.collect_read_nets(eb, nets, out);
                }
            }
            Statement::Delay { stmt, .. } => {
                if let Some(inner) = stmt {
                    self.collect_read_nets(inner, nets, out);
                }
            }
            Statement::TaskCall { args, .. } => {
                for a in args {
                    self.collect_expr_read_nets(a, nets, out);
                }
            }
            _ => {}
        }
    }

    fn collect_expr_read_nets(&self, expr: &Expr, nets: &HashMap<String, NetId>, out: &mut Vec<NetId>) {
        match expr {
            Expr::Ident(name, _) => {
                if let Some(&id) = nets.get(name) {
                    if !out.contains(&id) {
                        out.push(id);
                    }
                }
            }
            Expr::Unary { expr, .. } => self.collect_expr_read_nets(expr, nets, out),
            Expr::Binary { lhs, rhs, .. } => {
                self.collect_expr_read_nets(lhs, nets, out);
                self.collect_expr_read_nets(rhs, nets, out);
            }
            Expr::Ternary { cond, then_expr, else_expr, .. } => {
                self.collect_expr_read_nets(cond, nets, out);
                self.collect_expr_read_nets(then_expr, nets, out);
                self.collect_expr_read_nets(else_expr, nets, out);
            }
            Expr::Concat(items, _) => {
                for it in items {
                    self.collect_expr_read_nets(it, nets, out);
                }
            }
            Expr::Replication { count, expr, .. } => {
                self.collect_expr_read_nets(count, nets, out);
                self.collect_expr_read_nets(expr, nets, out);
            }
            Expr::Call { args, .. } => {
                for a in args {
                    self.collect_expr_read_nets(a, nets, out);
                }
            }
            _ => {}
        }
    }

    fn resolve_lvalue_net(&self, expr: &Expr, nets: &HashMap<String, NetId>) -> Result<NetId, ElaborationError> {
        match expr {
            Expr::Ident(name, _) => nets.get(name).copied()
                .ok_or_else(|| ElaborationError::SignalNotFound(name.clone(), "lvalue".into())),
            Expr::Slice { target, .. } => self.resolve_lvalue_net(target, nets),
            _ => Err(ElaborationError::ConstEvalError("Unsupported complex lvalue".into())),
        }
    }

    fn eval_range_width(&self, range: &Range, params: &HashMap<String, u64>) -> Result<u32, ElaborationError> {
        let msb = self.eval_const_expr(&range.msb, params)?;
        let lsb = self.eval_const_expr(&range.lsb, params)?;
        if msb >= lsb {
            Ok((msb - lsb + 1) as u32)
        } else {
            Ok((lsb - msb + 1) as u32)
        }
    }

    fn eval_const_expr(&self, expr: &Expr, params: &HashMap<String, u64>) -> Result<u64, ElaborationError> {
        match expr {
            Expr::UnsizedInt(val, _) => Ok(*val),
            Expr::Number(vec, _) => Ok(vec.to_u64().unwrap_or(0)),
            Expr::Ident(name, _) => params.get(name).copied()
                .ok_or_else(|| ElaborationError::ConstEvalError(format!("Parameter '{name}' not found"))),
            Expr::Binary { op, lhs, rhs, .. } => {
                let l = self.eval_const_expr(lhs, params)?;
                let r = self.eval_const_expr(rhs, params)?;
                match op {
                    BinaryOp::Add => Ok(l + r),
                    BinaryOp::Sub => Ok(l.saturating_sub(r)),
                    BinaryOp::Mul => Ok(l * r),
                    BinaryOp::Div => if r != 0 { Ok(l / r) } else { Ok(0) },
                    BinaryOp::Shl => Ok(l << r),
                    BinaryOp::Shr => Ok(l >> r),
                    _ => Ok(0),
                }
            }
            _ => Ok(0),
        }
    }

    fn elaborate_primitive_instance(
        &mut self,
        kind: PrimitiveKind,
        inst: &'a InstanceDef,
        scope_prefix: &str,
        local_nets: &HashMap<String, NetId>,
        resolved_params: &HashMap<String, u64>,
    ) -> Result<(), ElaborationError> {
        let mut prim_params = HashMap::new();
        for (pname, pexpr) in &inst.param_bindings {
            let pval = self.eval_const_expr(pexpr, resolved_params)?;
            prim_params.insert(pname.clone(), pval);
        }

        let mut port_nets = HashMap::new();
        for (pname, expr) in &inst.port_bindings {
            if let Some(net_id) = self.resolve_port_expr_to_net(expr, local_nets, scope_prefix)? {
                port_nets.insert(pname.clone(), net_id);
            }
        }

        self.circuit.primitive_instances.push(BirPrimitiveInstance {
            name: inst.instance_name.clone(),
            primitive_kind: kind,
            scope: scope_prefix.to_string(),
            ports: port_nets.clone(),
            params: prim_params.clone(),
        });

        match kind {
            PrimitiveKind::Lut6_2
            | PrimitiveKind::Lut6
            | PrimitiveKind::Lut5
            | PrimitiveKind::Lut4
            | PrimitiveKind::Lut3
            | PrimitiveKind::Lut2
            | PrimitiveKind::Lut1 => {
                crate::primitives::elaborate_lut(
                    kind,
                    &inst.instance_name,
                    scope_prefix,
                    &mut self.circuit,
                    &port_nets,
                    &prim_params,
                );
            }
            PrimitiveKind::Bufg | PrimitiveKind::Bufgce | PrimitiveKind::Ibuf | PrimitiveKind::Obuf => {
                crate::primitives::elaborate_clock(
                    kind,
                    &inst.instance_name,
                    scope_prefix,
                    &mut self.circuit,
                    &port_nets,
                    &prim_params,
                );
            }
            PrimitiveKind::Fdre
            | PrimitiveKind::Fdse
            | PrimitiveKind::Fdce
            | PrimitiveKind::Fdpe
            | PrimitiveKind::Carry4
            | PrimitiveKind::Carry8 => {
                crate::primitives::elaborate_seq(
                    kind,
                    &inst.instance_name,
                    scope_prefix,
                    &mut self.circuit,
                    &port_nets,
                    &prim_params,
                );
            }
            PrimitiveKind::Dsp48e2 | PrimitiveKind::Dsp48e1 => {
                crate::primitives::elaborate_dsp48(
                    kind,
                    &inst.instance_name,
                    scope_prefix,
                    &mut self.circuit,
                    &port_nets,
                    &prim_params,
                );
            }
            PrimitiveKind::Ramb36e2 | PrimitiveKind::Ramb18e2 => {
                crate::primitives::elaborate_ramb36(
                    kind,
                    &inst.instance_name,
                    scope_prefix,
                    &mut self.circuit,
                    &port_nets,
                    &prim_params,
                );
            }
        }

        Ok(())
    }

    fn resolve_port_expr_to_net(
        &mut self,
        expr: &Expr,
        local_nets: &HashMap<String, NetId>,
        scope_prefix: &str,
    ) -> Result<Option<NetId>, ElaborationError> {
        match expr {
            Expr::Ident(name, _) => Ok(local_nets.get(name).copied()),
            Expr::Number(vec, _) => {
                let width = vec.width();
                let net_name = format!("{scope_prefix}._const_w{}_{}", width, self.circuit.nets.len());
                let net_id = self.circuit.add_net(net_name, width, vec.clone());
                Ok(Some(net_id))
            }
            Expr::UnsizedInt(val, _) => {
                let net_name = format!("{scope_prefix}._const_u_{}", self.circuit.nets.len());
                let net_id = self.circuit.add_net(net_name, 1, LogicVector::from_u64(*val, 1));
                Ok(Some(net_id))
            }
            Expr::Slice { target, msb, lsb, .. } => {
                if let Expr::Ident(ref name, _) = **target {
                    if let Some(&src_id) = local_nets.get(name) {
                        let msb_v = self.eval_const_expr(msb, &HashMap::new())? as u32;
                        let lsb_v = self.eval_const_expr(lsb, &HashMap::new())? as u32;
                        let width = (msb_v.max(lsb_v) - msb_v.min(lsb_v)) + 1;
                        let slice_name = format!("{scope_prefix}.{name}_{msb_v}_{lsb_v}");
                        let slice_id = self.circuit.add_net(slice_name, width, LogicVector::zeros(width));
                        self.circuit.add_continuous_assign(
                            slice_id,
                            BirExpr::Slice {
                                target: Box::new(BirExpr::Net(src_id)),
                                lsb: lsb_v.min(msb_v),
                                width,
                            },
                        );
                        return Ok(Some(slice_id));
                    }
                }
                Ok(None)
            }
            _ => Ok(None),
        }
    }
}
