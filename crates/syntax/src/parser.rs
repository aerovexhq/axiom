use crate::ast::*;
use crate::token::{Token, TokenKind};
use axiom_core::{Diagnostic, FileId, Span};

pub struct Parser<'a> {
    _file_id: FileId,
    tokens: &'a [Token],
    cursor: usize,
    diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
enum Precedence {
    Lowest = 0,
    Ternary = 1,       // ? :
    LogicOr = 2,       // ||
    LogicAnd = 3,      // &&
    BitOr = 4,         // |
    BitXor = 5,        // ^, ~^
    BitAnd = 6,        // &
    Equality = 7,      // ==, !=, ===, !==
    Relational = 8,    // <, <=, >, >=
    Shift = 9,         // <<, >>, <<<, >>>
    Additive = 10,     // +, -
    Multiplicative = 11, // *, /, %
    Unary = 12,        // ~, !, +, -, &, |, ^
}

impl<'a> Parser<'a> {
    pub fn new(file_id: FileId, tokens: &'a [Token]) -> Self {
        Self {
            _file_id: file_id,
            tokens,
            cursor: 0,
            diagnostics: Vec::new(),
        }
    }

    #[inline]
    fn peek(&self) -> &TokenKind {
        if self.cursor < self.tokens.len() {
            &self.tokens[self.cursor].kind
        } else {
            &TokenKind::Eof
        }
    }

    #[inline]
    fn peek_at(&self, offset: usize) -> &TokenKind {
        if self.cursor + offset < self.tokens.len() {
            &self.tokens[self.cursor + offset].kind
        } else {
            &TokenKind::Eof
        }
    }

    #[inline]
    fn peek_token(&self) -> &Token {
        if self.cursor < self.tokens.len() {
            &self.tokens[self.cursor]
        } else {
            &self.tokens[self.tokens.len() - 1]
        }
    }

    #[inline]
    fn current_span(&self) -> Span {
        self.peek_token().span
    }

    #[inline]
    fn advance(&mut self) -> &Token {
        let tok = &self.tokens[self.cursor.min(self.tokens.len() - 1)];
        if self.cursor < self.tokens.len() {
            self.cursor += 1;
        }
        tok
    }

    fn check(&self, kind: &TokenKind) -> bool {
        self.peek() == kind
    }

    fn match_token(&mut self, kind: &TokenKind) -> bool {
        if self.check(kind) {
            self.advance();
            true
        } else {
            false
        }
    }

    fn expect(&mut self, kind: &TokenKind, context: &str) -> Option<Span> {
        if self.check(kind) {
            Some(self.advance().span)
        } else {
            let found = self.peek();
            let span = self.current_span();
            self.diagnostics.push(Diagnostic::error(
                format!("Expected {kind:?} in {context}, found {found:?}"),
                span,
            ));
            None
        }
    }

    fn synchronize_to_module(&mut self) {
        while self.cursor < self.tokens.len() {
            match self.peek() {
                TokenKind::Module | TokenKind::Eof => break,
                _ => { self.advance(); }
            }
        }
    }

    fn synchronize_to_semicolon(&mut self) {
        while self.cursor < self.tokens.len() {
            match self.peek() {
                TokenKind::Semicolon => {
                    self.advance();
                    break;
                }
                TokenKind::End | TokenKind::EndModule | TokenKind::Eof => break,
                _ => { self.advance(); }
            }
        }
    }

    // Top-level entry
    pub fn parse_source_file(&mut self) -> (SourceFile, Vec<Diagnostic>) {
        let mut modules = Vec::new();

        while !self.check(&TokenKind::Eof) {
            // Skip directives without semicolons (`timescale, etc.)
            if self.match_token(&TokenKind::DirectiveTimescale) {
                while !self.check(&TokenKind::Module) && !self.check(&TokenKind::Eof) {
                    if matches!(self.peek(), TokenKind::DirectiveDefine | TokenKind::DirectiveIfdef | TokenKind::DirectiveInclude | TokenKind::DirectiveTimescale) {
                        break;
                    }
                    self.advance();
                }
                continue;
            }

            if self.check(&TokenKind::Module) {
                if let Some(module) = self.parse_module() {
                    modules.push(module);
                } else {
                    self.synchronize_to_module();
                }
            } else {
                let (kind, span) = {
                    let tok = self.advance();
                    (tok.kind.clone(), tok.span)
                };
                if kind != TokenKind::Eof {
                    self.diagnostics.push(Diagnostic::error(
                        format!("Unexpected top-level token: {:?}", kind),
                        span,
                    ));
                }
            }
        }

        (SourceFile { modules }, std::mem::take(&mut self.diagnostics))
    }

