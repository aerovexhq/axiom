import React, { useRef, useEffect, useState } from "react";
import Editor, { OnMount, loader } from "@monaco-editor/react";
import * as monacoPkg from "monaco-editor";
import {
  Code2,
  Play,
  Plus,
  X,
  Maximize2,
  Minimize2,
  FileCode,
  FileText,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Swords
} from "lucide-react";
import { AxiomProject } from "../engine/projectModel";
import { engineBridge, LspDiagnostic } from "../engine/engineBridge";
import { registerVerilogLanguage } from "../engine/monacoVerilog";
import { Breadcrumbs, BreadcrumbItem, Button, Badge } from "./ui";
import { useTranslation } from "../i18n";
import { KatanaCursorOverlay } from "./KatanaCursorOverlay";

// Configure monaco-editor loader to use bundled package
loader.config({ monaco: monacoPkg });

interface HdlEditorProps {
  code: string;
  topModule: string;
  onChangeCode: (code: string) => void;
  onCompile: () => void;
  compiled: boolean;
  highlightLineSpan?: { lineStart: number; lineEnd: number } | null;
  project?: AxiomProject | null;
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
  compiled: _compiled,
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
  const { t } = useTranslation();
  const editorRef = useRef<monacoPkg.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monacoPkg | null>(null);
  const [editorInstance, setEditorInstance] = useState<monacoPkg.editor.IStandaloneCodeEditor | null>(null);
  const [katanaEnabled, setKatanaEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("axiom_katana_cursor");
      return saved !== null ? saved === "true" : true;
    } catch {
      return true;
    }
  });
  const [localDiags, setLocalDiags] = useState<LspDiagnostic[]>([]);

  // Setup Monaco on mount
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setEditorInstance(editor);
    registerVerilogLanguage(monaco);

    if (highlightLineSpan) {
      editor.revealLineInCenter(highlightLineSpan.lineStart);
      editor.setPosition({ lineNumber: highlightLineSpan.lineStart, column: 1 });
    }
  };

  const toggleKatana = () => {
    setKatanaEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("axiom_katana_cursor", String(next));
      } catch {}
      return next;
    });
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

  // Build clean de-cramped breadcrumb items (sources_1 > file.v)
  const breadcrumbItems: BreadcrumbItem[] = [
    { label: activeFile?.fileSet ?? t("editor.breadcrumbsSources"), highlight: false },
    { label: activeFile?.name ?? `${topModule}.v`, highlight: true }
  ];

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
        zIndex: isMaximized ? 90 : 1,
        fontFamily: "var(--font-sans)"
      }}
    >
      {/* Editor Multi-Tab Strip */}
      <div
        style={{
          height: 30,
          minHeight: 30,
          backgroundColor: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 8px",
          overflow: "hidden"
        }}
      >
        {/* Left: Open File Tabs */}
        <div style={{ display: "flex", alignItems: "center", gap: 3, overflowX: "auto", flex: 1, minWidth: 0 }}>
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
                    padding: "4px 9px",
                    borderRadius: "var(--radius-sm) var(--radius-sm) 0 0",
                    backgroundColor: isActive ? "var(--bg-primary)" : "transparent",
                    borderTop: isActive ? "2px solid var(--accent-blue)" : "2px solid transparent",
                    borderLeft: isActive ? "1px solid var(--border-subtle)" : "1px solid transparent",
                    borderRight: isActive ? "1px solid var(--border-subtle)" : "1px solid transparent",
                    cursor: "pointer",
                    userSelect: "none",
                    fontSize: 12,
                    color: isActive ? "#fff" : "var(--text-secondary)",
                    fontWeight: isActive ? 600 : 400,
                    maxWidth: 190,
                    minWidth: 70,
                    flexShrink: 0,
                    transition: "background-color 0.15s ease, color 0.15s ease"
                  }}
                >
                  {file.fileType === "xdc" ? (
                    <FileText size={13} color="var(--accent-purple)" style={{ flexShrink: 0 }} />
                  ) : (
                    <FileCode size={13} color={isTop ? "var(--accent-cyan)" : "var(--accent-blue)"} style={{ flexShrink: 0 }} />
                  )}

                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>
                    {file.name}
                  </span>

                  {isTop && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: "var(--accent-cyan)",
                        backgroundColor: "rgba(6, 182, 212, 0.15)",
                        border: "1px solid rgba(6, 182, 212, 0.3)",
                        padding: "0 4px",
                        borderRadius: 2,
                        flexShrink: 0
                      }}
                    >
                      {t("sidebar.topBadge")}
                    </span>
                  )}

                  {openFiles.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseTab?.(file.id);
                      }}
                      title={t("editor.closeTab")}
                      className="btn-icon"
                      style={{
                        padding: "1px 3px",
                        color: "var(--text-muted)",
                        borderRadius: 2,
                        marginLeft: 2,
                        backgroundColor: "transparent",
                        border: "none",
                        cursor: "pointer"
                      }}
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              );
            })
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 6px" }}>
              <Code2 size={13} color="var(--accent-cyan)" />
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
                {topModule}.v
              </span>
            </div>
          )}

          {onAddFileClick && (
            <button
              type="button"
              onClick={onAddFileClick}
              title={t("editor.addSourceFile")}
              className="btn-icon"
              style={{
                padding: "3px 5px",
                color: "var(--text-muted)",
                cursor: "pointer",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "transparent",
                border: "none",
                display: "flex",
                alignItems: "center"
              }}
            >
              <Plus size={14} />
            </button>
          )}
        </div>

        {/* Right: Actions Strip (Linter status, JIT Ready, Elaborate button, Maximize) */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: 6 }}>
          {/* Linter Diagnostic Pill */}
          <button
            type="button"
            onClick={onOpenProblems}
            title={t("dock.problems")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
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
                <span>{errorCount} {t("editor.lintErrors")}</span>
              </>
            ) : warningCount > 0 ? (
              <>
                <AlertTriangle size={11} />
                <span>{warningCount} {t("editor.lintWarnings")}</span>
              </>
            ) : (
              <>
                <CheckCircle size={11} />
                <span>{t("editor.lintClean")}</span>
              </>
            )}
          </button>

          {/* Katana Slash Cursor Toggle */}
          <button
            type="button"
            onClick={toggleKatana}
            title={katanaEnabled ? `${t.editor.katanaSlash} (${t.common.active})` : `${t.editor.katanaSlash} (${t.common.inactive})`}
            className="btn-icon"
            style={{
              padding: "3px 6px",
              color: katanaEnabled ? "#ffffff" : "var(--text-muted)",
              backgroundColor: katanaEnabled ? "rgba(255, 255, 255, 0.12)" : "transparent",
              border: katanaEnabled ? "1px solid rgba(255, 255, 255, 0.28)" : "1px solid transparent",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              boxShadow: katanaEnabled ? "0 0 8px rgba(255, 255, 255, 0.2)" : "none",
              transition: "all 0.15s ease"
            }}
          >
            <Swords size={13} />
          </button>

          {/* Elaborate Button (Componentized) */}
          <Button
            variant="primary"
            size="xs"
            onClick={onCompile}
            icon={<Play size={10} fill="#fff" />}
            title={t("header.compile")}
            style={{ padding: "3px 8px", fontSize: 11 }}
          >
            {t("editor.elaborate")}
          </Button>

          {onToggleMaximize && (
            <button
              type="button"
              onClick={onToggleMaximize}
              title={isMaximized ? t("editor.restoreSplit") : t("editor.maximizeEditor")}
              className="btn-icon"
              style={{
                padding: "3px 5px",
                color: "var(--text-muted)",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                backgroundColor: "transparent",
                border: "none",
                display: "flex",
                alignItems: "center"
              }}
            >
              {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          )}
        </div>
      </div>

      {/* De-Cramped Breadcrumbs Bar */}
      <Breadcrumbs
        items={breadcrumbItems}
        rightContent={
          <Badge color="cyan" size="sm">Rust JIT</Badge>
        }
      />

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
            fontSize: 14,
            lineHeight: 22,
            letterSpacing: 0.2,
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
            lineNumbersMinChars: 3,
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
            padding: { top: 8, bottom: 8 },
          }}
        />
        <KatanaCursorOverlay editor={editorInstance} enabled={katanaEnabled} />
      </div>
    </div>
  );
};
