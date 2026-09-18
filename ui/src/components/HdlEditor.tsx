import React, { useRef, useEffect, useState } from "react";
import Editor, { OnMount, loader } from "@monaco-editor/react";
import * as monacoPkg from "monaco-editor";
import {
  Code2,
  Play,
  CheckCircle2,
  Plus,
  X,
  Maximize2,
  Minimize2,
  FileCode,
  FileText,
  ChevronRight,
  AlertTriangle,
  AlertCircle,
  CheckCircle
} from "lucide-react";
import { AxiomProject } from "../engine/projectModel";
import { engineBridge, LspDiagnostic } from "../engine/engineBridge";
import { registerVerilogLanguage } from "../engine/monacoVerilog";

// Configure monaco-editor loader to use bundled package
loader.config({ monaco: monacoPkg });

interface HdlEditorProps {
  code: string;
  topModule: string;
  onChangeCode: (code: string) => void;
  onCompile: () => void;
  compiled: boolean;
  highlightLineSpan?: { lineStart: number; lineEnd: number } | null;
  project?: AxiomProject;
  onSelectTab?: (fileId: string) => void;
  onCloseTab?: (fileId: string) => void;
  onAddFileClick?: () => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  onDiagnosticsChange?: (diagnostics: LspDiagnostic[]) => void;
  onOpenProblems?: () => void;
}

