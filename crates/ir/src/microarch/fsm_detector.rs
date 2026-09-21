use super::types::*;
use crate::bir::BirCircuit;
use axiom_syntax::ast::*;
use hashbrown::{HashMap, HashSet};

#[derive(Debug, Clone, Default)]
struct SeqStateInfo {
    clock_net: Option<String>,
    reset_net: Option<String>,
    state_var: String,
    reset_val: Option<u64>,
    reset_ident: Option<String>,
    next_state_var: Option<String>,
}

pub struct FsmDetector;

impl FsmDetector {
    pub fn detect_fsms(module: &ModuleDef, _circuit: &BirCircuit) -> Vec<MacroBlock> {
        let mut fsms = Vec::new();

        // 1. Collect named constants (parameters / localparams)
        let mut val_to_name: HashMap<u64, String> = HashMap::new();
        let mut name_to_val: HashMap<String, u64> = HashMap::new();

        for param in &module.params {
            if let Some(val) = Self::eval_const_expr(&param.value) {
                val_to_name.insert(val, param.name.clone());
                name_to_val.insert(param.name.clone(), val);
            }
        }
        for item in &module.items {
            if let ModuleItem::ParamDecl(param) = item {
                if let Some(val) = Self::eval_const_expr(&param.value) {
                    val_to_name.insert(val, param.name.clone());
                    name_to_val.insert(param.name.clone(), val);
                }
            }
        }

        // 2. Scan all procedural blocks for sequential state registers (clock, reset, next_state)
        let mut seq_info_map: HashMap<String, SeqStateInfo> = HashMap::new();
        for item in &module.items {
            if let ModuleItem::ProceduralBlock(proc) = item {
                Self::extract_seq_state_info(proc, &name_to_val, &mut seq_info_map);
            }
        }

        // 3. Scan procedural blocks for FSMs (both 1-always and 2-always/3-always)
        let mut detected_state_vars: HashSet<String> = HashSet::new();

        for (proc_idx, item) in module.items.iter().enumerate() {
            if let ModuleItem::ProceduralBlock(proc) = item {
                if let Some(macro_block) = Self::analyze_procedural_block(
                    proc,
                    module,
                    &val_to_name,
                    &name_to_val,
                    &seq_info_map,
                    &mut detected_state_vars,
                    proc_idx,
                ) {
                    fsms.push(macro_block);
                }
            }
        }

        fsms
    }

    fn extract_seq_state_info(
        proc: &ProceduralBlock,
        name_to_val: &HashMap<String, u64>,
        out_map: &mut HashMap<String, SeqStateInfo>,
    ) {
        let mut clock_net = None;
        let mut reset_net = None;

        if let Some(sens) = &proc.sensitivity {
            for item in sens {
                if let Expr::Ident(ref name, _) = item.signal {
                    if name.contains("clk") {
                        clock_net = Some(name.clone());
                    } else if name.contains("rst") {
                        reset_net = Some(name.clone());
                    }
                }
            }
        }

        if clock_net.is_none() {
            return;
        }

        let mut seq_info = SeqStateInfo {
            clock_net,
            reset_net,
            state_var: String::new(),
            reset_val: None,
            reset_ident: None,
            next_state_var: None,
        };

        Self::find_seq_assigns(&proc.body, name_to_val, &mut seq_info);

        if !seq_info.state_var.is_empty() {
            let state_var = seq_info.state_var.clone();
            if let Some(ref next_var) = seq_info.next_state_var {
                out_map.insert(next_var.clone(), seq_info.clone());
            }
            out_map.insert(state_var, seq_info);
        }
    }

    fn find_seq_assigns(
        stmt: &Statement,
        name_to_val: &HashMap<String, u64>,
        info: &mut SeqStateInfo,
    ) {
        match stmt {
            Statement::Block(stmts) => {
                for s in stmts {
                    Self::find_seq_assigns(s, name_to_val, info);
                }
            }
            Statement::If { cond: _, then_branch, else_branch, .. } => {
                Self::find_reset_assign(then_branch, &mut info.reset_val, &mut info.reset_ident, &mut info.state_var, name_to_val);
                if let Some(else_b) = else_branch {
                    Self::find_clocked_next_assign(else_b, &mut info.state_var, &mut info.next_state_var);
                }
            }
            Statement::NonBlockingAssign { lhs, rhs, .. } | Statement::BlockingAssign { lhs, rhs, .. } => {
                if let Expr::Ident(name, _) = lhs {
                    if name.contains("state") {
                        if info.state_var.is_empty() {
                            info.state_var = name.clone();
                        }
                        if let Expr::Ident(ref r_name, _) = rhs {
                            if r_name.contains("next") {
                                info.next_state_var = Some(r_name.clone());
                            }
                        }
                    }
                }
            }
            _ => {}
        }
    }

