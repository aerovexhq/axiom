use crate::token::{Token, TokenKind};
use axiom_core::{FileId, Logic4, LogicVector, Span};

pub struct Lexer<'a> {
    source: &'a str,
    bytes: &'a [u8],
    file_id: FileId,
    cursor: usize,
}

impl<'a> Lexer<'a> {
    pub fn new(file_id: FileId, source: &'a str) -> Self {
        Self {
            source,
            bytes: source.as_bytes(),
            file_id,
            cursor: 0,
        }
    }

    #[inline]
    fn is_eof(&self) -> bool {
        self.cursor >= self.bytes.len()
    }

    #[inline]
    fn peek(&self) -> Option<u8> {
        if self.is_eof() {
            None
        } else {
            Some(self.bytes[self.cursor])
        }
    }

    #[inline]
    fn peek_next(&self) -> Option<u8> {
        if self.cursor + 1 < self.bytes.len() {
            Some(self.bytes[self.cursor + 1])
        } else {
            None
        }
    }

    #[inline]
    fn advance(&mut self) -> u8 {
        let b = self.bytes[self.cursor];
        self.cursor += 1;
        b
    }

    fn skip_whitespace_and_comments(&mut self) {
        while !self.is_eof() {
            match self.peek().unwrap() {
                b' ' | b'\t' | b'\r' | b'\n' => {
                    self.advance();
                }
                b'/' if self.peek_next() == Some(b'/') => {
                    // Line comment: skip to newline
                    self.advance();
                    self.advance();
                    while !self.is_eof() && self.peek() != Some(b'\n') {
                        self.advance();
                    }
                }
                b'/' if self.peek_next() == Some(b'*') => {
                    // Block comment: skip to */
                    self.advance();
                    self.advance();
                    while !self.is_eof() {
                        if self.peek() == Some(b'*') && self.peek_next() == Some(b'/') {
                            self.advance();
                            self.advance();
                            break;
                        }
                        self.advance();
                    }
                }
                _ => break,
            }
        }
    }

