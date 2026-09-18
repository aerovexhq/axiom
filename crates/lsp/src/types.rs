use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u32)]
pub enum LspSeverity {
    Error = 1,
    Warning = 2,
    Information = 3,
    Hint = 4,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LspRange {
    pub start_line_number: u32,
    pub start_column: u32,
    pub end_line_number: u32,
    pub end_column: u32,
}

impl LspRange {
    pub fn new(start_line: u32, start_col: u32, end_line: u32, end_col: u32) -> Self {
        Self {
            start_line_number: start_line,
            start_column: start_col,
            end_line_number: end_line,
            end_column: end_col,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LspDiagnostic {
    #[serde(rename = "startLineNumber")]
    pub start_line_number: u32,
    #[serde(rename = "startColumn")]
    pub start_column: u32,
    #[serde(rename = "endLineNumber")]
    pub end_line_number: u32,
    #[serde(rename = "endColumn")]
    pub end_column: u32,
    pub message: String,
    pub severity: u32, // 1: Error, 2: Warning, 3: Info, 4: Hint
    pub code: String,
    pub source: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub help: Option<String>,
}

impl LspDiagnostic {
    pub fn error(
        code: impl Into<String>,
        message: impl Into<String>,
        start_line: u32,
        start_col: u32,
        end_line: u32,
        end_col: u32,
    ) -> Self {
        Self {
            start_line_number: start_line,
            start_column: start_col,
            end_line_number: end_line,
            end_column: end_col,
            message: message.into(),
            severity: LspSeverity::Error as u32,
            code: code.into(),
            source: "axiom-linter".to_string(),
            help: None,
        }
    }

    pub fn warning(
        code: impl Into<String>,
        message: impl Into<String>,
        start_line: u32,
        start_col: u32,
        end_line: u32,
        end_col: u32,
    ) -> Self {
        Self {
            start_line_number: start_line,
            start_column: start_col,
            end_line_number: end_line,
            end_column: end_col,
            message: message.into(),
            severity: LspSeverity::Warning as u32,
            code: code.into(),
            source: "axiom-linter".to_string(),
            help: None,
        }
    }

    pub fn info(
        code: impl Into<String>,
        message: impl Into<String>,
        start_line: u32,
        start_col: u32,
        end_line: u32,
        end_col: u32,
    ) -> Self {
        Self {
            start_line_number: start_line,
            start_column: start_col,
            end_line_number: end_line,
            end_column: end_col,
            message: message.into(),
            severity: LspSeverity::Information as u32,
            code: code.into(),
            source: "axiom-linter".to_string(),
            help: None,
        }
    }

    pub fn with_help(mut self, help: impl Into<String>) -> Self {
        self.help = Some(help.into());
        self
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HoverResult {
    pub contents: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub range: Option<LspRange>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionItem {
    pub label: String,
    pub kind: u32,
    pub detail: String,
    #[serde(rename = "insertText")]
    pub insert_text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub documentation: Option<String>,
}
