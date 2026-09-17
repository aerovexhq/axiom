pub mod ast;
pub mod lexer;
pub mod parser;
pub mod preprocessor;
pub mod token;

pub use ast::*;
pub use lexer::Lexer;
pub use parser::Parser;
pub use preprocessor::Preprocessor;
pub use token::{Token, TokenKind};

use axiom_core::{Diagnostic, FileId};

/// Parses a Verilog / SystemVerilog source string into an AST with collected diagnostics.
pub fn parse_hdl(file_id: FileId, source: &str) -> (SourceFile, Vec<Diagnostic>) {
    let mut lexer = Lexer::new(file_id, source);
    let tokens = lexer.tokenize();
    let mut parser = Parser::new(file_id, &tokens);
    parser.parse_source_file()
}

#[cfg(test)]
mod tests;