    pub fn next_token(&mut self) -> Token {
        self.skip_whitespace_and_comments();

        if self.is_eof() {
            let offset = self.cursor as u32;
            return Token::new(TokenKind::Eof, Span::new(self.file_id, offset, offset));
        }

        let start_offset = self.cursor as u32;
        let c = self.peek().unwrap();

        // Compiler directives (`define, `ifdef, etc.)
        if c == b'`' {
            self.advance();
            let ident_start = self.cursor;
            while !self.is_eof() && (self.peek().unwrap().is_ascii_alphanumeric() || self.peek().unwrap() == b'_') {
                self.advance();
            }
            let name = &self.source[ident_start..self.cursor];
            let end_offset = self.cursor as u32;
            let span = Span::new(self.file_id, start_offset, end_offset);

            let kind = match name {
                "define" => TokenKind::DirectiveDefine,
                "ifdef" => TokenKind::DirectiveIfdef,
                "ifndef" => TokenKind::DirectiveIfndef,
                "else" => TokenKind::DirectiveElse,
                "elsif" => TokenKind::DirectiveElsif,
                "endif" => TokenKind::DirectiveEndif,
                "include" => TokenKind::DirectiveInclude,
                "timescale" => TokenKind::DirectiveTimescale,
                "default_nettype" => TokenKind::DirectiveDefaultNettype,
                "resetall" => TokenKind::DirectiveResetall,
                "undef" => TokenKind::DirectiveUndef,
                "celldefine" | "endcelldefine" => TokenKind::DirectiveCelldefine,
                other => TokenKind::Error(format!("Unknown compiler directive: `{other}")),
            };
            return Token::new(kind, span);
        }

        // Identifiers, Keywords, or System Identifiers ($dumpfile, $finish, etc.)
        if c.is_ascii_alphabetic() || c == b'_' || c == b'$' {
            return self.scan_identifier_or_keyword(start_offset);
        }

        // Sized or Unsized Number Literals
        if c.is_ascii_digit() || (c == b'\'' && (self.peek_next() == Some(b'0') || self.peek_next() == Some(b'1') || self.peek_next() == Some(b'x') || self.peek_next() == Some(b'z') || self.peek_next() == Some(b'b') || self.peek_next() == Some(b'h') || self.peek_next() == Some(b'd'))) {
            return self.scan_number(start_offset);
        }

        // Strings
        if c == b'"' {
            return self.scan_string(start_offset);
        }

        // Operators and Delimiters
        self.advance();

        let kind = match c {
            b'(' => TokenKind::LParen,
            b')' => TokenKind::RParen,
            b'[' => {
                if self.peek() == Some(b'*') {
                    self.advance();
                    TokenKind::RepeatStar
                } else {
                    TokenKind::LBracket
                }
            }
            b']' => TokenKind::RBracket,
            b'{' => TokenKind::LBrace,
            b'}' => TokenKind::RBrace,
            b';' => TokenKind::Semicolon,
            b',' => TokenKind::Comma,
            b'.' => TokenKind::Dot,
            b'#' => {
                if self.peek() == Some(b'#') {
                    self.advance();
                    TokenKind::CycleDelay
                } else {
                    TokenKind::Hash
                }
            }
            b'@' => TokenKind::At,
            b'?' => TokenKind::Question,
            b':' => TokenKind::Colon,

            b'+' => {
                if self.peek() == Some(b':') {
                    self.advance();
                    TokenKind::PlusColon
                } else {
                    TokenKind::Plus
                }
            }
            b'-' => {
                if self.peek() == Some(b':') {
                    self.advance();
                    TokenKind::MinusColon
                } else {
                    TokenKind::Minus
                }
            }
            b'*' => {
                if self.peek() == Some(b'*') {
                    self.advance();
                    TokenKind::Power
                } else {
                    TokenKind::Star
                }
            }
            b'/' => TokenKind::Slash,
            b'%' => TokenKind::Percent,

            b'&' => {
                if self.peek() == Some(b'&') {
                    self.advance();
                    TokenKind::AmpAmp
                } else {
                    TokenKind::Amp
                }
            }
            b'|' => {
                if self.peek() == Some(b'|') {
                    self.advance();
                    TokenKind::PipePipe
                } else if self.peek() == Some(b'-') && self.peek_next() == Some(b'>') {
                    self.advance(); // consume '-'
                    self.advance(); // consume '>'
                    TokenKind::ImpliesOverlap
                } else if self.peek() == Some(b'=') && self.peek_next() == Some(b'>') {
                    self.advance(); // consume '='
                    self.advance(); // consume '>'
                    TokenKind::ImpliesNonOverlap
                } else {
                    TokenKind::Pipe
                }
            }
            b'^' => {
                if self.peek() == Some(b'~') {
                    self.advance();
                    TokenKind::TildeCaret
                } else {
                    TokenKind::Caret
                }
            }
            b'~' => {
                if self.peek() == Some(b'^') {
                    self.advance();
                    TokenKind::TildeCaret
                } else {
                    TokenKind::Tilde
                }
            }
            b'!' => {
                if self.peek() == Some(b'=') {
                    self.advance();
                    if self.peek() == Some(b'=') {
                        self.advance();
                        TokenKind::BangEqEq
                    } else {
                        TokenKind::BangEq
                    }
                } else {
                    TokenKind::Bang
                }
            }
            b'=' => {
                if self.peek() == Some(b'=') {
                    self.advance();
                    if self.peek() == Some(b'=') {
                        self.advance();
                        TokenKind::EqEqEq
                    } else {
                        TokenKind::EqEq
                    }
                } else {
                    TokenKind::AssignEq
                }
            }
            b'<' => {
                if self.peek() == Some(b'=') {
                    self.advance();
                    TokenKind::LtEq // Can also be nonblocking assignment depending on context
                } else if self.peek() == Some(b'<') {
                    self.advance();
                    if self.peek() == Some(b'<') {
                        self.advance();
                        TokenKind::ShlArith
                    } else {
                        TokenKind::Shl
                    }
                } else {
                    TokenKind::Lt
                }
            }
            b'>' => {
                if self.peek() == Some(b'=') {
                    self.advance();
                    TokenKind::GtEq
                } else if self.peek() == Some(b'>') {
                    self.advance();
                    if self.peek() == Some(b'>') {
                        self.advance();
                        TokenKind::ShrArith
                    } else {
                        TokenKind::Shr
                    }
                } else {
                    TokenKind::Gt
                }
            }
            other => TokenKind::Error(format!("Unexpected character: '{}'", other as char)),
        };

        Token::new(kind, Span::new(self.file_id, start_offset, self.cursor as u32))
    }