    pub fn parse_module(&mut self) -> Option<ModuleDef> {
        let start_span = self.expect(&TokenKind::Module, "module declaration")?;

        let name = match self.peek().clone() {
            TokenKind::Ident(s) => {
                self.advance();
                s
            }
            _ => {
                self.diagnostics.push(Diagnostic::error("Expected module name", self.current_span()));
                return None;
            }
        };

        // Optional parameters: #(parameter WIDTH = 32)
        let mut params = Vec::new();
        if self.match_token(&TokenKind::Hash) {
            if self.expect(&TokenKind::LParen, "parameter list opening '('").is_some() {
                params = self.parse_parameter_list();
                self.expect(&TokenKind::RParen, "parameter list closing ')'");
            }
        }

        // Port list: (input clk, output [7:0] dout)
        let mut ports = Vec::new();
        if self.match_token(&TokenKind::LParen) {
            ports = self.parse_port_list();
            self.expect(&TokenKind::RParen, "port list closing ')'");
        }

        self.expect(&TokenKind::Semicolon, "end of module header ';'");

        // Module items
        let mut items = Vec::new();
        while !self.check(&TokenKind::EndModule) && !self.check(&TokenKind::Eof) {
            if let Some(item) = self.parse_module_item() {
                items.push(item);
            } else {
                self.synchronize_to_semicolon();
            }
        }

        let end_span = self.expect(&TokenKind::EndModule, "endmodule")
            .unwrap_or(start_span);

        Some(ModuleDef {
            name,
            params,
            ports,
            items,
            span: start_span.merge(end_span),
        })
    }

    fn parse_parameter_list(&mut self) -> Vec<ParamDecl> {
        let mut params = Vec::new();
        while !self.check(&TokenKind::RParen) && !self.check(&TokenKind::Eof) {
            let is_local = self.match_token(&TokenKind::LocalParam);
            if !is_local {
                self.match_token(&TokenKind::Parameter);
            }
            // Optional type (int, integer, bit, byte, logic, wire, reg, etc.)
            if let TokenKind::Ident(s) = self.peek() {
                if matches!(s.as_str(), "int" | "integer" | "bit" | "byte" | "shortint" | "longint" | "real" | "logic" | "wire" | "reg") {
                    self.advance();
                }
            } else if self.check(&TokenKind::Integer) {
                self.advance();
            }

            if let TokenKind::Ident(name) = self.peek().clone() {
                let span = self.advance().span;
                if self.expect(&TokenKind::AssignEq, "parameter assignment '='").is_some() {
                    if let Some(value) = self.parse_expr() {
                        params.push(ParamDecl {
                            is_local,
                            name,
                            value,
                            span,
                        });
                    }
                }
            } else {
                break;
            }

            if !self.match_token(&TokenKind::Comma) {
                break;
            }
        }
        params
    }

    fn parse_port_list(&mut self) -> Vec<PortDecl> {
        let mut ports = Vec::new();
        let mut current_dir = PortDirection::Input;
        let mut current_type = DataType::Implicit;
        let mut current_range = None;

        while !self.check(&TokenKind::RParen) && !self.check(&TokenKind::Eof) {
            let mut saw_header = false;

            // Direction
            if self.match_token(&TokenKind::Input) {
                current_dir = PortDirection::Input;
                saw_header = true;
            } else if self.match_token(&TokenKind::Output) {
                current_dir = PortDirection::Output;
                saw_header = true;
            } else if self.match_token(&TokenKind::Inout) {
                current_dir = PortDirection::Inout;
                saw_header = true;
            }

            // Data type
            if self.match_token(&TokenKind::Wire) {
                current_type = DataType::Wire;
                saw_header = true;
            } else if self.match_token(&TokenKind::Reg) {
                current_type = DataType::Reg;
                saw_header = true;
            } else if self.match_token(&TokenKind::Logic) {
                current_type = DataType::Logic;
                saw_header = true;
            }

            if saw_header {
                current_range = None;
            }

            // Range [msb:lsb]
            if self.check(&TokenKind::LBracket) {
                current_range = self.parse_range();
            }

            // Port Name
            if let TokenKind::Ident(name) = self.peek().clone() {
                let span = self.advance().span;
                ports.push(PortDecl {
                    direction: current_dir,
                    data_type: current_type,
                    name,
                    range: current_range.clone(),
                    span,
                });
            } else {
                break;
            }

            if !self.match_token(&TokenKind::Comma) {
                break;
            }
        }
        ports
    }

    fn parse_range(&mut self) -> Option<Range> {
        let start_span = self.expect(&TokenKind::LBracket, "range '['")?;
        let msb = self.parse_expr()?;
        self.expect(&TokenKind::Colon, "range separator ':'")?;
        let lsb = self.parse_expr()?;
        let end_span = self.expect(&TokenKind::RBracket, "range ']'")?;
        Some(Range {
            msb,
            lsb,
            span: start_span.merge(end_span),
        })
    }

    fn parse_module_item(&mut self) -> Option<ModuleItem> {
        match self.peek() {
            TokenKind::Assign => self.parse_continuous_assign(),
            TokenKind::Always | TokenKind::AlwaysComb | TokenKind::AlwaysFf | TokenKind::AlwaysLatch | TokenKind::Initial => {
                self.parse_procedural_block()
            }
            TokenKind::Wire | TokenKind::Reg | TokenKind::Logic => self.parse_net_decl(),
            TokenKind::Parameter | TokenKind::LocalParam => self.parse_param_decl(),
            TokenKind::Generate => self.parse_generate_block(),
            TokenKind::Assert | TokenKind::Assume | TokenKind::Cover => {
                let def = self.parse_assertion_def(None)?;
                Some(ModuleItem::Assertion(def))
            }
            TokenKind::Ident(_) => {
                if self.peek_at(1) == &TokenKind::Colon && matches!(self.peek_at(2), TokenKind::Assert | TokenKind::Assume | TokenKind::Cover) {
                    let label = match self.advance().kind.clone() {
                        TokenKind::Ident(s) => s,
                        _ => unreachable!(),
                    };
                    self.advance(); // consume ':'
                    let def = self.parse_assertion_def(Some(label))?;
                    Some(ModuleItem::Assertion(def))
                } else {
                    self.parse_instance_or_assign()
                }
            }
            _ => {
                let span = self.current_span();
                let tok = self.advance().kind.clone();
                self.diagnostics.push(Diagnostic::error(
                    format!("Unexpected module item: {tok:?}"),
                    span,
                ));
                None
            }
        }
    }