    fn find_reset_assign(
        stmt: &Statement,
        reset_val: &mut Option<u64>,
        reset_ident: &mut Option<String>,
        state_var: &mut String,
        name_to_val: &HashMap<String, u64>,
    ) {
        match stmt {
            Statement::Block(stmts) => {
                for s in stmts {
                    Self::find_reset_assign(s, reset_val, reset_ident, state_var, name_to_val);
                }
            }
            Statement::NonBlockingAssign { lhs, rhs, .. } | Statement::BlockingAssign { lhs, rhs, .. } => {
                if let Expr::Ident(name, _) = lhs {
                    if name.contains("state") {
                        if state_var.is_empty() {
                            *state_var = name.clone();
                        }
                        if let Expr::Ident(ref id, _) = rhs {
                            *reset_ident = Some(id.clone());
                            if let Some(&v) = name_to_val.get(id) {
                                *reset_val = Some(v);
                            }
                        } else if let Some(v) = Self::eval_const_expr(rhs) {
                            *reset_val = Some(v);
                        }
                    }
                }
            }
            _ => {}
        }
    }

    fn find_clocked_next_assign(
        stmt: &Statement,
        state_var: &mut String,
        next_state_var: &mut Option<String>,
    ) {
        match stmt {
            Statement::Block(stmts) => {
                for s in stmts {
                    Self::find_clocked_next_assign(s, state_var, next_state_var);
                }
            }
            Statement::NonBlockingAssign { lhs, rhs, .. } | Statement::BlockingAssign { lhs, rhs, .. } => {
                if let Expr::Ident(name, _) = lhs {
                    if name.contains("state") {
                        if state_var.is_empty() {
                            *state_var = name.clone();
                        }
                        if let Expr::Ident(ref r_name, _) = rhs {
                            *next_state_var = Some(r_name.clone());
                        }
                    }
                }
            }
            _ => {}
        }
    }