    fn scan_identifier_or_keyword(&mut self, start_offset: u32) -> Token {
        while !self.is_eof() {
            let b = self.peek().unwrap();
            if b.is_ascii_alphanumeric() || b == b'_' || b == b'$' {
                self.advance();
            } else {
                break;
            }
        }
        let end_offset = self.cursor as u32;
        let text = &self.source[start_offset as usize..end_offset as usize];
        let span = Span::new(self.file_id, start_offset, end_offset);

        let kind = match text {
            "module" => TokenKind::Module,
            "endmodule" => TokenKind::EndModule,
            "input" => TokenKind::Input,
            "output" => TokenKind::Output,
            "inout" => TokenKind::Inout,
            "wire" => TokenKind::Wire,
            "reg" => TokenKind::Reg,
            "logic" => TokenKind::Logic,
            "parameter" => TokenKind::Parameter,
            "localparam" => TokenKind::LocalParam,
            "assign" => TokenKind::Assign,
            "always" => TokenKind::Always,
            "always_comb" => TokenKind::AlwaysComb,
            "always_ff" => TokenKind::AlwaysFf,
            "always_latch" => TokenKind::AlwaysLatch,
            "initial" => TokenKind::Initial,
            "begin" => TokenKind::Begin,
            "end" => TokenKind::End,
            "if" => TokenKind::If,
            "else" => TokenKind::Else,
            "case" => TokenKind::Case,
            "casez" => TokenKind::Casez,
            "casex" => TokenKind::Casex,
            "endcase" => TokenKind::EndCase,
            "default" => TokenKind::Default,
            "for" => TokenKind::For,
            "forever" => TokenKind::Forever,
            "repeat" => TokenKind::Repeat,
            "while" => TokenKind::While,
            "generate" => TokenKind::Generate,
            "endgenerate" => TokenKind::EndGenerate,
            "genvar" => TokenKind::Genvar,
            "posedge" => TokenKind::Posedge,
            "negedge" => TokenKind::Negedge,
            "integer" => TokenKind::Integer,
            "time" => TokenKind::Time,
            "assert" => TokenKind::Assert,
            "property" => TokenKind::Property,
            "sequence" => TokenKind::Sequence,
            "cover" => TokenKind::Cover,
            "assume" => TokenKind::Assume,
            _ => TokenKind::Ident(text.to_string()),
        };

        Token::new(kind, span)
    }