    fn parse_continuous_assign(&mut self) -> Option<ModuleItem> {
        let start_span = self.advance().span; // consume 'assign'
        let lhs = self.parse_expr()?;
        self.expect(&TokenKind::AssignEq, "assignment '='")?;
        let rhs = self.parse_expr()?;
        let end_span = self.expect(&TokenKind::Semicolon, "assignment ending ';'")?;

        Some(ModuleItem::ContinuousAssign(AssignStmt {
            lhs,
            rhs,
            span: start_span.merge(end_span),
        }))
    }

    fn parse_net_decl(&mut self) -> Option<ModuleItem> {
        let tok = self.advance();
        let start_span = tok.span;
        let data_type = match tok.kind {
            TokenKind::Wire => DataType::Wire,
            TokenKind::Reg => DataType::Reg,
            TokenKind::Logic => DataType::Logic,
            _ => DataType::Implicit,
        };

        let range = if self.check(&TokenKind::LBracket) {
            self.parse_range()
        } else {
            None
        };

        let mut names = Vec::new();
        let mut init = None;

        while let TokenKind::Ident(name) = self.peek().clone() {
            self.advance();
            names.push(name);

            // Optional unpacked dimensions: reg [31:0] regfile [0:7];
            if self.check(&TokenKind::LBracket) {
                let _ = self.parse_range();
            }

            // Optional initial / continuous assignment: wire [6:0] opcode = instr[6:0];
            if self.match_token(&TokenKind::AssignEq) {
                init = self.parse_expr();
            }

            if !self.match_token(&TokenKind::Comma) {
                break;
            }
        }

        let end_span = self.expect(&TokenKind::Semicolon, "net declaration ';'")?;

        Some(ModuleItem::NetDecl(NetDecl {
            data_type,
            range,
            names,
            init,
            span: start_span.merge(end_span),
        }))
    }

    fn parse_param_decl(&mut self) -> Option<ModuleItem> {
        let tok = self.advance();
        let start_span = tok.span;
        let is_local = tok.kind == TokenKind::LocalParam;

        // Optional range: localparam [1:0] ...
        if self.check(&TokenKind::LBracket) {
            let _ = self.parse_range();
        }

        // Optional type (int, integer, bit, byte, logic, wire, reg, etc.)
        if let TokenKind::Ident(s) = self.peek() {
            if matches!(s.as_str(), "int" | "integer" | "bit" | "byte" | "shortint" | "longint" | "real" | "logic" | "wire" | "reg") {
                self.advance();
                if self.check(&TokenKind::LBracket) {
                    let _ = self.parse_range();
                }
            }
        } else if self.check(&TokenKind::Integer) {
            self.advance();
            if self.check(&TokenKind::LBracket) {
                let _ = self.parse_range();
            }
        }

        if let TokenKind::Ident(name) = self.peek().clone() {
            self.advance();
            self.expect(&TokenKind::AssignEq, "parameter '='")?;
            let value = self.parse_expr()?;

            // Support comma-separated parameter lists: localparam A = 1, B = 2;
            while self.match_token(&TokenKind::Comma) {
                if let TokenKind::Ident(_) = self.peek().clone() {
                    self.advance();
                    if self.expect(&TokenKind::AssignEq, "parameter '='").is_some() {
                        let _ = self.parse_expr();
                    }
                } else {
                    break;
                }
            }

            let end_span = self.expect(&TokenKind::Semicolon, "parameter ';'")?;
            Some(ModuleItem::ParamDecl(ParamDecl {
                is_local,
                name,
                value,
                span: start_span.merge(end_span),
            }))
        } else {
            None
        }
    }

    fn parse_procedural_block(&mut self) -> Option<ModuleItem> {
        let tok = self.advance();
        let start_span = tok.span;
        let kind = match tok.kind {
            TokenKind::Always => ProceduralKind::Always,
            TokenKind::AlwaysComb => ProceduralKind::AlwaysComb,
            TokenKind::AlwaysFf => ProceduralKind::AlwaysFf,
            TokenKind::AlwaysLatch => ProceduralKind::AlwaysLatch,
            TokenKind::Initial => ProceduralKind::Initial,
            _ => unreachable!(),
        };

        // Sensitivity list: @(...) or @*
        let mut sensitivity = None;
        if self.match_token(&TokenKind::At) {
            sensitivity = Some(self.parse_sensitivity_list());
        }

        let body = self.parse_statement()?;
        let span = start_span.merge(self.current_span());

        Some(ModuleItem::ProceduralBlock(ProceduralBlock {
            kind,
            sensitivity,
            body,
            span,
        }))
    }