export const HdlEditor: React.FC<HdlEditorProps> = ({
  code,
  topModule,
  onChangeCode,
  onCompile,
  compiled,
  highlightLineSpan,
  project,
  onSelectTab,
  onCloseTab,
  onAddFileClick,
  isMaximized,
  onToggleMaximize,
  onDiagnosticsChange,
  onOpenProblems
}) => {
  const editorRef = useRef<monacoPkg.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monacoPkg | null>(null);
  const [localDiags, setLocalDiags] = useState<LspDiagnostic[]>([]);

  // Setup Monaco on mount
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    registerVerilogLanguage(monaco);

    if (highlightLineSpan) {
      editor.revealLineInCenter(highlightLineSpan.lineStart);
      editor.setPosition({ lineNumber: highlightLineSpan.lineStart, column: 1 });
    }
  };

  // Debounced live static analysis linting
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (!code) {
        setLocalDiags([]);
        onDiagnosticsChange?.([]);
        return;
      }
      try {
        const diags = await engineBridge.lint(code);
        if (cancelled) return;

        setLocalDiags(diags);
        onDiagnosticsChange?.(diags);

        if (editorRef.current && monacoRef.current) {
          const model = editorRef.current.getModel();
          if (model) {
            const markers: monacoPkg.editor.IMarkerData[] = diags.map((d) => ({
              startLineNumber: d.startLineNumber,
              startColumn: d.startColumn,
              endLineNumber: d.endLineNumber,
              endColumn: d.endColumn,
              message: `${d.message}${d.help ? `\n↳ ${d.help}` : ""}`,
              severity:
                d.severity === 1
                  ? monacoRef.current!.MarkerSeverity.Error
                  : d.severity === 2
                  ? monacoRef.current!.MarkerSeverity.Warning
                  : d.severity === 3
                  ? monacoRef.current!.MarkerSeverity.Info
                  : monacoRef.current!.MarkerSeverity.Hint,
              source: d.source || "axiom-linter",
              code: d.code,
            }));
            monacoRef.current.editor.setModelMarkers(model, "axiom-linter", markers);
          }
        }
      } catch (err) {
        console.error("[HdlEditor] Linting error:", err);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [code, onDiagnosticsChange]);

  // Jump to highlightLineSpan when updated
  useEffect(() => {
    if (highlightLineSpan && editorRef.current) {
      editorRef.current.revealLineInCenter(highlightLineSpan.lineStart);
      editorRef.current.setPosition({ lineNumber: highlightLineSpan.lineStart, column: 1 });
      editorRef.current.focus();
    }
  }, [highlightLineSpan]);

  // Determine active file info from project if available
  const activeFile = project?.files.find((f) => f.id === project.activeFileId);
  const openFiles = project
    ? project.openFileIds
        .map((id) => project.files.find((f) => f.id === id))
        .filter((f): f is NonNullable<typeof f> => !!f)
    : [];

  const errorCount = localDiags.filter((d) => d.severity === 1).length;
  const warningCount = localDiags.filter((d) => d.severity === 2).length;

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--bg-primary)",
        borderRight: "1px solid var(--border-subtle)",
        overflow: "hidden",
        position: isMaximized ? "absolute" : "relative",
        inset: isMaximized ? 0 : undefined,
        zIndex: isMaximized ? 90 : 1
      }}
    >
      {/* Editor Multi-Tab Strip */}
      <div
        style={{
          height: 34,
          backgroundColor: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 6px",
          overflowX: "auto"
        }}
      >
        {/* Left: Open File Tabs */}
        <div style={{ display: "flex", alignItems: "center", gap: 2, overflowX: "auto", flex: 1, minWidth: 0 }}>
          {openFiles.length > 0 ? (
            openFiles.map((file) => {
              const isActive = file.id === project?.activeFileId;
              const isTop = file.isTop || file.name.includes(topModule);

              return (
                <div
                  key={file.id}
                  onClick={() => onSelectTab?.(file.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 8px 4px 10px",
                    borderRadius: "var(--radius-sm) var(--radius-sm) 0 0",
                    backgroundColor: isActive ? "var(--bg-primary)" : "transparent",
                    borderTop: isActive ? "2px solid var(--accent-blue)" : "2px solid transparent",
                    borderLeft: isActive ? "1px solid var(--border-subtle)" : "1px solid transparent",
                    borderRight: isActive ? "1px solid var(--border-subtle)" : "1px solid transparent",
                    cursor: "pointer",
                    userSelect: "none",
                    fontSize: 11,
                    color: isActive ? "#fff" : "var(--text-secondary)",
                    fontWeight: isActive ? 600 : 400,
                    maxWidth: 180
                  }}
                >
                  {file.fileType === "xdc" ? (
                    <FileText size={12} color="var(--accent-purple)" />
                  ) : (
                    <FileCode size={12} color={isTop ? "var(--accent-cyan)" : "var(--accent-blue)"} />
                  )}

                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {file.name}
                  </span>

                  {isTop && (
                    <span
                      style={{
                        fontSize: 8,
                        fontWeight: 700,
                        color: "var(--accent-cyan)",
                        backgroundColor: "rgba(6, 182, 212, 0.15)",
                        padding: "0 3px",
                        borderRadius: 2
                      }}
                    >
                      TOP
                    </span>
                  )}

                  {openFiles.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseTab?.(file.id);
                      }}
                      title="Close Tab"
                      style={{
                        padding: "1px 2px",
                        color: "var(--text-muted)",
                        borderRadius: 2,
                        marginLeft: 2,
                        backgroundColor: "transparent",
                        border: "none",
                        cursor: "pointer"
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-rose)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              );
            })
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 8px" }}>
              <Code2 size={13} color="var(--accent-cyan)" />
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)" }}>
                {topModule}.v
              </span>
            </div>
          )}

          {onAddFileClick && (
            <button
              onClick={onAddFileClick}
              title="Add New Source File"
              style={{
                padding: "3px 5px",
                color: "var(--text-muted)",
                cursor: "pointer",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "transparent",
                border: "none"
              }}
            >
              <Plus size={13} />
            </button>
          )}
        </div>

        {/* Right: Actions (Linter Status Badge, Compiled status, Elaborate, Maximize) */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8 }}>
          {/* Linter Diagnostic Pill */}
          <button
            onClick={onOpenProblems}
            title="Axiom Verilog Linter & Static Analysis Status"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 10,
              fontWeight: 600,
              padding: "2px 7px",
              borderRadius: "var(--radius-sm)",
              backgroundColor:
                errorCount > 0
                  ? "rgba(244, 63, 94, 0.15)"
                  : warningCount > 0
                  ? "rgba(245, 158, 11, 0.15)"
                  : "rgba(16, 185, 129, 0.1)",
              border: `1px solid ${
                errorCount > 0
                  ? "rgba(244, 63, 94, 0.3)"
                  : warningCount > 0
                  ? "rgba(245, 158, 11, 0.3)"
                  : "rgba(16, 185, 129, 0.2)"
              }`,
              color:
                errorCount > 0
                  ? "var(--accent-rose)"
                  : warningCount > 0
                  ? "var(--accent-amber)"
                  : "var(--accent-emerald)",
              cursor: "pointer"
            }}
          >
            {errorCount > 0 ? (
              <>
                <AlertCircle size={11} />
                <span>{errorCount} {errorCount === 1 ? "Error" : "Errors"}</span>
              </>
            ) : warningCount > 0 ? (
              <>
                <AlertTriangle size={11} />
                <span>{warningCount} {warningCount === 1 ? "Warning" : "Warnings"}</span>
              </>
            ) : (
              <>
                <CheckCircle size={11} />
                <span>Clean</span>
              </>
            )}
          </button>

          {compiled && (
            <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "var(--accent-emerald)", marginRight: 4 }}>
              <CheckCircle2 size={12} />
              <span>JIT Ready</span>
            </span>
          )}

          <button
            onClick={onCompile}
            title="Elaborate & JIT Compile Active HDL Project"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 10,
              fontWeight: 600,
              padding: "3px 8px",
              backgroundColor: "var(--accent-blue)",
              color: "#fff",
              borderRadius: "var(--radius-sm)",
              border: "none",
              cursor: "pointer"
            }}
          >
            <Play size={10} fill="#fff" />
            <span>Elaborate</span>
          </button>

          {onToggleMaximize && (
            <button
              onClick={onToggleMaximize}
              title={isMaximized ? "Restore Split View" : "Maximize Code Editor (100%)"}
              style={{
                padding: "3px 5px",
                color: "var(--text-muted)",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                backgroundColor: "transparent",
                border: "none"
              }}
            >
              {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          )}
        </div>
      </div>

      {/* Breadcrumb Bar */}
      <div
        style={{
          height: 22,
          backgroundColor: "var(--bg-tertiary)",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "0 10px",
          fontSize: 10,
          color: "var(--text-muted)",
          fontFamily: "var(--font-mono)"
        }}
      >
        <span>{project?.name ?? "project"}</span>
        <ChevronRight size={10} />
        <span>{activeFile?.fileSet ?? "sources_1"}</span>
        <ChevronRight size={10} />
        <span style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>
          {activeFile?.name ?? `${topModule}.v`}
        </span>
        {activeFile?.isTop && (
          <>
            <ChevronRight size={10} />
            <span style={{ color: "var(--accent-amber)" }}>module {topModule}</span>
          </>
        )}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, fontSize: 9, color: "var(--text-muted)" }}>
          <span>LSP: In-RAM Rust JIT</span>
          <span>•</span>
          <span>UTF-8</span>
          <span>•</span>
          <span>Verilog-2005 / SystemVerilog</span>
        </div>
      </div>

      {/* Monaco Code Editor */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <Editor
          height="100%"
          language="verilog"
          theme="axiom-dark"
          value={code}
          onChange={(val) => onChangeCode(val ?? "")}
          beforeMount={(monaco) => registerVerilogLanguage(monaco)}
          onMount={handleEditorDidMount}
          options={{
            fontFamily: "var(--font-mono), 'JetBrains Mono', 'Fira Code', monospace",
            fontSize: 12,
            lineHeight: 20,
            minimap: { enabled: true, renderCharacters: false, maxColumn: 60 },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            insertSpaces: true,
            renderLineHighlight: "all",
            bracketPairColorization: { enabled: true },
            cursorBlinking: "smooth",
            smoothScrolling: true,
            wordWrap: "off",
            folding: true,
            showFoldingControls: "always",
            suggest: {
              snippetsPreventQuickSuggestions: false,
              showWords: true,
            },
            quickSuggestions: {
              other: true,
              comments: false,
              strings: false,
            },
            padding: { top: 6, bottom: 6 },
          }}
        />
      </div>
    </div>
  );
};
