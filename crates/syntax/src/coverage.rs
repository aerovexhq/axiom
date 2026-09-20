use axiom_core::{offset_to_line_col, FileId, Span};
use serde::{Deserialize, Serialize};

use crate::ast::*;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CoveragePointKind {
    Statement,
    BranchIf,
    BranchCaseArm,
    BranchTernary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatementPoint {
    pub id: usize,
    pub span: Span,
    pub line: usize,
    pub col: usize,
    pub module_name: String,
    pub snippet: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BranchPoint {
    pub id: usize,
    pub span: Span,
    pub line: usize,
    pub col: usize,
    pub module_name: String,
    pub kind: CoveragePointKind,
    pub cond_text: String,
    pub then_line: usize,
    pub else_line: Option<usize>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AstCoveragePoints {
    pub file_id: FileId,
    pub statements: Vec<StatementPoint>,
    pub branches: Vec<BranchPoint>,
    pub total_lines: usize,
}

pub struct CoveragePointExtractor<'a> {
    pub file_id: FileId,
    source: &'a str,
    statements: Vec<StatementPoint>,
    branches: Vec<BranchPoint>,
    next_stmt_id: usize,
    next_branch_id: usize,
}

impl<'a> CoveragePointExtractor<'a> {
    pub fn new(file_id: FileId, source: &'a str) -> Self {
        Self {
            file_id,
            source,
            statements: Vec::new(),
            branches: Vec::new(),
            next_stmt_id: 0,
            next_branch_id: 0,
        }
    }

    pub fn extract(file_id: FileId, source: &'a str, ast: &SourceFile) -> AstCoveragePoints {
        let mut extractor = Self::new(file_id, source);
        for module in &ast.modules {
            extractor.visit_module(module);
        }

        let total_lines = source.lines().count().max(1);
        AstCoveragePoints {
            file_id,
            statements: extractor.statements,
            branches: extractor.branches,
            total_lines,
        }
    }

    fn visit_module(&mut self, module: &ModuleDef) {
        let mod_name = &module.name;

        for item in &module.items {
            match item {
                ModuleItem::ContinuousAssign(assign) => {
                    let (line, col) = offset_to_line_col(self.source, assign.span.start);
                    let snippet = self.get_snippet(assign.span);
                    self.statements.push(StatementPoint {
                        id: self.next_stmt_id,
                        span: assign.span,
                        line,
                        col,
                        module_name: mod_name.clone(),
                        snippet,
                    });
                    self.next_stmt_id += 1;
                    self.visit_expr(&assign.rhs, mod_name);
                }
                ModuleItem::ProceduralBlock(proc) => {
                    self.visit_statement(&proc.body, mod_name);
                }
                ModuleItem::GenerateBlock(gen) => {
                    for inner in &gen.items {
                        if let ModuleItem::ContinuousAssign(assign) = inner {
                            let (line, col) = offset_to_line_col(self.source, assign.span.start);
                            let snippet = self.get_snippet(assign.span);
                            self.statements.push(StatementPoint {
                                id: self.next_stmt_id,
                                span: assign.span,
                                line,
                                col,
                                module_name: mod_name.clone(),
                                snippet,
                            });
                            self.next_stmt_id += 1;
                        }
                    }
                }
                _ => {}
            }
        }
    }

    fn visit_statement(&mut self, stmt: &Statement, mod_name: &str) {
        match stmt {
            Statement::Block(stmts) => {
                for s in stmts {
                    self.visit_statement(s, mod_name);
                }
            }
            Statement::BlockingAssign { span, rhs, .. } => {
                let (line, col) = offset_to_line_col(self.source, span.start);
                let snippet = self.get_snippet(*span);
                self.statements.push(StatementPoint {
                    id: self.next_stmt_id,
                    span: *span,
                    line,
                    col,
                    module_name: mod_name.to_string(),
                    snippet,
                });
                self.next_stmt_id += 1;
                self.visit_expr(rhs, mod_name);
            }
            Statement::NonBlockingAssign { span, rhs, .. } => {
                let (line, col) = offset_to_line_col(self.source, span.start);
                let snippet = self.get_snippet(*span);
                self.statements.push(StatementPoint {
                    id: self.next_stmt_id,
                    span: *span,
                    line,
                    col,
                    module_name: mod_name.to_string(),
                    snippet,
                });
                self.next_stmt_id += 1;
                self.visit_expr(rhs, mod_name);
            }
            Statement::If {
                cond,
                then_branch,
                else_branch,
                span,
            } => {
                let (line, col) = offset_to_line_col(self.source, span.start);
                let cond_span = cond.span();
                let cond_text = self.get_snippet(cond_span);
                let (then_line, _) = offset_to_line_col(self.source, then_branch.span().start);
                let else_line = else_branch
                    .as_ref()
                    .map(|b| offset_to_line_col(self.source, b.span().start).0);

                self.branches.push(BranchPoint {
                    id: self.next_branch_id,
                    span: *span,
                    line,
                    col,
                    module_name: mod_name.to_string(),
                    kind: CoveragePointKind::BranchIf,
                    cond_text,
                    then_line,
                    else_line,
                });
                self.next_branch_id += 1;

                self.visit_expr(cond, mod_name);
                self.visit_statement(then_branch, mod_name);
                if let Some(eb) = else_branch {
                    self.visit_statement(eb, mod_name);
                }
            }
            Statement::Case { expr, items, .. } => {
                let expr_text = self.get_snippet(expr.span());

                for item in items {
                    let (item_line, item_col) = offset_to_line_col(self.source, item.span.start);
                    let item_cond = if item.patterns.is_empty() {
                        "default".to_string()
                    } else {
                        format!("case({})", expr_text)
                    };
                    self.branches.push(BranchPoint {
                        id: self.next_branch_id,
                        span: item.span,
                        line: item_line,
                        col: item_col,
                        module_name: mod_name.to_string(),
                        kind: CoveragePointKind::BranchCaseArm,
                        cond_text: item_cond,
                        then_line: item_line,
                        else_line: None,
                    });
                    self.next_branch_id += 1;
                    self.visit_statement(&item.body, mod_name);
                }
                self.visit_expr(expr, mod_name);
            }
            Statement::For {
                init,
                cond,
                step,
                body,
                span: _,
            } => {
                self.visit_statement(init, mod_name);
                self.visit_expr(cond, mod_name);
                self.visit_statement(step, mod_name);
                self.visit_statement(body, mod_name);
            }
            Statement::Delay { stmt, .. } => {
                if let Some(s) = stmt {
                    self.visit_statement(s, mod_name);
                }
            }
            Statement::TaskCall { span, .. } => {
                let (line, col) = offset_to_line_col(self.source, span.start);
                let snippet = self.get_snippet(*span);
                self.statements.push(StatementPoint {
                    id: self.next_stmt_id,
                    span: *span,
                    line,
                    col,
                    module_name: mod_name.to_string(),
                    snippet,
                });
                self.next_stmt_id += 1;
            }
            Statement::Assertion(assert_def) => {
                let (line, col) = offset_to_line_col(self.source, assert_def.span.start);
                let snippet = self.get_snippet(assert_def.span);
                self.statements.push(StatementPoint {
                    id: self.next_stmt_id,
                    span: assert_def.span,
                    line,
                    col,
                    module_name: mod_name.to_string(),
                    snippet,
                });
                self.next_stmt_id += 1;
            }
            Statement::Null => {}
        }
    }

    fn visit_expr(&mut self, expr: &Expr, mod_name: &str) {
        match expr {
            Expr::Ternary {
                cond,
                then_expr,
                else_expr,
                span,
            } => {
                let (line, col) = offset_to_line_col(self.source, span.start);
                let cond_text = self.get_snippet(cond.span());
                let (then_line, _) = offset_to_line_col(self.source, then_expr.span().start);
                let (else_line, _) = offset_to_line_col(self.source, else_expr.span().start);

                self.branches.push(BranchPoint {
                    id: self.next_branch_id,
                    span: *span,
                    line,
                    col,
                    module_name: mod_name.to_string(),
                    kind: CoveragePointKind::BranchTernary,
                    cond_text,
                    then_line,
                    else_line: Some(else_line),
                });
                self.next_branch_id += 1;

                self.visit_expr(cond, mod_name);
                self.visit_expr(then_expr, mod_name);
                self.visit_expr(else_expr, mod_name);
            }
            Expr::Unary { expr, .. } => self.visit_expr(expr, mod_name),
            Expr::Binary { lhs, rhs, .. } => {
                self.visit_expr(lhs, mod_name);
                self.visit_expr(rhs, mod_name);
            }
            Expr::Slice { target, msb, lsb, .. } => {
                self.visit_expr(target, mod_name);
                self.visit_expr(msb, mod_name);
                self.visit_expr(lsb, mod_name);
            }
            Expr::Concat(exprs, _) => {
                for e in exprs {
                    self.visit_expr(e, mod_name);
                }
            }
            Expr::Call { args, .. } => {
                for a in args {
                    self.visit_expr(a, mod_name);
                }
            }
            Expr::Replication { count, expr, .. } => {
                self.visit_expr(count, mod_name);
                self.visit_expr(expr, mod_name);
            }
            _ => {}
        }
    }

    fn get_snippet(&self, span: Span) -> String {
        let start = (span.start as usize).min(self.source.len());
        let end = (span.end as usize).min(self.source.len());
        if start <= end {
            self.source[start..end].trim().to_string()
        } else {
            String::new()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parse_hdl;

    #[test]
    fn test_extract_statements_and_branches() {
        let source = r#"
module alu (
    input wire [3:0] a,
    input wire [3:0] b,
    input wire sel,
    output reg [3:0] out
);
    wire [3:0] sum;
    assign sum = a + b;

    always @(*) begin
        if (sel) begin
            out = sum;
        end else begin
            out = a & b;
        end
    end
endmodule
"#;
        let (ast, diags) = parse_hdl(FileId(1), source);
        assert!(diags.is_empty(), "Parse diagnostics: {:?}", diags);

        let points = CoveragePointExtractor::extract(FileId(1), source, &ast);
        assert!(!points.statements.is_empty(), "Should have statements");
        assert_eq!(points.branches.len(), 1, "Should have 1 if branch");

        let if_branch = &points.branches[0];
        assert_eq!(if_branch.kind, CoveragePointKind::BranchIf);
        assert!(if_branch.cond_text.contains("sel"));
        assert!(if_branch.else_line.is_some());
    }

    #[test]
    fn test_extract_case_arms() {
        let source = r#"
module fsm_toy (
    input wire clk,
    input wire [1:0] state,
    output reg [1:0] next_state
);
    always @(posedge clk) begin
        case (state)
            2'b00: next_state <= 2'b01;
            2'b01: next_state <= 2'b10;
            default: next_state <= 2'b00;
        endcase
    end
endmodule
"#;
        let (ast, diags) = parse_hdl(FileId(1), source);
        assert!(diags.is_empty());

        let points = CoveragePointExtractor::extract(FileId(1), source, &ast);
        assert_eq!(points.branches.len(), 3, "Expected 3 case arms");
        assert_eq!(points.branches[0].kind, CoveragePointKind::BranchCaseArm);
        assert_eq!(points.branches[2].cond_text, "default");
    }
}
