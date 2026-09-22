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
        let port_dirs: HashMap<String, PortDirection> = module.ports.iter().map(|p| (p.name.clone(), p.direction)).collect();
        for (port_name, parent_net_id) in port_connections {
            if let Some(&child_net_id) = local_nets.get(port_name) {
                let dir = port_dirs.get(port_name).copied().unwrap_or(PortDirection::Input);
                if dir == PortDirection::Output {
                    self.circuit.add_continuous_assign(
                        *parent_net_id,
                        BirExpr::Net(child_net_id),
                    );
                } else {
                    self.circuit.add_continuous_assign(
                        child_net_id,
                        BirExpr::Net(*parent_net_id),
                    );
                }
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
                    self.elaborate_procedural_block(proc, scope_prefix, &local_nets, &resolved_params)?;
                }
                ModuleItem::Instance(inst) => {
                    if let Some(child_module) = self.modules.get(inst.module_name.as_str()).copied() {
                        let mut child_param_overrides = HashMap::new();
                        for (pname, pexpr) in &inst.param_bindings {
                            let pval = self.eval_const_expr(pexpr, &resolved_params)?;
                            child_param_overrides.insert(pname.clone(), pval);
                        }

                        let mut child_port_conns = Vec::new();
                        for (i, (pname, expr)) in inst.port_bindings.iter().enumerate() {
                            let port_key = if let Ok(idx) = pname.parse::<usize>() {
                                child_module.ports.get(idx).map(|p| p.name.clone()).unwrap_or_else(|| pname.clone())
                            } else if pname.is_empty() {
                                child_module.ports.get(i).map(|p| p.name.clone()).unwrap_or_default()
                            } else {
                                pname.clone()
                            };

                            if let Some(net_id) = self.resolve_port_expr_to_net(expr, &local_nets, scope_prefix)? {
                                child_port_conns.push((port_key, net_id));
                            }
                        }

                        let child_prefix = format!("{scope_prefix}.{}", inst.instance_name);
                        self.elaborate_instance(child_module, &child_prefix, &child_param_overrides, &child_port_conns)?;
                    } else if axiom_syntax::is_gate_primitive(&inst.module_name) {
                        self.elaborate_gate_primitive(inst, &local_nets, &resolved_params)?;
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
                ModuleItem::Assertion(_) => {}
            }
        }

        Ok(())
    }

    fn elaborate_continuous_assign(
        &mut self,
        assign: &AssignStmt,
        nets: &HashMap<String, NetId>,
        params: &HashMap<String, u64>,
    ) -> Result<(), ElaborationError> {
        let target_id = self.resolve_lvalue_net(&assign.lhs, nets)?;
        let expr = self.lower_expr(&assign.rhs, nets, params)?;
        self.circuit.add_continuous_assign(target_id, expr);
        Ok(())
    }

    fn elaborate_procedural_block(
        &mut self,
        proc: &ProceduralBlock,
        scope_prefix: &str,
        nets: &HashMap<String, NetId>,
        params: &HashMap<String, u64>,
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

        let body = self.lower_statement(&proc.body, nets, params)?;
        let name = format!("{scope_prefix}.proc_{}", self.circuit.processes.len());
        self.circuit.add_process(name, kind, triggers, body);
        Ok(())
    }

    fn lower_statement(&self, stmt: &Statement, nets: &HashMap<String, NetId>, params: &HashMap<String, u64>) -> Result<Vec<BirStatement>, ElaborationError> {
        let mut stmts = Vec::new();
        match stmt {
            Statement::Block(inner) => {
                for s in inner {
                    stmts.extend(self.lower_statement(s, nets, params)?);
                }
            }
            Statement::BlockingAssign { lhs, rhs, .. } => {
                let target = self.resolve_lvalue_net(lhs, nets)?;
                let expr = self.lower_expr(rhs, nets, params)?;
                stmts.push(BirStatement::Assign { target, expr, is_nonblocking: false });
            }
            Statement::NonBlockingAssign { lhs, rhs, .. } => {
                let target = self.resolve_lvalue_net(lhs, nets)?;
                let expr = self.lower_expr(rhs, nets, params)?;
                stmts.push(BirStatement::Assign { target, expr, is_nonblocking: true });
            }
            Statement::If { cond, then_branch, else_branch, .. } => {
                let cond_expr = self.lower_expr(cond, nets, params)?;
                let then_body = self.lower_statement(then_branch, nets, params)?;
                let else_body = if let Some(else_b) = else_branch {
                    self.lower_statement(else_b, nets, params)?
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
                let case_target = self.lower_expr(expr, nets, params)?;
                let mut current_else = Vec::new();

                // Lower items in reverse order to form nested if-else chain
                for item in items.iter().rev() {
                    let body = self.lower_statement(&item.body, nets, params)?;
                    if item.patterns.is_empty() {
                        // Default branch
                        current_else = body;
                    } else {
                        // Condition: (case_target == pat0) || (case_target == pat1)...
                        let mut cond = None;
                        for pat in &item.patterns {
                            let pat_expr = self.lower_expr(pat, nets, params)?;
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
            Statement::Delay { stmt: Some(inner), .. } => {
                stmts.extend(self.lower_statement(inner, nets, params)?);
            }
            Statement::Delay { stmt: None, .. } => {}
            Statement::Forever { body, .. } => {
                stmts.extend(self.lower_statement(body, nets, params)?);
            }
            Statement::Repeat { count, body, .. } => {
                let n = self.eval_const_expr(count, params).unwrap_or(1);
                let cap = n.min(256);
                for _ in 0..cap {
                    stmts.extend(self.lower_statement(body, nets, params)?);
                }
            }
            Statement::While { body, .. } => {
                stmts.extend(self.lower_statement(body, nets, params)?);
            }
            Statement::TaskCall { .. } => {}
            _ => {}
        }
        Ok(stmts)
    }

    fn lower_expr(&self, expr: &Expr, nets: &HashMap<String, NetId>, params: &HashMap<String, u64>) -> Result<BirExpr, ElaborationError> {
        match expr {
            Expr::Ident(name, _) => {
                if let Some(&param_val) = params.get(name) {
                    return Ok(BirExpr::Const(LogicVector::from_u64(param_val, 32)));
                }
                let id = *nets.get(name).ok_or_else(|| ElaborationError::SignalNotFound(name.clone(), "expression".into()))?;
                Ok(BirExpr::Net(id))
            }
            Expr::Number(vec, _) => Ok(BirExpr::Const(vec.clone())),
            Expr::UnsizedInt(val, _) => Ok(BirExpr::Const(LogicVector::from_u64(*val, 32))),
            Expr::Unary { op, expr, .. } => {
                let inner = self.lower_expr(expr, nets, params)?;
                Ok(BirExpr::Unary { op: *op, expr: Box::new(inner) })
            }
            Expr::Binary { op, lhs, rhs, .. } => {
                let l = self.lower_expr(lhs, nets, params)?;
                let r = self.lower_expr(rhs, nets, params)?;
                Ok(BirExpr::Binary { op: *op, lhs: Box::new(l), rhs: Box::new(r) })
            }
            Expr::Slice { target, msb, lsb, .. } => {
                let t = self.lower_expr(target, nets, params)?;
                let lsb_val = self.eval_const_expr(lsb, params).unwrap_or(0) as u32;
                let msb_val = self.eval_const_expr(msb, params).unwrap_or(0) as u32;
                let width = msb_val - lsb_val + 1;
                Ok(BirExpr::Slice { target: Box::new(t), lsb: lsb_val, width })
            }
            Expr::IndexedSlice { target, base, width, is_ascending, .. } => {
                let t = self.lower_expr(target, nets, params)?;
                let base_val = self.eval_const_expr(base, params).unwrap_or(0) as u32;
                let width_val = self.eval_const_expr(width, params).unwrap_or(1) as u32;
                let lsb_val = if *is_ascending {
                    base_val
                } else {
                    base_val.saturating_sub(width_val.saturating_sub(1))
                };
                Ok(BirExpr::Slice { target: Box::new(t), lsb: lsb_val, width: width_val })
            }
            Expr::Concat(items, _) => {
                let mut lowered = Vec::new();
                for item in items {
                    lowered.push(self.lower_expr(item, nets, params)?);
                }
                Ok(BirExpr::Concat(lowered))
            }
            Expr::Replication { count, expr, .. } => {
                let c = self.eval_const_expr(count, params).unwrap_or(1) as usize;
                let inner = self.lower_expr(expr, nets, params)?;
                let mut items = Vec::new();
                for _ in 0..c {
                    items.push(inner.clone());
                }
                Ok(BirExpr::Concat(items))
            }
            Expr::Ternary { cond, then_expr, else_expr, .. } => {
                let c = self.lower_expr(cond, nets, params)?;
                let t = self.lower_expr(then_expr, nets, params)?;
                let e = self.lower_expr(else_expr, nets, params)?;
                let not_c = BirExpr::Unary {
                    op: axiom_syntax::UnaryOp::Not,
                    expr: Box::new(c.clone()),
                };
                let branch_then = BirExpr::Binary {
                    op: axiom_syntax::BinaryOp::BitAnd,
                    lhs: Box::new(c),
                    rhs: Box::new(t),
                };
                let branch_else = BirExpr::Binary {
                    op: axiom_syntax::BinaryOp::BitAnd,
                    lhs: Box::new(not_c),
                    rhs: Box::new(e),
                };
                Ok(BirExpr::Binary {
                    op: axiom_syntax::BinaryOp::BitOr,
                    lhs: Box::new(branch_then),
                    rhs: Box::new(branch_else),
                })
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
            Statement::Delay { stmt: Some(inner), .. } => {
                self.collect_read_nets(inner, nets, out);
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
                    BinaryOp::Div => Ok(l.checked_div(r).unwrap_or(0)),
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

    fn elaborate_gate_primitive(
        &mut self,
        inst: &'a InstanceDef,
        local_nets: &HashMap<String, NetId>,
        params: &HashMap<String, u64>,
    ) -> Result<(), ElaborationError> {
        if inst.port_bindings.is_empty() {
            return Ok(());
        }

        // Identify output port: first check named 'out'/'0'/'y', otherwise first element (index 0)
        let out_idx = inst
            .port_bindings
            .iter()
            .position(|(p, _)| {
                p == "0" || p.eq_ignore_ascii_case("out") || p.eq_ignore_ascii_case("y")
            })
            .unwrap_or(0);

        let out_expr = &inst.port_bindings[out_idx].1;
        let target_net = self.resolve_lvalue_net(out_expr, local_nets)?;

        // Collect input expressions
        let mut in_exprs = Vec::new();
        for (i, (_, pexpr)) in inst.port_bindings.iter().enumerate() {
            if i != out_idx {
                let bir = self.lower_expr(pexpr, local_nets, params)?;
                in_exprs.push(bir);
            }
        }

        if in_exprs.is_empty() {
            return Ok(());
        }

        let gate_type = inst.module_name.to_ascii_lowercase();
        let final_expr = match gate_type.as_str() {
            "buf" => in_exprs.remove(0),
            "not" => {
                let inner = in_exprs.remove(0);
                BirExpr::Unary {
                    op: UnaryOp::Not,
                    expr: Box::new(inner),
                }
            }
            "and" => {
                let mut acc = in_exprs.remove(0);
                for next in in_exprs {
                    acc = BirExpr::Binary {
                        op: BinaryOp::BitAnd,
                        lhs: Box::new(acc),
                        rhs: Box::new(next),
                    };
                }
                acc
            }
            "nand" => {
                let mut acc = in_exprs.remove(0);
                for next in in_exprs {
                    acc = BirExpr::Binary {
                        op: BinaryOp::BitAnd,
                        lhs: Box::new(acc),
                        rhs: Box::new(next),
                    };
                }
                BirExpr::Unary {
                    op: UnaryOp::Not,
                    expr: Box::new(acc),
                }
            }
            "or" => {
                let mut acc = in_exprs.remove(0);
                for next in in_exprs {
                    acc = BirExpr::Binary {
                        op: BinaryOp::BitOr,
                        lhs: Box::new(acc),
                        rhs: Box::new(next),
                    };
                }
                acc
            }
            "nor" => {
                let mut acc = in_exprs.remove(0);
                for next in in_exprs {
                    acc = BirExpr::Binary {
                        op: BinaryOp::BitOr,
                        lhs: Box::new(acc),
                        rhs: Box::new(next),
                    };
                }
                BirExpr::Unary {
                    op: UnaryOp::Not,
                    expr: Box::new(acc),
                }
            }
            "xor" => {
                let mut acc = in_exprs.remove(0);
                for next in in_exprs {
                    acc = BirExpr::Binary {
                        op: BinaryOp::BitXor,
                        lhs: Box::new(acc),
                        rhs: Box::new(next),
                    };
                }
                acc
            }
            "xnor" => {
                let mut acc = in_exprs.remove(0);
                for next in in_exprs {
                    acc = BirExpr::Binary {
                        op: BinaryOp::BitXor,
                        lhs: Box::new(acc),
                        rhs: Box::new(next),
                    };
                }
                BirExpr::Unary {
                    op: UnaryOp::Not,
                    expr: Box::new(acc),
                }
            }
            _ => in_exprs.remove(0),
        };

        self.circuit.add_continuous_assign(target_net, final_expr);
        Ok(())
    }
}