    fn analyze_procedural_block(
        proc: &ProceduralBlock,
        module: &ModuleDef,
        val_to_name: &HashMap<u64, String>,
        name_to_val: &HashMap<String, u64>,
        seq_info_map: &HashMap<String, SeqStateInfo>,
        detected_state_vars: &mut HashSet<String>,
        proc_idx: usize,
    ) -> Option<MacroBlock> {
        let mut block_clock_net = None;
        let mut block_reset_net = None;

        if let Some(sens) = &proc.sensitivity {
            for item in sens {
                if let Expr::Ident(ref name, _) = item.signal {
                    if name.contains("clk") {
                        block_clock_net = Some(name.clone());
                    } else if name.contains("rst") {
                        block_reset_net = Some(name.clone());
                    }
                }
            }
        }

        let mut found_fsm = None;

        Self::find_case_on_state(&proc.body, &mut |case_var, items, local_reset_val, local_reset_ident| {
            if found_fsm.is_some() || detected_state_vars.contains(case_var) {
                return;
            }

            let seq_info = seq_info_map.get(case_var);
            let clock_net = seq_info.and_then(|s| s.clock_net.clone()).or_else(|| block_clock_net.clone());
            let reset_net = seq_info.and_then(|s| s.reset_net.clone()).or_else(|| block_reset_net.clone());
            let reset_val = seq_info.and_then(|s| s.reset_val).or(local_reset_val);
            let reset_ident = seq_info.and_then(|s| s.reset_ident.clone()).or(local_reset_ident);
            let next_state_var = seq_info.and_then(|s| s.next_state_var.clone());

            let mut states = Vec::new();
            let mut transitions = Vec::new();
            let mut inputs_set = HashSet::new();
            let mut outputs_set = HashSet::new();

            for (idx, item) in items.iter().enumerate() {
                let first_pat = item.patterns.first();
                let is_default = first_pat.is_none();
                let (state_val, state_name) = Self::resolve_state_item(first_pat, idx, val_to_name, name_to_val);

                let is_reset = if let Some(ref r_id) = reset_ident {
                    &state_name == r_id
                } else if let Some(r_val) = reset_val {
                    state_val == r_val
                } else {
                    idx == 0 && !is_default
                };

                let mut moore_outputs = Vec::new();
                Self::extract_transitions_and_outputs(
                    &item.body,
                    &state_name,
                    case_var,
                    next_state_var.as_deref(),
                    val_to_name,
                    name_to_val,
                    &mut transitions,
                    &mut moore_outputs,
                    &mut inputs_set,
                    &mut outputs_set,
                );

                if !is_default {
                    states.push(FsmState {
                        id: format!("state_{}", state_val),
                        name: state_name,
                        value: state_val,
                        binary_str: format!("{:02b}", state_val),
                        is_reset,
                        moore_outputs,
                    });
                }
            }

            if states.len() >= 2 {
                let reset_state_name = reset_ident
                    .clone()
                    .or_else(|| reset_val.and_then(|r| val_to_name.get(&r).cloned()))
                    .unwrap_or_else(|| {
                        states.first().map(|s| s.name.clone()).unwrap_or_else(|| "IDLE".to_string())
                    });

                let state_width = Self::find_state_width(module, case_var);

                let fsm_macro = FsmMacro {
                    state_reg: case_var.to_string(),
                    state_width,
                    reset_state: reset_state_name.clone(),
                    current_state_default: reset_state_name,
                    states,
                    transitions,
                    inputs: inputs_set.into_iter().collect(),
                    outputs: outputs_set.into_iter().collect(),
                };

                detected_state_vars.insert(case_var.to_string());
                found_fsm = Some((case_var.to_string(), fsm_macro, clock_net, reset_net));
            }
        });

        if let Some((state_var, fsm_macro, clock_net, reset_net)) = found_fsm {
            let mut ports = Vec::new();
            if let Some(ref clk) = clock_net {
                ports.push(MacroPort {
                    id: "port_clk".to_string(),
                    name: clk.clone(),
                    width: 1,
                    direction: MacroPortDirection::In,
                    is_clock: true,
                    is_reset: false,
                    is_datapath: false,
                    offset_x: 20.0,
                    offset_y: 80.0,
                });
            }
            if let Some(ref rst) = reset_net {
                ports.push(MacroPort {
                    id: "port_rst".to_string(),
                    name: rst.clone(),
                    width: 1,
                    direction: MacroPortDirection::In,
                    is_clock: false,
                    is_reset: true,
                    is_datapath: false,
                    offset_x: 40.0,
                    offset_y: 80.0,
                });
            }
            for inp in &fsm_macro.inputs {
                ports.push(MacroPort {
                    id: format!("in_{}", inp),
                    name: inp.clone(),
                    width: 1,
                    direction: MacroPortDirection::In,
                    is_clock: false,
                    is_reset: false,
                    is_datapath: false,
                    offset_x: 0.0,
                    offset_y: 20.0,
                });
            }
            for out in &fsm_macro.outputs {
                ports.push(MacroPort {
                    id: format!("out_{}", out),
                    name: out.clone(),
                    width: 1,
                    direction: MacroPortDirection::Out,
                    is_clock: false,
                    is_reset: false,
                    is_datapath: false,
                    offset_x: 160.0,
                    offset_y: 20.0,
                });
            }

            let label = if state_var.to_lowercase().contains("tx") {
                "TX Controller FSM".to_string()
            } else if state_var.to_lowercase().contains("rx") {
                "RX Controller FSM".to_string()
            } else if state_var.to_lowercase().contains("spi") {
                "SPI Protocol FSM".to_string()
            } else {
                format!("{} FSM", state_var.to_uppercase())
            };

            return Some(MacroBlock {
                id: format!("fsm_block_{}_{}", state_var, proc_idx),
                name: state_var.clone(),
                label,
                sublabel: format!("{} States | Synchronous STG", fsm_macro.states.len()),
                category: MacroCategory::Control,
                kind: MacroKind::Fsm(fsm_macro),
                inputs: ports.iter().filter(|p| p.direction == MacroPortDirection::In).cloned().collect(),
                outputs: ports.iter().filter(|p| p.direction == MacroPortDirection::Out).cloned().collect(),
                x: 0.0,
                y: 0.0,
                width: 180.0,
                height: 100.0,
                clock_domain: clock_net,
                latency_cycles: 1,
                source_line: None,
            });
        }

        None
    }