    fn parse_sensitivity_list(&mut self) -> Vec<SensitivityItem> {
        let mut items = Vec::new();
        if self.match_token(&TokenKind::Star) {
            // @*
            return items;
        }

        if self.expect(&TokenKind::LParen, "sensitivity list '('").is_some() {
            if self.match_token(&TokenKind::Star) {
                self.expect(&TokenKind::RParen, "sensitivity list ')'");
                return items;
            }

            while !self.check(&TokenKind::RParen) && !self.check(&TokenKind::Eof) {
                let edge = if self.match_token(&TokenKind::Posedge) {
                    EdgeKind::Posedge
                } else if self.match_token(&TokenKind::Negedge) {
                    EdgeKind::Negedge
                } else {
                    EdgeKind::AnyChange
                };

                if let Some(signal) = self.parse_expr() {
                    let span = signal.span();
                    items.push(SensitivityItem { edge, signal, span });
                }

                // Separated by 'or' or ','
                if self.check(&TokenKind::Comma) {
                    self.advance();
                } else if let TokenKind::Ident(s) = self.peek() {
                    if s == "or" {
                        self.advance();
                    } else {
                        break;
                    }
                } else {
                    break;
                }
            }
            self.expect(&TokenKind::RParen, "sensitivity list ')'");
        }
        items
    }

    fn parse_statement(&mut self) -> Option<Statement> {
        match self.peek() {
            TokenKind::Begin => {
                let _start_span = self.advance().span;
                let mut stmts = Vec::new();
                while !self.check(&TokenKind::End) && !self.check(&TokenKind::Eof) {
                    if let Some(s) = self.parse_statement() {
                        stmts.push(s);
                    } else {
                        self.synchronize_to_semicolon();
                    }
                }
                self.expect(&TokenKind::End, "block 'end'")?;
                Some(Statement::Block(stmts))
            }
            TokenKind::If => {
                let start_span = self.advance().span;
                self.expect(&TokenKind::LParen, "if condition '('")?;
                let cond = self.parse_expr()?;
                self.expect(&TokenKind::RParen, "if condition ')'")?;
                let then_branch = Box::new(self.parse_statement()?);
                let else_branch = if self.match_token(&TokenKind::Else) {
                    Some(Box::new(self.parse_statement()?))
                } else {
                    None
                };
                Some(Statement::If {
                    cond,
                    then_branch,
                    else_branch,
                    span: start_span.merge(self.current_span()),
                })
            }
            TokenKind::Case => {
                let start_span = self.advance().span;
                self.expect(&TokenKind::LParen, "case expression '('")?;
                let expr = self.parse_expr()?;
                self.expect(&TokenKind::RParen, "case expression ')'")?;
                let mut items = Vec::new();
                while !self.check(&TokenKind::EndCase) && !self.check(&TokenKind::Eof) {
                    let is_default = self.match_token(&TokenKind::Default);
                    let mut patterns = Vec::new();
                    if !is_default {
                        patterns.push(self.parse_expr()?);
                        while self.match_token(&TokenKind::Comma) {
                            patterns.push(self.parse_expr()?);
                        }
                    }
                    self.expect(&TokenKind::Colon, "case item ':'")?;
                    let body = self.parse_statement()?;
                    items.push(CaseItem {
                        patterns,
                        body,
                        span: start_span.merge(self.current_span()),
                    });
                }
                self.expect(&TokenKind::EndCase, "endcase")?;
                Some(Statement::Case {
                    expr,
                    items,
                    span: start_span.merge(self.current_span()),
                })
            }
            TokenKind::For => {
                let start_span = self.advance().span;
                self.expect(&TokenKind::LParen, "for '('")?;
                let init = Box::new(self.parse_statement()?);
                let cond = self.parse_expr()?;
                self.expect(&TokenKind::Semicolon, "for condition ';'")?;
                let step = Box::new(self.parse_statement()?);
                self.expect(&TokenKind::RParen, "for ')'")?;
                let body = Box::new(self.parse_statement()?);
                Some(Statement::For {
                    init,
                    cond,
                    step,
                    body,
                    span: start_span.merge(self.current_span()),
                })
            }
            TokenKind::Semicolon => {
                self.advance();
                Some(Statement::Null)
            }
            TokenKind::At => {
                // Event control: @(posedge clk); or @(posedge clk) q <= d;
                self.advance();
                let _ = self.parse_sensitivity_list();
                if self.match_token(&TokenKind::Semicolon) {
                    Some(Statement::Null)
                } else {
                    self.parse_statement()
                }
            }
            TokenKind::Hash => {
                // Procedural delay: #10; or #20 rst_n = 1;
                let hash_span = self.advance().span;
                let amount = self.parse_expr()?;
                if self.match_token(&TokenKind::Semicolon) {
                    Some(Statement::Delay {
                        amount,
                        stmt: None,
                        span: hash_span.merge(self.current_span()),
                    })
                } else {
                    let inner = self.parse_statement()?;
                    let span = hash_span.merge(inner.span());
                    Some(Statement::Delay {
                        amount,
                        stmt: Some(Box::new(inner)),
                        span,
                    })
                }
            }
            TokenKind::Assert | TokenKind::Assume | TokenKind::Cover => {
                let def = self.parse_assertion_def(None)?;
                Some(Statement::Assertion(def))
            }
            TokenKind::Ident(_) if self.peek_at(1) == &TokenKind::Colon && matches!(self.peek_at(2), TokenKind::Assert | TokenKind::Assume | TokenKind::Cover) => {
                let label = match self.advance().kind.clone() {
                    TokenKind::Ident(s) => s,
                    _ => unreachable!(),
                };
                self.advance(); // consume ':'
                let def = self.parse_assertion_def(Some(label))?;
                Some(Statement::Assertion(def))
            }
            _ => {
                // System task call, user task call, or assignment:
                let expr = self.parse_expr_precedence(Precedence::Shift)?;
                if self.match_token(&TokenKind::LtEq) || self.match_token(&TokenKind::AssignLe) {
                    let rhs = self.parse_expr()?;
                    let end_span = self.expect(&TokenKind::Semicolon, "non-blocking assignment ';'")?;
                    Some(Statement::NonBlockingAssign {
                        span: expr.span().merge(end_span),
                        lhs: expr,
                        rhs,
                    })
                } else if self.match_token(&TokenKind::AssignEq) {
                    let rhs = self.parse_expr()?;
                    let end_span = self.expect(&TokenKind::Semicolon, "assignment ';'")?;
                    Some(Statement::BlockingAssign {
                        span: expr.span().merge(end_span),
                        lhs: expr,
                        rhs,
                    })
                } else if self.match_token(&TokenKind::Semicolon) {
                    // Expression statement or void task call: e.g. $finish; or my_task(a, b);
                    let span = expr.span().merge(self.current_span());
                    match expr {
                        Expr::Call { name, args, .. } => Some(Statement::TaskCall { name, args, span }),
                        Expr::Ident(name, _) => Some(Statement::TaskCall { name, args: Vec::new(), span }),
                        _ => Some(Statement::Null),
                    }
                } else {
                    self.diagnostics.push(Diagnostic::error("Expected assignment operator or ';'", self.current_span()));
                    None
                }
            }
        }
    }