    fn scan_number(&mut self, start_offset: u32) -> Token {
        // May start with digits (size prefix or unsized integer)
        let mut width_opt: Option<u32> = None;
        if self.peek().unwrap().is_ascii_digit() {
            let mut num_str = String::new();
            while !self.is_eof() && (self.peek().unwrap().is_ascii_digit() || self.peek().unwrap() == b'_') {
                let b = self.advance();
                if b != b'_' {
                    num_str.push(b as char);
                }
            }

            if self.peek() == Some(b'\'') {
                // Sized literal: e.g. 32'hDEAD_BEEF
                if let Ok(w) = num_str.parse::<u32>() {
                    width_opt = Some(w);
                }
            } else {
                // Unsized decimal integer
                let end_offset = self.cursor as u32;
                let span = Span::new(self.file_id, start_offset, end_offset);
                let val = num_str.parse::<u64>().unwrap_or(0);
                return Token::new(TokenKind::UnsizedInt(val), span);
            }
        }

        // Must be at '\''
        if self.peek() == Some(b'\'') {
            self.advance(); // consume '\''
            let base_char = self.advance();
            let mut val_str = String::new();
            while !self.is_eof() && (self.peek().unwrap().is_ascii_alphanumeric() || self.peek().unwrap() == b'_' || self.peek().unwrap() == b'?' ) {
                let b = self.advance();
                if b != b'_' {
                    val_str.push(b as char);
                }
            }

            let end_offset = self.cursor as u32;
            let span = Span::new(self.file_id, start_offset, end_offset);

            let vec_res = match base_char {
                b'b' | b'B' => {
                    let w = width_opt.unwrap_or(val_str.len() as u32);
                    LogicVector::from_bin_str(&val_str).map(|v| {
                        if v.width() < w {
                            // zero-extend
                            let mut ext = LogicVector::zeros(w);
                            for i in 0..v.width() {
                                ext.set_bit(i, v.get_bit(i));
                            }
                            ext
                        } else {
                            v
                        }
                    })
                }
                b'h' | b'H' => LogicVector::from_hex_str(&val_str, width_opt),
                b'd' | b'D' => {
                    let w = width_opt.unwrap_or(32);
                    let val = val_str.parse::<u64>().unwrap_or(0);
                    Ok(LogicVector::from_u64(val, w))
                }
                b'0' => {
                    // SystemVerilog unbased unsized literal '0
                    let w = width_opt.unwrap_or(1);
                    Ok(LogicVector::fill(w, Logic4::Zero))
                }
                b'1' => {
                    // SystemVerilog unbased unsized literal '1
                    let w = width_opt.unwrap_or(1);
                    Ok(LogicVector::fill(w, Logic4::One))
                }
                b'x' | b'X' => {
                    let w = width_opt.unwrap_or(1);
                    Ok(LogicVector::fill(w, Logic4::X))
                }
                b'z' | b'Z' => {
                    let w = width_opt.unwrap_or(1);
                    Ok(LogicVector::fill(w, Logic4::Z))
                }
                other => Err(format!("Unknown number base: '{other}'")),
            };

            match vec_res {
                Ok(vec) => Token::new(TokenKind::Number(vec), span),
                Err(err) => Token::new(TokenKind::Error(err), span),
            }
        } else {
            let end_offset = self.cursor as u32;
            Token::new(TokenKind::Error("Invalid numeric literal".into()), Span::new(self.file_id, start_offset, end_offset))
        }
    }

    fn scan_string(&mut self, start_offset: u32) -> Token {
        self.advance(); // skip opening quote
        let mut s = String::new();
        while !self.is_eof() && self.peek() != Some(b'"') {
            let b = self.advance();
            if b == b'\\' && !self.is_eof() {
                let esc = self.advance();
                match esc {
                    b'n' => s.push('\n'),
                    b't' => s.push('\t'),
                    b'\\' => s.push('\\'),
                    b'"' => s.push('"'),
                    other => s.push(other as char),
                }
            } else {
                s.push(b as char);
            }
        }

        if !self.is_eof() {
            self.advance(); // skip closing quote
        }

        let end_offset = self.cursor as u32;
        Token::new(TokenKind::StringLiteral(s), Span::new(self.file_id, start_offset, end_offset))
    }

    /// Tokenizes the entire source string into a vector of Tokens.
    pub fn tokenize(&mut self) -> Vec<Token> {
        let mut tokens = Vec::new();
        loop {
            let tok = self.next_token();
            let is_eof = tok.kind == TokenKind::Eof;
            tokens.push(tok);
            if is_eof {
                break;
            }
        }
        tokens
    }
}