    fn find_state_width(module: &ModuleDef, state_var: &str) -> u32 {
        for item in &module.items {
            if let ModuleItem::NetDecl(net) = item {
                if net.names.iter().any(|n| n == state_var) {
                    if let Some(ref range) = net.range {
                        if let (Some(msb), Some(lsb)) = (Self::eval_const_expr(&range.msb), Self::eval_const_expr(&range.lsb)) {
                            return (msb.abs_diff(lsb) + 1) as u32;
                        }
                    }
                    return 1;
                }
            }
        }
        for port in &module.ports {
            if port.name == state_var {
                if let Some(ref range) = port.range {
                    if let (Some(msb), Some(lsb)) = (Self::eval_const_expr(&range.msb), Self::eval_const_expr(&range.lsb)) {
                        return (msb.abs_diff(lsb) + 1) as u32;
                    }
                }
                return 1;
            }
        }
        2
    }

    fn resolve_state_item(
        pat: Option<&Expr>,
        idx: usize,
        val_to_name: &HashMap<u64, String>,
        name_to_val: &HashMap<String, u64>,
    ) -> (u64, String) {
        match pat {
            Some(Expr::Ident(name, _)) => {
                let val = name_to_val.get(name).copied().unwrap_or(idx as u64);
                (val, name.clone())
            }
            Some(e) => {
                if let Some(val) = Self::eval_const_expr(e) {
                    let name = val_to_name.get(&val).cloned().unwrap_or_else(|| format!("STATE_{}", val));
                    (val, name)
                } else {
                    (idx as u64, format!("STATE_{}", idx))
                }
            }
            None => (999, "DEFAULT".to_string()),
        }
    }

    fn find_case_on_state<F>(stmt: &Statement, cb: &mut F)
    where
        F: FnMut(&str, &[CaseItem], Option<u64>, Option<String>),
    {
        match stmt {
            Statement::Block(inner) => {
                let mut reset_val = None;
                let mut reset_ident = None;
                for s in inner {
                    if let Statement::If { cond: _, then_branch, else_branch: Some(else_b), .. } = s {
                        Self::find_reset_in_stmt(then_branch, &mut reset_val, &mut reset_ident);
                        Self::find_case_in_stmt(else_b, reset_val, reset_ident.clone(), cb);
                    } else {
                        Self::find_case_in_stmt(s, reset_val, reset_ident.clone(), cb);
                    }
                }
            }
            Statement::If { cond: _, then_branch, else_branch, .. } => {
                let mut reset_val = None;
                let mut reset_ident = None;
                Self::find_reset_in_stmt(then_branch, &mut reset_val, &mut reset_ident);
                if let Some(else_b) = else_branch {
                    Self::find_case_in_stmt(else_b, reset_val, reset_ident, cb);
                }
            }
            _ => {
                Self::find_case_in_stmt(stmt, None, None, cb);
            }
        }
    }

    fn find_reset_in_stmt(stmt: &Statement, reset_val: &mut Option<u64>, reset_ident: &mut Option<String>) {
        match stmt {
            Statement::Block(stmts) => {
                for s in stmts {
                    Self::find_reset_in_stmt(s, reset_val, reset_ident);
                }
            }
            Statement::NonBlockingAssign { lhs, rhs, .. } | Statement::BlockingAssign { lhs, rhs, .. } => {
                if let Expr::Ident(name, _) = lhs {
                    if name.contains("state") {
                        if let Expr::Ident(ref id, _) = rhs {
                            *reset_ident = Some(id.clone());
                        } else if let Some(v) = Self::eval_const_expr(rhs) {
                            *reset_val = Some(v);
                        }
                    }
                }
            }
            _ => {}
        }
    }

    fn find_case_in_stmt<F>(stmt: &Statement, reset_val: Option<u64>, reset_ident: Option<String>, cb: &mut F)
    where
        F: FnMut(&str, &[CaseItem], Option<u64>, Option<String>),
    {
        match stmt {
            Statement::Block(stmts) => {
                for s in stmts {
                    Self::find_case_in_stmt(s, reset_val, reset_ident.clone(), cb);
                }
            }
            Statement::Case { expr, items, .. } => {
                if let Expr::Ident(ref name, _) = expr {
                    cb(name, items, reset_val, reset_ident);
                }
            }
            Statement::If { then_branch, else_branch, .. } => {
                Self::find_case_in_stmt(then_branch, reset_val, reset_ident.clone(), cb);
                if let Some(else_b) = else_branch {
                    Self::find_case_in_stmt(else_b, reset_val, reset_ident, cb);
                }
            }
            _ => {}
        }
    }