    fn parse_instance_or_assign(&mut self) -> Option<ModuleItem> {
        let start_span = self.current_span();
        let module_name = match self.advance().kind.clone() {
            TokenKind::Ident(s) => s,
            _ => return None,
        };

        // Parameters or delay on instance: #(.WIDTH(8)), #(8), or #10
        let mut param_bindings = Vec::new();
        if self.match_token(&TokenKind::Hash) {
            if self.match_token(&TokenKind::LParen) {
                param_bindings = self.parse_instance_param_bindings();
                self.expect(&TokenKind::RParen, "instance parameter list ')'");
            } else if let Some(expr) = self.parse_expr() {
                param_bindings.push(("delay".to_string(), expr));
            }
        }

        // Instance name: u_alu, g1, or omitted for gate primitives
        let instance_name = if self.check(&TokenKind::LParen) {
            // Anonymous instance (standard in Verilog gate primitives)
            format!("{}_{}", module_name, self.current_span().start)
        } else if matches!(self.peek(), TokenKind::Ident(_)) {
            match self.advance().kind.clone() {
                TokenKind::Ident(s) => s,
                _ => unreachable!(),
            }
        } else {
            self.diagnostics.push(Diagnostic::error(
                "Expected instance name or '(' for port connections",
                self.current_span(),
            ));
            return None;
        };

        // Port bindings: (.a(din_a), .b(din_b)) or (din_a, din_b)
        self.expect(&TokenKind::LParen, "instance port connections '('")?;
        let port_bindings = self.parse_port_connections(&module_name);
        self.expect(&TokenKind::RParen, "instance port connections ')'")?;
        let end_span = self.expect(&TokenKind::Semicolon, "instance declaration ';'")?;

        Some(ModuleItem::Instance(InstanceDef {
            module_name,
            instance_name,
            param_bindings,
            port_bindings,
            span: start_span.merge(end_span),
        }))
    }

    fn parse_instance_param_bindings(&mut self) -> Vec<(String, Expr)> {
        let mut bindings = Vec::new();
        if self.check(&TokenKind::Dot) {
            // Named parameter bindings: #(.WIDTH(8))
            while self.match_token(&TokenKind::Dot) {
                if let TokenKind::Ident(param_name) = self.advance().kind.clone() {
                    if self.expect(&TokenKind::LParen, "parameter binding '('").is_some() {
                        if !self.check(&TokenKind::RParen) {
                            if let Some(expr) = self.parse_expr() {
                                bindings.push((param_name, expr));
                            }
                        }
                        self.expect(&TokenKind::RParen, "parameter binding ')'");
                    }
                }
                if !self.match_token(&TokenKind::Comma) {
                    break;
                }
            }
        } else {
            // Positional parameter bindings: #(8, 16)
            let mut idx = 0;
            while !self.check(&TokenKind::RParen) && !self.check(&TokenKind::Eof) {
                if let Some(expr) = self.parse_expr() {
                    bindings.push((idx.to_string(), expr));
                    idx += 1;
                } else {
                    break;
                }
                if !self.match_token(&TokenKind::Comma) {
                    break;
                }
            }
        }
        bindings
    }

