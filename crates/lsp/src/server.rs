use crate::completion::VerilogCompletion;
use crate::hover::VerilogHover;
use crate::linter::VerilogLinter;
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{self, BufRead, BufReader, Read, Write};

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct JsonRpcRequest {
    jsonrpc: String,
    id: Option<Value>,
    method: String,
    #[serde(default)]
    params: Value,
}

pub struct LspServer {
    documents: HashMap<String, String>,
}

impl LspServer {
    pub fn new() -> Self {
        Self {
            documents: HashMap::new(),
        }
    }

    pub fn run_stdio(&mut self) -> io::Result<()> {
        let stdin = io::stdin();
        let mut reader = BufReader::new(stdin.lock());
        let mut stdout = io::stdout();

        loop {
            // Read headers
            let mut content_length: Option<usize> = None;
            loop {
                let mut line = String::new();
                if reader.read_line(&mut line)? == 0 {
                    return Ok(()); // EOF
                }
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    break; // Header section ended
                }
                if let Some(rest) = trimmed.strip_prefix("Content-Length:") {
                    if let Ok(len) = rest.trim().parse::<usize>() {
                        content_length = Some(len);
                    }
                }
            }

            let len = match content_length {
                Some(l) => l,
                None => continue,
            };

            // Read payload body
            let mut body = vec![0u8; len];
            reader.read_exact(&mut body)?;

            let msg: JsonRpcRequest = match serde_json::from_slice(&body) {
                Ok(m) => m,
                Err(e) => {
                    eprintln!("[axiom-lsp] Failed to parse JSON-RPC: {}", e);
                    continue;
                }
            };

            self.handle_message(&msg, &mut stdout)?;
        }
    }

    fn handle_message(&mut self, req: &JsonRpcRequest, stdout: &mut io::Stdout) -> io::Result<()> {
        match req.method.as_str() {
            "initialize" => {
                let resp = json!({
                    "jsonrpc": "2.0",
                    "id": req.id,
                    "result": {
                        "capabilities": {
                            "textDocumentSync": 1, // Full
                            "hoverProvider": true,
                            "completionProvider": {
                                "resolveProvider": false,
                                "triggerCharacters": [".", "$", "@"]
                            }
                        },
                        "serverInfo": {
                            "name": "axiom-lsp",
                            "version": "1.0.0"
                        }
                    }
                });
                self.send_response(stdout, &resp)?;
            }
            "initialized" => {
                // Client initialized notification, no response required
            }
            "textDocument/didOpen" => {
                if let Some(text_doc) = req.params.get("textDocument") {
                    if let (Some(uri), Some(text)) = (text_doc.get("uri").and_then(|u| u.as_str()), text_doc.get("text").and_then(|t| t.as_str())) {
                        self.documents.insert(uri.to_string(), text.to_string());
                        self.publish_diagnostics(uri, text, stdout)?;
                    }
                }
            }
            "textDocument/didChange" => {
                if let (Some(uri), Some(changes)) = (
                    req.params.get("textDocument").and_then(|td| td.get("uri")).and_then(|u| u.as_str()),
                    req.params.get("contentChanges").and_then(|cc| cc.as_array()),
                ) {
                    if let Some(last_change) = changes.last() {
                        if let Some(new_text) = last_change.get("text").and_then(|t| t.as_str()) {
                            self.documents.insert(uri.to_string(), new_text.to_string());
                            self.publish_diagnostics(uri, new_text, stdout)?;
                        }
                    }
                }
            }
            "textDocument/hover" => {
                let mut hover_val = Value::Null;
                if let (Some(uri), Some(pos)) = (
                    req.params.get("textDocument").and_then(|td| td.get("uri")).and_then(|u| u.as_str()),
                    req.params.get("position"),
                ) {
                    if let Some(doc) = self.documents.get(uri) {
                        let line = pos.get("line").and_then(|l| l.as_u64()).unwrap_or(0) as u32 + 1;
                        let character = pos.get("character").and_then(|c| c.as_u64()).unwrap_or(0) as u32 + 1;
                        if let Some(h) = VerilogHover::hover(doc, line, character) {
                            hover_val = json!({
                                "contents": {
                                    "kind": "markdown",
                                    "value": h.contents
                                }
                            });
                        }
                    }
                }

                let resp = json!({
                    "jsonrpc": "2.0",
                    "id": req.id,
                    "result": hover_val
                });
                self.send_response(stdout, &resp)?;
            }
            "textDocument/completion" => {
                let mut items = Vec::new();
                if let (Some(uri), Some(pos)) = (
                    req.params.get("textDocument").and_then(|td| td.get("uri")).and_then(|u| u.as_str()),
                    req.params.get("position"),
                ) {
                    if let Some(doc) = self.documents.get(uri) {
                        let line = pos.get("line").and_then(|l| l.as_u64()).unwrap_or(0) as u32 + 1;
                        let character = pos.get("character").and_then(|c| c.as_u64()).unwrap_or(0) as u32 + 1;
                        let comps = VerilogCompletion::complete(doc, line, character);
                        for c in comps {
                            items.push(json!({
                                "label": c.label,
                                "kind": c.kind,
                                "detail": c.detail,
                                "insertText": c.insert_text,
                                "documentation": c.documentation
                            }));
                        }
                    }
                }

                let resp = json!({
                    "jsonrpc": "2.0",
                    "id": req.id,
                    "result": {
                        "isIncomplete": false,
                        "items": items
                    }
                });
                self.send_response(stdout, &resp)?;
            }
            "shutdown" => {
                let resp = json!({
                    "jsonrpc": "2.0",
                    "id": req.id,
                    "result": Value::Null
                });
                self.send_response(stdout, &resp)?;
            }
            "exit" => {
                std::process::exit(0);
            }
            _ => {
                if req.id.is_some() {
                    let resp = json!({
                        "jsonrpc": "2.0",
                        "id": req.id,
                        "error": {
                            "code": -32601,
                            "message": format!("Method '{}' not found", req.method)
                        }
                    });
                    self.send_response(stdout, &resp)?;
                }
            }
        }
        Ok(())
    }

    fn publish_diagnostics(&self, uri: &str, text: &str, stdout: &mut io::Stdout) -> io::Result<()> {
        let diags = VerilogLinter::lint(text);
        let mut lsp_diags = Vec::new();

        for d in diags {
            lsp_diags.push(json!({
                "range": {
                    "start": {
                        "line": d.start_line_number.saturating_sub(1),
                        "character": d.start_column.saturating_sub(1)
                    },
                    "end": {
                        "line": d.end_line_number.saturating_sub(1),
                        "character": d.end_column.saturating_sub(1)
                    }
                },
                "severity": d.severity,
                "code": d.code,
                "source": d.source,
                "message": d.message
            }));
        }

        let notification = json!({
            "jsonrpc": "2.0",
            "method": "textDocument/publishDiagnostics",
            "params": {
                "uri": uri,
                "diagnostics": lsp_diags
            }
        });

        self.send_response(stdout, &notification)
    }

    fn send_response(&self, stdout: &mut io::Stdout, val: &Value) -> io::Result<()> {
        let json_str = serde_json::to_string(val)?;
        write!(stdout, "Content-Length: {}\r\n\r\n{}", json_str.len(), json_str)?;
        stdout.flush()
    }
}
