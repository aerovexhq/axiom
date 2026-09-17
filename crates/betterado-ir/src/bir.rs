use betterado_core::{LogicVector};
use betterado_syntax::{BinaryOp, EdgeKind, UnaryOp};
use hashbrown::HashMap;
use serde::{Deserialize, Serialize};

/// Strongly typed unique identifier for an elaborated net.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct NetId(pub u32);

/// Strongly typed unique identifier for a procedural process or continuous assignment driver.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct ProcessId(pub u32);

/// Elaborated net (wire, reg, or logic) in the hardware netlist.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BirNet {
    pub id: NetId,
    pub name: String,
    pub width: u32,
    pub word_offset: usize, // Offset in contiguous SimStateArena
    pub capacitance_ff: f32, // Lumped capacitance in femtofarads
    pub initial_value: LogicVector,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BirLogicOp {
    Buf,
    Not,
    And,
    Or,
    Xor,
    Add,
    Sub,
    Mux, // inputs: [sel, in0, in1]
    Slice { lsb: u32, width: u32 },
    Concat,
    Const(LogicVector),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BirContinuousAssign {
    pub target: NetId,
    pub expr: BirExpr,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum BirProcessKind {
    Initial,
    Combinational,
    Clocked,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BirTrigger {
    pub net: NetId,
    pub edge: EdgeKind,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BirExpr {
    Net(NetId),
    Const(LogicVector),
    Binary {
        op: BinaryOp,
        lhs: Box<BirExpr>,
        rhs: Box<BirExpr>,
    },
    Unary {
        op: UnaryOp,
        expr: Box<BirExpr>,
    },
    Slice {
        target: Box<BirExpr>,
        lsb: u32,
        width: u32,
    },
    Concat(Vec<BirExpr>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BirStatement {
    Assign {
        target: NetId,
        expr: BirExpr,
        is_nonblocking: bool,
    },
    If {
        cond: BirExpr,
        then_body: Vec<BirStatement>,
        else_body: Vec<BirStatement>,
    },
    Block(Vec<BirStatement>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BirProcess {
    pub id: ProcessId,
    pub name: String,
    pub kind: BirProcessKind,
    pub triggers: Vec<BirTrigger>,
    pub body: Vec<BirStatement>,
}

/// Fully elaborated circuit graph ready for JIT compilation or event-driven simulation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BirCircuit {
    pub top_name: String,
    pub nets: Vec<BirNet>,
    pub net_name_to_id: HashMap<String, NetId>,
    pub continuous_assigns: Vec<BirContinuousAssign>,
    pub processes: Vec<BirProcess>,
    /// Maps each NetId to the list of processes sensitive to changes on this net
    pub sensitivity_map: HashMap<NetId, Vec<ProcessId>>,
    pub total_state_words: usize,
}

impl BirCircuit {
    pub fn new(top_name: impl Into<String>) -> Self {
        Self {
            top_name: top_name.into(),
            nets: Vec::new(),
            net_name_to_id: HashMap::new(),
            continuous_assigns: Vec::new(),
            processes: Vec::new(),
            sensitivity_map: HashMap::new(),
            total_state_words: 0,
        }
    }

    pub fn get_net(&self, id: NetId) -> Option<&BirNet> {
        self.nets.get(id.0 as usize)
    }

    pub fn get_net_by_name(&self, name: &str) -> Option<&BirNet> {
        if let Some(id) = self.net_name_to_id.get(name) {
            return self.get_net(*id);
        }
        // Resilient leaf fallback: "rst_n" matches "counter.rst_n"
        self.nets.iter().find(|n| {
            if n.name == name {
                true
            } else if let Some((_, leaf)) = n.name.rsplit_once('.') {
                leaf == name
            } else {
                false
            }
        })
    }

    pub fn add_net(&mut self, name: impl Into<String>, width: u32, initial_value: LogicVector) -> NetId {
        let id = NetId(self.nets.len() as u32);
        let name = name.into();
        let num_words = (width as usize + 63) / 64;
        let word_offset = self.total_state_words;
        self.total_state_words += num_words;

        // Estimated capacitance: 1.2 fF base pin cap + 0.8 fF per bit
        let capacitance_ff = 1.2 + (width as f32 * 0.8);

        let net = BirNet {
            id,
            name: name.clone(),
            width,
            word_offset,
            capacitance_ff,
            initial_value,
        };

        self.net_name_to_id.insert(name, id);
        self.nets.push(net);
        id
    }

    pub fn add_continuous_assign(&mut self, target: NetId, expr: BirExpr) {
        let mut read_nets = Vec::new();
        Self::collect_expr_nets(&expr, &mut read_nets);

        let assign_id = ProcessId(100_000 + self.continuous_assigns.len() as u32);
        for net_id in read_nets {
            self.sensitivity_map.entry(net_id).or_default().push(assign_id);
        }

        self.continuous_assigns.push(BirContinuousAssign {
            target,
            expr,
        });
    }

    pub fn collect_expr_nets(expr: &BirExpr, out: &mut Vec<NetId>) {
        match expr {
            BirExpr::Net(id) => {
                if !out.contains(id) {
                    out.push(*id);
                }
            }
            BirExpr::Unary { expr, .. } => Self::collect_expr_nets(expr, out),
            BirExpr::Binary { lhs, rhs, .. } => {
                Self::collect_expr_nets(lhs, out);
                Self::collect_expr_nets(rhs, out);
            }
            BirExpr::Slice { target, .. } => Self::collect_expr_nets(target, out),
            BirExpr::Concat(items) => {
                for item in items {
                    Self::collect_expr_nets(item, out);
                }
            }
            _ => {}
        }
    }

    pub fn collect_statement_read_nets(stmt: &BirStatement, out: &mut Vec<NetId>) {
        match stmt {
            BirStatement::Assign { expr, .. } => Self::collect_expr_nets(expr, out),
            BirStatement::If { cond, then_body, else_body } => {
                Self::collect_expr_nets(cond, out);
                for s in then_body {
                    Self::collect_statement_read_nets(s, out);
                }
                for s in else_body {
                    Self::collect_statement_read_nets(s, out);
                }
            }
            BirStatement::Block(stmts) => {
                for s in stmts {
                    Self::collect_statement_read_nets(s, out);
                }
            }
        }
    }

    pub fn add_process(
        &mut self,
        name: impl Into<String>,
        kind: BirProcessKind,
        mut triggers: Vec<BirTrigger>,
        body: Vec<BirStatement>,
    ) -> ProcessId {
        let id = ProcessId(self.processes.len() as u32);

        // If triggers is empty (combinational always @* block),
        // infer sensitivity to all nets read in the process body
        if triggers.is_empty() {
            let mut read_nets = Vec::new();
            for s in &body {
                Self::collect_statement_read_nets(s, &mut read_nets);
            }
            for net in read_nets {
                triggers.push(BirTrigger {
                    net,
                    edge: EdgeKind::AnyChange,
                });
            }
        }

        for trigger in &triggers {
            self.sensitivity_map.entry(trigger.net).or_default().push(id);
        }

        self.processes.push(BirProcess {
            id,
            name: name.into(),
            kind,
            triggers,
            body,
        });
        id
    }
}