    fn parse_port_connections(&mut self, module_name: &str) -> Vec<(String, Expr)> {
        let mut bindings = Vec::new();
        let is_gate = is_gate_primitive(module_name);

        if self.check(&TokenKind::RParen) {
            return bindings;
        }

        if self.check(&TokenKind::Dot) {
            // Named port bindings: .port(expr)
            while self.match_token(&TokenKind::Dot) {
                if let TokenKind::Ident(port_name) = self.advance().kind.clone() {
                    if self.expect(&TokenKind::LParen, "port binding '('").is_some() {
                        if !self.check(&TokenKind::RParen) {
                            if let Some(expr) = self.parse_expr() {
                                bindings.push((port_name, expr));
                            }
                        }
                        self.expect(&TokenKind::RParen, "port binding ')'");
                    }
                }
                if !self.match_token(&TokenKind::Comma) {
                    break;
                }
            }
        } else {
            // Positional port bindings: expr, expr, ...
            let mut index = 0;
            while !self.check(&TokenKind::RParen) && !self.check(&TokenKind::Eof) {
                if self.check(&TokenKind::Comma) {
                    // Empty positional port slot (e.g. `(a, , c)`)
                    index += 1;
                    self.advance();
                    continue;
                }
                if let Some(expr) = self.parse_expr() {
                    let port_name = if is_gate {
                        if index == 0 {
                            "out".to_string()
                        } else {
                            format!("in{}", index - 1)
                        }
                    } else {
                        index.to_string()
                    };
                    bindings.push((port_name, expr));
                    index += 1;
                } else {
                    break;
                }

                if !self.match_token(&TokenKind::Comma) {
                    break;
                }
            }
        }

        bindings
    }

    fn parse_generate_block(&mut self) -> Option<ModuleItem> {
        let start_span = self.advance().span; // 'generate'
        let mut items = Vec::new();
        while !self.check(&TokenKind::EndGenerate) && !self.check(&TokenKind::Eof) {
            if let Some(item) = self.parse_module_item() {
                items.push(item);
            } else {
                self.synchronize_to_semicolon();
            }
        }
        let end_span = self.expect(&TokenKind::EndGenerate, "endgenerate")?;
        Some(ModuleItem::GenerateBlock(GenerateBlock {
            is_for: false,
            items,
            span: start_span.merge(end_span),
        }))
    }

    fn parse_assertion_def(&mut self, label: Option<String>) -> Option<AssertionDef> {
        let start_span = self.current_span();
        let kind = match self.advance().kind.clone() {
            TokenKind::Assert => AssertionKind::Assert,
            TokenKind::Assume => AssertionKind::Assume,
            TokenKind::Cover => AssertionKind::Cover,
            _ => return None,
        };

        // Optional 'property' keyword: assert property (...)
        self.match_token(&TokenKind::Property);

        // Expect opening '('
        self.expect(&TokenKind::LParen, "assertion property '('")?;

        // Optional clocking event: @(posedge clk) or @(negedge clk)
        let clock = if self.match_token(&TokenKind::At) {
            self.expect(&TokenKind::LParen, "clock event '('")?;
            let edge = if self.match_token(&TokenKind::Posedge) {
                EdgeKind::Posedge
            } else if self.match_token(&TokenKind::Negedge) {
                EdgeKind::Negedge
            } else {
                EdgeKind::AnyChange
            };
            let signal = self.parse_expr()?;
            self.expect(&TokenKind::RParen, "clock event ')'")?;
            Some(SensitivityItem {
                edge,
                signal,
                span: start_span,
            })
        } else {
            None
        };

        // Collect tokens for property expression until matching closing ')'
        let mut depth = 1usize;
        let mut expr_parts: Vec<String> = Vec::new();
        while !self.check(&TokenKind::Eof) && depth > 0 {
            if self.check(&TokenKind::LParen) {
                depth += 1;
                expr_parts.push("(".to_string());
                self.advance();
            } else if self.check(&TokenKind::RParen) {
                depth -= 1;
                if depth == 0 {
                    self.advance();
                    break;
                }
                expr_parts.push(")".to_string());
                self.advance();
            } else {
                let tok = self.advance();
                let part = match &tok.kind {
                    TokenKind::Ident(s) => s.clone(),
                    TokenKind::UnsizedInt(v) => v.to_string(),
                    TokenKind::Number(v) => format!("{v:?}"),
                    TokenKind::ImpliesOverlap => "|->".to_string(),
                    TokenKind::ImpliesNonOverlap => "|=>".to_string(),
                    TokenKind::CycleDelay => "##".to_string(),
                    TokenKind::RepeatStar => "[*".to_string(),
                    TokenKind::LBracket => "[".to_string(),
                    TokenKind::RBracket => "]".to_string(),
                    TokenKind::AmpAmp => "&&".to_string(),
                    TokenKind::PipePipe => "||".to_string(),
                    TokenKind::Bang => "!".to_string(),
                    TokenKind::EqEq => "==".to_string(),
                    TokenKind::BangEq => "!=".to_string(),
                    TokenKind::Lt => "<".to_string(),
                    TokenKind::LtEq => "<=".to_string(),
                    TokenKind::Gt => ">".to_string(),
                    TokenKind::GtEq => ">=".to_string(),
                    TokenKind::Colon => ":".to_string(),
                    TokenKind::Plus => "+".to_string(),
                    TokenKind::Minus => "-".to_string(),
                    TokenKind::Star => "*".to_string(),
                    TokenKind::Slash => "/".to_string(),
                    TokenKind::Amp => "&".to_string(),
                    TokenKind::Pipe => "|".to_string(),
                    TokenKind::Caret => "^".to_string(),
                    TokenKind::Tilde => "~".to_string(),
                    _ => "".to_string(),
                };
                if !part.is_empty() {
                    expr_parts.push(part);
                }
            }
        }

        let expr_text = expr_parts.join(" ");

        // Optional action block: else $error("...");
        if self.match_token(&TokenKind::Else) {
            let _ = self.parse_statement();
        }

        let end_span = self.expect(&TokenKind::Semicolon, "assertion ending ';'")?;

        Some(AssertionDef {
            label,
            kind,
            clock,
            expr_text,
            span: start_span.merge(end_span),
        })
    }

