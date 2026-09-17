use axiom_core::{LogicVector, Span};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceFile {
    pub modules: Vec<ModuleDef>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleDef {
    pub name: String,
    pub params: Vec<ParamDecl>,
    pub ports: Vec<PortDecl>,
    pub items: Vec<ModuleItem>,
    pub span: Span,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PortDirection {
    Input,
    Output,
    Inout,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortDecl {
    pub direction: PortDirection,
    pub data_type: DataType,
    pub name: String,
    pub range: Option<Range>,
    pub span: Span,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DataType {
    Wire,
    Reg,
    Logic,
    Integer,
    Implicit,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Range {
    pub msb: Expr,
    pub lsb: Expr,
    pub span: Span,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParamDecl {
    pub is_local: bool,
    pub name: String,
    pub value: Expr,
    pub span: Span,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ModuleItem {
    NetDecl(NetDecl),
    ParamDecl(ParamDecl),
    ContinuousAssign(AssignStmt),
    ProceduralBlock(ProceduralBlock),
    Instance(InstanceDef),
    GenerateBlock(GenerateBlock),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetDecl {
    pub data_type: DataType,
    pub range: Option<Range>,
    pub names: Vec<String>,
    pub span: Span,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssignStmt {
    pub lhs: Expr,
    pub rhs: Expr,
    pub span: Span,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProceduralKind {
    Initial,
    Always,
    AlwaysComb,
    AlwaysFf,
    AlwaysLatch,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProceduralBlock {
    pub kind: ProceduralKind,
    pub sensitivity: Option<Vec<SensitivityItem>>,
    pub body: Statement,
    pub span: Span,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum EdgeKind {
    Posedge,
    Negedge,
    AnyChange,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SensitivityItem {
    pub edge: EdgeKind,
    pub signal: Expr,
    pub span: Span,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Statement {
    Block(Vec<Statement>),
    BlockingAssign { lhs: Expr, rhs: Expr, span: Span },
    NonBlockingAssign { lhs: Expr, rhs: Expr, span: Span },
    If { cond: Expr, then_branch: Box<Statement>, else_branch: Option<Box<Statement>>, span: Span },
    Case { expr: Expr, items: Vec<CaseItem>, span: Span },
    For { init: Box<Statement>, cond: Expr, step: Box<Statement>, body: Box<Statement>, span: Span },
    Null,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseItem {
    pub patterns: Vec<Expr>, // Empty for default
    pub body: Statement,
    pub span: Span,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstanceDef {
    pub module_name: String,
    pub instance_name: String,
    pub param_bindings: Vec<(String, Expr)>,
    pub port_bindings: Vec<(String, Expr)>,
    pub span: Span,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateBlock {
    pub is_for: bool,
    pub items: Vec<ModuleItem>,
    pub span: Span,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Expr {
    Ident(String, Span),
    Number(LogicVector, Span),
    UnsizedInt(u64, Span),
    StringLiteral(String, Span),
    Unary { op: UnaryOp, expr: Box<Expr>, span: Span },
    Binary { op: BinaryOp, lhs: Box<Expr>, rhs: Box<Expr>, span: Span },
    Ternary { cond: Box<Expr>, then_expr: Box<Expr>, else_expr: Box<Expr>, span: Span },
    Slice { target: Box<Expr>, msb: Box<Expr>, lsb: Box<Expr>, span: Span },
    Concat(Vec<Expr>, Span),
}

impl Expr {
    pub fn span(&self) -> Span {
        match self {
            Expr::Ident(_, s) => *s,
            Expr::Number(_, s) => *s,
            Expr::UnsizedInt(_, s) => *s,
            Expr::StringLiteral(_, s) => *s,
            Expr::Unary { span, .. } => *span,
            Expr::Binary { span, .. } => *span,
            Expr::Ternary { span, .. } => *span,
            Expr::Slice { span, .. } => *span,
            Expr::Concat(_, s) => *s,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum UnaryOp {
    Plus,
    Minus,
    Not,      // ~ (bitwise)
    LogicNot, // ! (logical)
    And,      // & (reduction)
    Or,       // | (reduction)
    Xor,      // ^ (reduction)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum BinaryOp {
    // Arithmetic
    Add,
    Sub,
    Mul,
    Div,
    Mod,

    // Bitwise
    BitAnd,
    BitOr,
    BitXor,
    BitXnor,

    // Logical
    LogicAnd,
    LogicOr,

    // Comparison
    Eq,
    Neq,
    CaseEq,
    CaseNeq,
    Lt,
    LtEq,
    Gt,
    GtEq,

    // Shifts
    Shl,
    Shr,
    ShlArith,
    ShrArith,
}
