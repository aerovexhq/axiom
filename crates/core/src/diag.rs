use crate::span::{offset_to_line_col, Span};
use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DiagSeverity {
    Error,
    Warning,
    Info,
    Hint,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Diagnostic {
    pub severity: DiagSeverity,
    pub message: String,
    pub span: Span,
    pub help: Option<String>,
}

impl Diagnostic {
    pub fn error(message: impl Into<String>, span: Span) -> Self {
        Self {
            severity: DiagSeverity::Error,
            message: message.into(),
            span,
            help: None,
        }
    }

    pub fn warning(message: impl Into<String>, span: Span) -> Self {
        Self {
            severity: DiagSeverity::Warning,
            message: message.into(),
            span,
            help: None,
        }
    }

    pub fn with_help(mut self, help: impl Into<String>) -> Self {
        self.help = Some(help.into());
        self
    }

    /// Renders a diagnostic with source code excerpt and caret squiggles.
    pub fn render(&self, file_name: &str, source: &str) -> String {
        let (line_no, col_no) = offset_to_line_col(source, self.span.start);
        let sev_label = match self.severity {
            DiagSeverity::Error => "error",
            DiagSeverity::Warning => "warning",
            DiagSeverity::Info => "info",
            DiagSeverity::Hint => "hint",
        };

        let mut out = format!("{sev_label}: {}\n  --> {file_name}:{line_no}:{col_no}\n", self.message);

        // Find the line text
        let lines: Vec<&str> = source.lines().collect();
        if line_no > 0 && line_no <= lines.len() {
            let line_text = lines[line_no - 1];
            let gutter = format!("{line_no:>4} | ");
            out.push_str(&gutter);
            out.push_str(line_text);
            out.push('\n');

            // Underline
            let prefix_spaces = " ".repeat(gutter.len() + col_no - 1);
            let underline_len = (self.span.len() as usize).max(1);
            let underline_char = if self.severity == DiagSeverity::Error { '^' } else { '~' };
            let underline = underline_char.to_string().repeat(underline_len);
            out.push_str(&format!("{prefix_spaces}{underline}\n"));
        }

        if let Some(help) = &self.help {
            out.push_str(&format!("  = help: {help}\n"));
        }

        out
    }
}

impl fmt::Display for Diagnostic {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:?}: {} at {}", self.severity, self.message, self.span)
    }
}

impl std::error::Error for Diagnostic {}