    fn is_state_target(target: &str, state_var: &str, next_state_var: Option<&str>) -> bool {
        target == state_var
            || next_state_var.map_or(false, |nv| target == nv)
            || target.contains("next")
            || (state_var.contains("state") && target.contains("state"))
    }

    fn extract_transitions_and_outputs(
        stmt: &Statement,
        current_state: &str,
        state_var: &str,
        next_state_var: Option<&str>,
        val_to_name: &HashMap<u64, String>,
        name_to_val: &HashMap<String, u64>,
        transitions: &mut Vec<FsmTransition>,
        moore_outputs: &mut Vec<(String, String)>,
        inputs_set: &mut HashSet<String>,
        outputs_set: &mut HashSet<String>,
    ) {
        match stmt {
            Statement::Block(stmts) => {
                for s in stmts {
                    Self::extract_transitions_and_outputs(
                        s,
                        current_state,
                        state_var,
                        next_state_var,
                        val_to_name,
                        name_to_val,
                        transitions,
                        moore_outputs,
                        inputs_set,
                        outputs_set,
                    );
                }
            }
            Statement::NonBlockingAssign { lhs, rhs, .. } | Statement::BlockingAssign { lhs, rhs, .. } => {
                if let Expr::Ident(target, _) = lhs {
                    if Self::is_state_target(target, state_var, next_state_var) {
                        let dest_name = Self::resolve_state_name(rhs, val_to_name, name_to_val);
                        transitions.push(FsmTransition {
                            from_state: current_state.to_string(),
                            to_state: dest_name,
                            condition: "always".to_string(),
                            mealy_outputs: Vec::new(),
                        });
                    } else {
                        outputs_set.insert(target.clone());
                        moore_outputs.push((target.clone(), Self::expr_to_string(rhs)));
                    }
                }
            }
            Statement::If { cond, then_branch, else_branch, .. } => {
                Self::collect_expr_vars(cond, inputs_set);
                let cond_str = Self::expr_to_string(cond);

                let mut then_next_state = None;
                let mut then_mealy = Vec::new();
                Self::find_next_state_and_mealy(
                    then_branch,
                    state_var,
                    next_state_var,
                    val_to_name,
                    name_to_val,
                    &mut then_next_state,
                    &mut then_mealy,
                    outputs_set,
                );

                if let Some(dest) = then_next_state {
                    transitions.push(FsmTransition {
                        from_state: current_state.to_string(),
                        to_state: dest,
                        condition: cond_str.clone(),
                        mealy_outputs: then_mealy,
                    });
                } else {
                    Self::extract_transitions_and_outputs(
                        then_branch,
                        current_state,
                        state_var,
                        next_state_var,
                        val_to_name,
                        name_to_val,
                        transitions,
                        moore_outputs,
                        inputs_set,
                        outputs_set,
                    );
                }

                if let Some(else_b) = else_branch {
                    let mut else_next_state = None;
                    let mut else_mealy = Vec::new();
                    Self::find_next_state_and_mealy(
                        else_b,
                        state_var,
                        next_state_var,
                        val_to_name,
                        name_to_val,
                        &mut else_next_state,
                        &mut else_mealy,
                        outputs_set,
                    );

                    if let Some(dest) = else_next_state {
                        let neg_cond = if cond_str.starts_with('!') {
                            cond_str.trim_start_matches('!').to_string()
                        } else {
                            format!("!{}", cond_str)
                        };
                        transitions.push(FsmTransition {
                            from_state: current_state.to_string(),
                            to_state: dest,
                            condition: neg_cond,
                            mealy_outputs: else_mealy,
                        });
                    } else {
                        Self::extract_transitions_and_outputs(
                            else_b,
                            current_state,
                            state_var,
                            next_state_var,
                            val_to_name,
                            name_to_val,
                            transitions,
                            moore_outputs,
                            inputs_set,
                            outputs_set,
                        );
                    }
                }
            }
            _ => {}
        }
    }