    // ==========================================
    // PRATT EXPRESSION PARSING
    // ==========================================

    pub fn parse_expr(&mut self) -> Option<Expr> {
        self.parse_expr_precedence(Precedence::Lowest)
    }

    fn parse_expr_precedence(&mut self, prec: Precedence) -> Option<Expr> {
        let mut left = self.parse_prefix()?;

        while !self.check(&TokenKind::Eof) && prec < self.peek_precedence() {
            left = self.parse_infix(left)?;
        }

        Some(left)
    }

    fn parse_prefix(&mut self) -> Option<Expr> {
        let tok = self.advance().clone();
        match tok.kind {
            TokenKind::Ident(name) => {
                let start_span = tok.span;
                // Check for function or system task call in expression: $time or func(a, b)
                if self.match_token(&TokenKind::LParen) {
                    let mut args = Vec::new();
                    while !self.check(&TokenKind::RParen) && !self.check(&TokenKind::Eof) {
                        if let Some(arg) = self.parse_expr() {
                            args.push(arg);
                        } else {
                            break;
                        }
                        if !self.match_token(&TokenKind::Comma) {
                            break;
                        }
                    }
                    let end_span = self.expect(&TokenKind::RParen, "function call ')'")
                        .unwrap_or(start_span);
                    Some(Expr::Call {
                        name,
                        args,
                        span: start_span.merge(end_span),
                    })
                } else {
                    let mut expr = Expr::Ident(name, tok.span);
                    // Check for bit-slice [msb:lsb] or [idx]
                    if self.match_token(&TokenKind::LBracket) {
                        let msb = self.parse_expr()?;
                        if self.match_token(&TokenKind::Colon) {
                            let lsb = self.parse_expr()?;
                            let end_span = self.expect(&TokenKind::RBracket, "slice ']'")?;
                            expr = Expr::Slice {
                                target: Box::new(expr),
                                msb: Box::new(msb),
                                lsb: Box::new(lsb),
                                span: tok.span.merge(end_span),
                            };
                        } else {
                            let end_span = self.expect(&TokenKind::RBracket, "index ']'")?;
                            expr = Expr::Slice {
                                target: Box::new(expr),
                                msb: Box::new(msb.clone()),
                                lsb: Box::new(msb),
                                span: tok.span.merge(end_span),
                            };
                        }
                    }
                    Some(expr)
                }
            }
            TokenKind::Number(vec) => Some(Expr::Number(vec, tok.span)),
            TokenKind::UnsizedInt(val) => Some(Expr::UnsizedInt(val, tok.span)),
            TokenKind::StringLiteral(s) => Some(Expr::StringLiteral(s, tok.span)),
            TokenKind::LParen => {
                let expr = self.parse_expr()?;
                self.expect(&TokenKind::RParen, "closing ')'")?;
                Some(expr)
            }
            TokenKind::LBrace => {
                // Concatenation {a, b, c} or replication {count {pattern}}
                let first = self.parse_expr()?;
                if self.match_token(&TokenKind::LBrace) {
                    // Replication: { 20 { instr[31] } }
                    let inner = self.parse_expr()?;
                    self.expect(&TokenKind::RBrace, "closing '}' of replication pattern")?;
                    let end_span = self.expect(&TokenKind::RBrace, "closing '}' of replication")?;
                    Some(Expr::Replication {
                        count: Box::new(first),
                        expr: Box::new(inner),
                        span: tok.span.merge(end_span),
                    })
                } else {
                    let mut exprs = vec![first];
                    while self.match_token(&TokenKind::Comma) {
                        if let Some(e) = self.parse_expr() {
                            exprs.push(e);
                        } else {
                            break;
                        }
                    }
                    let end_span = self.expect(&TokenKind::RBrace, "closing '}'")?;
                    Some(Expr::Concat(exprs, tok.span.merge(end_span)))
                }
            }
            TokenKind::Tilde => {
                let sub = self.parse_expr_precedence(Precedence::Unary)?;
                Some(Expr::Unary { op: UnaryOp::Not, span: tok.span.merge(sub.span()), expr: Box::new(sub) })
            }
            TokenKind::Bang => {
                let sub = self.parse_expr_precedence(Precedence::Unary)?;
                Some(Expr::Unary { op: UnaryOp::LogicNot, span: tok.span.merge(sub.span()), expr: Box::new(sub) })
            }
            TokenKind::Plus => {
                let sub = self.parse_expr_precedence(Precedence::Unary)?;
                Some(Expr::Unary { op: UnaryOp::Plus, span: tok.span.merge(sub.span()), expr: Box::new(sub) })
            }
            TokenKind::Minus => {
                let sub = self.parse_expr_precedence(Precedence::Unary)?;
                Some(Expr::Unary { op: UnaryOp::Minus, span: tok.span.merge(sub.span()), expr: Box::new(sub) })
            }
            TokenKind::Amp => {
                let sub = self.parse_expr_precedence(Precedence::Unary)?;
                Some(Expr::Unary { op: UnaryOp::And, span: tok.span.merge(sub.span()), expr: Box::new(sub) })
            }
            TokenKind::Pipe => {
                let sub = self.parse_expr_precedence(Precedence::Unary)?;
                Some(Expr::Unary { op: UnaryOp::Or, span: tok.span.merge(sub.span()), expr: Box::new(sub) })
            }
            TokenKind::Caret => {
                let sub = self.parse_expr_precedence(Precedence::Unary)?;
                Some(Expr::Unary { op: UnaryOp::Xor, span: tok.span.merge(sub.span()), expr: Box::new(sub) })
            }
            _ => {
                self.diagnostics.push(Diagnostic::error(
                    format!("Unexpected expression prefix token: {:?}", tok.kind),
                    tok.span,
                ));
                None
            }
        }
    }

