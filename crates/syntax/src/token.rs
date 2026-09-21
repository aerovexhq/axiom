use axiom_core::{LogicVector, Span};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum TokenKind {
    // Keywords
    Module,
    EndModule,
    Input,
    Output,
    Inout,
    Wire,
    Reg,
    Logic,
    Parameter,
    LocalParam,
    Assign,
    Always,
    AlwaysComb,
    AlwaysFf,
    AlwaysLatch,
    Initial,
    Begin,
    End,
    If,
    Else,
    Case,
    Casez,
    Casex,
    EndCase,
    Default,
    For,
    Forever,
    Repeat,
    While,
    Generate,
    EndGenerate,
    Genvar,
    Posedge,
    Negedge,
    Integer,
    Time,
    Assert,
    Property,
    Sequence,
    Cover,
    Assume,

    // Compiler directives
    DirectiveDefine,
    DirectiveIfdef,
    DirectiveIfndef,
    DirectiveElse,
    DirectiveElsif,
    DirectiveEndif,
    DirectiveInclude,
    DirectiveTimescale,
    DirectiveDefaultNettype,
    DirectiveResetall,
    DirectiveUndef,
    DirectiveCelldefine,

    // Operators
    Plus,          // +
    Minus,         // -
    Star,          // *
    Slash,         // /
    Percent,       // %
    Power,         // **
    Amp,           // &
    Pipe,          // |
    Caret,         // ^
    TildeCaret,    // ~^ or ^~
    Tilde,         // ~
    AmpAmp,        // &&
    PipePipe,      // ||
    Bang,          // !
    EqEq,          // ==
    BangEq,        // !=
    EqEqEq,        // ===
    BangEqEq,      // !==
    Lt,            // <
    LtEq,          // <=
    Gt,            // >
    GtEq,          // >=
    Shl,           // <<
    Shr,           // >>
    ShlArith,      // <<<
    ShrArith,      // >>>
    AssignEq,      // =
    AssignLe,      // <= (procedural non-blocking assignment)
    ImpliesOverlap,    // |->
    ImpliesNonOverlap, // |=>
    CycleDelay,        // ##
    RepeatStar,        // [*
    Question,      // ?
    Colon,         // :
    PlusColon,     // +:
    MinusColon,    // -:

    // Delimiters
    LParen,        // (
    RParen,        // )
    LBracket,      // [
    RBracket,      // ]
    LBrace,        // {
    RBrace,        // }
    Semicolon,     // ;
    Comma,         // ,
    Dot,           // .
    Hash,          // #
    At,            // @

    // Literals & Identifiers
    Ident(String),
    Number(LogicVector),
    UnsizedInt(u64),
    StringLiteral(String),

    // Special
    Eof,
    Error(String),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Token {
    pub kind: TokenKind,
    pub span: Span,
}

impl Token {
    pub fn new(kind: TokenKind, span: Span) -> Self {
        Self { kind, span }
    }
}