    fn find_next_state_and_mealy(
        stmt: &Statement,
        state_var: &str,
        next_state_var: Option<&str>,
        val_to_name: &HashMap<u64, String>,
        name_to_val: &HashMap<String, u64>,
        next_state_out: &mut Option<String>,
        mealy_out: &mut Vec<(String, String)>,
        outputs_set: &mut HashSet<String>,
    ) {
        match stmt {
            Statement::Block(stmts) => {
                for s in stmts {
                    Self::find_next_state_and_mealy(
                        s,
                        state_var,
                        next_state_var,
                        val_to_name,
                        name_to_val,
                        next_state_out,
                        mealy_out,
                        outputs_set,
                    );
                }
            }
            Statement::NonBlockingAssign { lhs, rhs, .. } | Statement::BlockingAssign { lhs, rhs, .. } => {
                if let Expr::Ident(name, _) = lhs {
                    if Self::is_state_target(name, state_var, next_state_var) {
                        *next_state_out = Some(Self::resolve_state_name(rhs, val_to_name, name_to_val));
                    } else {
                        outputs_set.insert(name.clone());
                        mealy_out.push((name.clone(), Self::expr_to_string(rhs)));
                    }
                }
            }
            Statement::If { then_branch, .. } => {
                Self::find_next_state_and_mealy(
                    then_branch,
                    state_var,
                    next_state_var,
                    val_to_name,
                    name_to_val,
                    next_state_out,
                    mealy_out,
                    outputs_set,
                );
            }
            _ => {}
        }
    }

    fn resolve_state_name(
        expr: &Expr,
        val_to_name: &HashMap<u64, String>,
        name_to_val: &HashMap<String, u64>,
    ) -> String {
        if let Expr::Ident(name, _) = expr {
            return name.clone();
        }
        if let Some(v) = Self::eval_const_expr(expr) {
            if let Some(name) = val_to_name.get(&v) {
                return name.clone();
            }
            return format!("STATE_{}", v);
        }
        if let Some(name) = name_to_val.iter().find_map(|(k, &v)| if Some(v) == Self::eval_const_expr(expr) { Some(k.clone()) } else { None }) {
            return name;
        }
        Self::expr_to_string(expr)
    }

    fn collect_expr_vars(expr: &Expr, out: &mut hashbrown::HashSet<String>) {
        match expr {
            Expr::Ident(name, _) => {
                out.insert(name.clone());
            }
            Expr::Unary { expr: inner, .. } => {
                Self::collect_expr_vars(inner, out);
            }
            Expr::Binary { lhs, rhs, .. } => {
                Self::collect_expr_vars(lhs, out);
                Self::collect_expr_vars(rhs, out);
            }
            Expr::Ternary { cond, then_expr, else_expr, .. } => {
                Self::collect_expr_vars(cond, out);
                Self::collect_expr_vars(then_expr, out);
                Self::collect_expr_vars(else_expr, out);
            }
            Expr::Slice { target, .. } => {
                Self::collect_expr_vars(target, out);
            }
            _ => {}
        }
    }

    fn expr_to_string(expr: &Expr) -> String {
        match expr {
            Expr::Ident(name, _) => name.clone(),
            Expr::Number(vec, _) => format!("{}", vec.to_u64().unwrap_or(0)),
            Expr::UnsizedInt(v, _) => format!("{}", v),
            Expr::StringLiteral(s, _) => format!("\"{}\"", s),
            Expr::Unary { op, expr: inner, .. } => {
                let op_str = match op {
                    UnaryOp::Not => "~",
                    UnaryOp::LogicNot => "!",
                    UnaryOp::Minus => "-",
                    _ => "",
                };
                format!("{}{}", op_str, Self::expr_to_string(inner))
            }
            Expr::Binary { op, lhs, rhs, .. } => {
                let op_str = match op {
                    BinaryOp::Eq => "==",
                    BinaryOp::Neq => "!=",
                    BinaryOp::Lt => "<",
                    BinaryOp::Gt => ">",
                    BinaryOp::LtEq => "<=",
                    BinaryOp::GtEq => ">=",
                    BinaryOp::BitAnd => "&",
                    BinaryOp::BitOr => "|",
                    BinaryOp::BitXor => "^",
                    BinaryOp::LogicAnd => "&&",
                    BinaryOp::LogicOr => "||",
                    BinaryOp::Add => "+",
                    BinaryOp::Sub => "-",
                    _ => "op",
                };
                format!("{} {} {}", Self::expr_to_string(lhs), op_str, Self::expr_to_string(rhs))
            }
            _ => "expr".to_string(),
        }
    }

    fn eval_const_expr(expr: &Expr) -> Option<u64> {
        match expr {
            Expr::Number(vec, _) => vec.to_u64(),
            Expr::UnsizedInt(v, _) => Some(*v),
            _ => None,
        }
    }
}