    fn parse_infix(&mut self, left: Expr) -> Option<Expr> {
        let tok = self.advance().clone();
        match tok.kind {
            TokenKind::Question => {
                // Ternary: cond ? then_expr : else_expr
                let then_expr = self.parse_expr_precedence(Precedence::Lowest)?;
                self.expect(&TokenKind::Colon, "ternary ':'")?;
                let else_expr = self.parse_expr_precedence(Precedence::Ternary)?;
                let span = left.span().merge(else_expr.span());
                Some(Expr::Ternary {
                    cond: Box::new(left),
                    then_expr: Box::new(then_expr),
                    else_expr: Box::new(else_expr),
                    span,
                })
            }
            _ => {
                let (op, prec) = self.token_to_binary_op(&tok.kind)?;
                let right = self.parse_expr_precedence(prec)?;
                let span = left.span().merge(right.span());
                Some(Expr::Binary {
                    op,
                    lhs: Box::new(left),
                    rhs: Box::new(right),
                    span,
                })
            }
        }
    }

    fn peek_precedence(&self) -> Precedence {
        match self.peek() {
            TokenKind::Question => Precedence::Ternary,
            TokenKind::PipePipe => Precedence::LogicOr,
            TokenKind::AmpAmp => Precedence::LogicAnd,
            TokenKind::Pipe => Precedence::BitOr,
            TokenKind::Caret | TokenKind::TildeCaret => Precedence::BitXor,
            TokenKind::Amp => Precedence::BitAnd,
            TokenKind::EqEq | TokenKind::BangEq | TokenKind::EqEqEq | TokenKind::BangEqEq => Precedence::Equality,
            TokenKind::Lt | TokenKind::LtEq | TokenKind::Gt | TokenKind::GtEq => Precedence::Relational,
            TokenKind::Shl | TokenKind::Shr | TokenKind::ShlArith | TokenKind::ShrArith => Precedence::Shift,
            TokenKind::Plus | TokenKind::Minus => Precedence::Additive,
            TokenKind::Star | TokenKind::Slash | TokenKind::Percent => Precedence::Multiplicative,
            _ => Precedence::Lowest,
        }
    }

    fn token_to_binary_op(&self, kind: &TokenKind) -> Option<(BinaryOp, Precedence)> {
        match kind {
            TokenKind::Plus => Some((BinaryOp::Add, Precedence::Additive)),
            TokenKind::Minus => Some((BinaryOp::Sub, Precedence::Additive)),
            TokenKind::Star => Some((BinaryOp::Mul, Precedence::Multiplicative)),
            TokenKind::Slash => Some((BinaryOp::Div, Precedence::Multiplicative)),
            TokenKind::Percent => Some((BinaryOp::Mod, Precedence::Multiplicative)),
            TokenKind::Amp => Some((BinaryOp::BitAnd, Precedence::BitAnd)),
            TokenKind::Pipe => Some((BinaryOp::BitOr, Precedence::BitOr)),
            TokenKind::Caret => Some((BinaryOp::BitXor, Precedence::BitXor)),
            TokenKind::TildeCaret => Some((BinaryOp::BitXnor, Precedence::BitXor)),
            TokenKind::AmpAmp => Some((BinaryOp::LogicAnd, Precedence::LogicAnd)),
            TokenKind::PipePipe => Some((BinaryOp::LogicOr, Precedence::LogicOr)),
            TokenKind::EqEq => Some((BinaryOp::Eq, Precedence::Equality)),
            TokenKind::BangEq => Some((BinaryOp::Neq, Precedence::Equality)),
            TokenKind::EqEqEq => Some((BinaryOp::CaseEq, Precedence::Equality)),
            TokenKind::BangEqEq => Some((BinaryOp::CaseNeq, Precedence::Equality)),
            TokenKind::Lt => Some((BinaryOp::Lt, Precedence::Relational)),
            TokenKind::LtEq => Some((BinaryOp::LtEq, Precedence::Relational)),
            TokenKind::Gt => Some((BinaryOp::Gt, Precedence::Relational)),
            TokenKind::GtEq => Some((BinaryOp::GtEq, Precedence::Relational)),
            TokenKind::Shl => Some((BinaryOp::Shl, Precedence::Shift)),
            TokenKind::Shr => Some((BinaryOp::Shr, Precedence::Shift)),
            TokenKind::ShlArith => Some((BinaryOp::ShlArith, Precedence::Shift)),
            TokenKind::ShrArith => Some((BinaryOp::ShrArith, Precedence::Shift)),
            _ => None,
        }
    }
}
