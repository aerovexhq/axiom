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
  Database,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Swords,
  BarChart2,
  Zap
} from "lucide-react";
import { AxiomProject } from "../engine/projectModel";
import { engineBridge, LspDiagnostic, CoverageReport } from "../engine/engineBridge";
import { registerVerilogLanguage } from "../engine/monacoVerilog";
import { registerXdcLanguage } from "../engine/monacoXdc";
import { registerVhdlLanguage } from "../engine/monacoVhdl";
import { registerMemLanguage } from "../engine/monacoMem";
import { toast } from "../engine/toast";
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
  onOpenAutoPipeline?: () => void;
  timingSlackPs?: number | null;
  predictedFmaxGainMhz?: number | null;
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
  onOpenProblems,
  onOpenAutoPipeline,
  timingSlackPs,
  predictedFmaxGainMhz
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
  const [coverageEnabled, setCoverageEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("axiom_coverage_heatmap");
      return saved === "true";
    } catch {
      return false;
    }
  });
  const [coverageReport, setCoverageReport] = useState<CoverageReport | null>(null);
  const coverageDecorationsRef = useRef<string[]>([]);

  const toggleCoverage = () => {
    setCoverageEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("axiom_coverage_heatmap", String(next));
      } catch {}
      return next;
    });
  };

  // Per-file Monaco ViewState & Scroll Cache
  const viewStatesRef = useRef<Map<string, monacoPkg.editor.ICodeEditorViewState>>(new Map());
  const activeFileIdRef = useRef<string | null>(null);
  const saveScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Determine active file info from project if available
  const activeFile = project?.files.find((f) => f.id === project.activeFileId);
  const fileName = activeFile?.name ?? "";
  const isXdc = activeFile?.fileType === "xdc" || fileName.endsWith(".xdc") || fileName.endsWith(".sdc");
  const isVhdl = activeFile?.fileType === "vhdl" || fileName.endsWith(".vhd") || fileName.endsWith(".vhdl");
  const isMem = activeFile?.fileType === "mem" || fileName.endsWith(".mem") || fileName.endsWith(".hex") || fileName.endsWith(".coe");
  const editorLanguage = isXdc ? "xdc" : isVhdl ? "vhdl" : isMem ? "mem" : "verilog";

  // Setup Monaco on mount
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setEditorInstance(editor);
    registerVerilogLanguage(monaco);
    registerXdcLanguage(monaco);
    registerVhdlLanguage(monaco);
    registerMemLanguage(monaco);

    if (highlightLineSpan) {
      editor.revealLineInCenter(highlightLineSpan.lineStart);
      editor.setPosition({ lineNumber: highlightLineSpan.lineStart, column: 1 });
    } else if (activeFile?.id) {
      activeFileIdRef.current = activeFile.id;
      try {
        const saved = localStorage.getItem(`axiom_file_scroll_${activeFile.id}`);
        if (saved) {
          const { top, left, line, col } = JSON.parse(saved);
          if (typeof top === "number") editor.setScrollTop(top);
          if (typeof left === "number") editor.setScrollLeft(left);
          if (typeof line === "number" && typeof col === "number") {
            editor.setPosition({ lineNumber: line, column: col });
          }
        }
      } catch {}
    }

    // Debounced scroll listener to persist scroll position
    editor.onDidScrollChange(() => {
      if (saveScrollTimerRef.current) clearTimeout(saveScrollTimerRef.current);
      saveScrollTimerRef.current = setTimeout(() => {
        const fid = activeFileIdRef.current;
        if (!fid || !editorRef.current) return;
        try {
          const pos = editorRef.current.getPosition();
          const scrollState = {
            top: editorRef.current.getScrollTop(),
            left: editorRef.current.getScrollLeft(),
            line: pos?.lineNumber ?? 1,
            col: pos?.column ?? 1
          };
          localStorage.setItem(`axiom_file_scroll_${fid}`, JSON.stringify(scrollState));
        } catch {}
      }, 250);
    });
  };

  // Handle tab switching: save view state of old tab, restore view state/scroll of new tab
  useEffect(() => {
    const editor = editorRef.current;
    const currentFileId = activeFile?.id ?? null;
    const prevFileId = activeFileIdRef.current;

    if (editor && prevFileId && prevFileId !== currentFileId) {
      const vs = editor.saveViewState();
      if (vs) {
        viewStatesRef.current.set(prevFileId, vs);
      }
      try {
        const pos = editor.getPosition();
        const scrollState = {
          top: editor.getScrollTop(),
          left: editor.getScrollLeft(),
          line: pos?.lineNumber ?? 1,
          col: pos?.column ?? 1
        };
        localStorage.setItem(`axiom_file_scroll_${prevFileId}`, JSON.stringify(scrollState));
      } catch {}
    }

    activeFileIdRef.current = currentFileId;

    if (editor && currentFileId) {
      requestAnimationFrame(() => {
        if (viewStatesRef.current.has(currentFileId)) {
          editor.restoreViewState(viewStatesRef.current.get(currentFileId)!);
        } else {
          try {
            const saved = localStorage.getItem(`axiom_file_scroll_${currentFileId}`);
            if (saved) {
              const { top, left, line, col } = JSON.parse(saved);
              if (typeof top === "number") editor.setScrollTop(top);
              if (typeof left === "number") editor.setScrollLeft(left);
              if (typeof line === "number" && typeof col === "number") {
                editor.setPosition({ lineNumber: line, column: col });
              }
            }
          } catch {}
        }
      });
    }
  }, [activeFile?.id]);

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
        const diags = await engineBridge.lint(code, editorLanguage);
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
              source: d.source || (isXdc ? "axiom-xdc-linter" : isVhdl ? "axiom-vhdl-linter" : isMem ? "axiom-mem-linter" : "axiom-linter"),
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
  }, [code, editorLanguage, onDiagnosticsChange]);

  // Jump to highlightLineSpan when updated
  useEffect(() => {
    if (highlightLineSpan && editorRef.current) {
      editorRef.current.revealLineInCenter(highlightLineSpan.lineStart);
      editorRef.current.setPosition({ lineNumber: highlightLineSpan.lineStart, column: 1 });
      editorRef.current.focus();
    }
  }, [highlightLineSpan]);

  // Live In-Editor RTL Code Coverage Heatmap Decorations
  useEffect(() => {
    let cancelled = false;

    const updateCoverage = async () => {
      if (!coverageEnabled || isXdc) {
        if (editorRef.current) {
          coverageDecorationsRef.current = editorRef.current.deltaDecorations(
            coverageDecorationsRef.current,
            []
          );
        }
        return;
      }

      try {
        const report = await engineBridge.getCoverage();
        if (cancelled) return;
        setCoverageReport(report);

        if (!editorRef.current || !monacoRef.current) return;
        const model = editorRef.current.getModel();
        if (!model) return;

        if (report && Array.isArray(report.lines) && report.lines.length > 0) {
          const decors: monacoPkg.editor.IModelDeltaDecoration[] = [];
          for (const lineInfo of report.lines) {
            // Non-executable lines (comments, module ports, blank lines) must never be decorated
            if (lineInfo.status === "NonExecutable") continue;

            let glyphClass = "axiom-cov-glyph-dead";
            let lineClass = "axiom-cov-line-dead";
            let desc = "Uncovered (0 executions)";

            if (lineInfo.status === "Covered") {
              glyphClass = "axiom-cov-glyph-full";
              lineClass = "axiom-cov-line-full";
              desc = `Covered: ${lineInfo.hits.toLocaleString()} executions`;
            } else if (lineInfo.status === "Partial") {
              glyphClass = "axiom-cov-glyph-partial";
              lineClass = "axiom-cov-line-partial";
              desc = `Branch Partial: True=${lineInfo.branch_true ?? 0}, False=${lineInfo.branch_false ?? 0} (Total: ${lineInfo.hits})`;
            } else if (lineInfo.status === "Uncovered") {
              glyphClass = "axiom-cov-glyph-dead";
              lineClass = "axiom-cov-line-dead";
              desc = "Uncovered (0 executions)";
            } else {
              continue;
            }

            decors.push({
              range: new monacoRef.current!.Range(lineInfo.line, 1, lineInfo.line, 1),
              options: {
                isWholeLine: true,
                glyphMarginClassName: glyphClass,
                className: lineClass,
                hoverMessage: {
                  value: `**Axiom RTL Coverage**: ${desc}\n- **Line**: ${lineInfo.line}${
                    lineInfo.snippet ? `\n\`\`\`verilog\n${lineInfo.snippet}\n\`\`\`` : ""
                  }`
                }
              }
            });
          }

          coverageDecorationsRef.current = editorRef.current.deltaDecorations(
            coverageDecorationsRef.current,
            decors
          );
        } else if (editorRef.current) {
          coverageDecorationsRef.current = editorRef.current.deltaDecorations(
            coverageDecorationsRef.current,
            []
          );
        }
      } catch (err) {
        console.warn("Failed to query RTL coverage:", err);
      }
    };

    updateCoverage();
    const unsub = engineBridge.subscribe(() => {
      updateCoverage();
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [coverageEnabled, isXdc, code]);

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
                  {file.fileType === "xdc" || file.name.endsWith(".xdc") || file.name.endsWith(".sdc") ? (
                    <FileText size={13} color="var(--accent-purple)" style={{ flexShrink: 0 }} />
                  ) : file.fileType === "vhdl" || file.name.endsWith(".vhd") || file.name.endsWith(".vhdl") ? (
                    <FileCode size={13} color="#10b981" style={{ flexShrink: 0 }} />
                  ) : file.fileType === "mem" || file.name.endsWith(".mem") || file.name.endsWith(".hex") || file.name.endsWith(".coe") ? (
                    <Database size={13} color="#f59e0b" style={{ flexShrink: 0 }} />
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
          {/* Silicon Copilot Auto-Pipeline Recommendation Pill */}
          {timingSlackPs !== undefined && timingSlackPs !== null && timingSlackPs < 0 && onOpenAutoPipeline && (
            <button
              type="button"
              onClick={onOpenAutoPipeline}
              title={`Silicon Copilot: Setup timing violation (${timingSlackPs} ps). Click to auto-pipeline.`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "rgba(244, 63, 94, 0.18)",
                border: "1px solid rgba(244, 63, 94, 0.5)",
                color: "#f43f5e",
                cursor: "pointer",
                transition: "all 0.15s ease",
                boxShadow: "0 0 10px rgba(244, 63, 94, 0.2)"
              }}
            >
              <Zap size={11} color="#f43f5e" />
              <span>Auto-Pipeline{predictedFmaxGainMhz ? `: +${Math.round(predictedFmaxGainMhz)} MHz` : ""}</span>
            </button>
          )}

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

          {/* RTL Code Coverage Heatmap Toggle */}
          {!isXdc && (
            <button
              type="button"
              onClick={toggleCoverage}
              title={
                coverageEnabled
                  ? `RTL Coverage Heatmap: ON (${coverageReport ? coverageReport.overall_pct.toFixed(0) : 0}% overall coverage)`
                  : "RTL Coverage Heatmap: OFF (Click to enable)"
              }
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 7px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: coverageEnabled ? "rgba(16, 185, 129, 0.15)" : "transparent",
                border: coverageEnabled ? "1px solid rgba(16, 185, 129, 0.35)" : "1px solid var(--border-subtle)",
                color: coverageEnabled ? "var(--accent-emerald)" : "var(--text-muted)",
                cursor: "pointer",
                transition: "all 0.15s ease"
              }}
            >
              <BarChart2 size={11} />
              <span>
                {coverageEnabled && coverageReport
                  ? `${coverageReport.overall_pct.toFixed(0)}% Cov`
                  : "Coverage"}
              </span>
            </button>
          )}

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

          {/* Elaborate or Check Action Button */}
          <Button
            variant="primary"
            size="xs"
            onClick={async () => {
              if (isXdc) {
                const diags = await engineBridge.lintXdc(code);
                const errors = diags.filter((d) => d.severity === 1);
                if (errors.length === 0) {
                  toast.success("Vivado XDC constraints verified: 0 errors");
                } else {
                  toast.error(`XDC Validation: ${errors.length} error(s) found`);
                }
              } else if (isVhdl) {
                const diags = await engineBridge.lintVhdl(code);
                const errors = diags.filter((d) => d.severity === 1);
                if (errors.length === 0) {
                  toast.success("VHDL module verified: 0 errors");
                } else {
                  toast.error(`VHDL Validation: ${errors.length} error(s) found`);
                }
              } else if (isMem) {
                const diags = await engineBridge.lintMem(code, activeFile?.name);
                const errors = diags.filter((d) => d.severity === 1);
                if (errors.length === 0) {
                  toast.success("Memory vectors verified: 0 errors");
                } else {
                  toast.error(`Memory File Validation: ${errors.length} error(s) found`);
                }
              } else {
                onCompile();
              }
            }}
            icon={<Play size={10} fill="#fff" />}
            title={isXdc ? "Validate Constraints" : isVhdl ? "Validate VHDL" : isMem ? "Validate Memory File" : t("header.compile")}
            style={{ padding: "3px 8px", fontSize: 11 }}
          >
            {isXdc ? "Check XDC" : isVhdl ? "Check VHDL" : isMem ? "Validate MEM" : t("editor.elaborate")}
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
          <Badge
            color={isXdc ? "purple" : isVhdl ? "emerald" : isMem ? "amber" : "cyan"}
            size="sm"
          >
            {isXdc ? "Vivado XDC" : isVhdl ? "VHDL (IEEE 1076)" : isMem ? "Memory Init" : "Rust JIT"}
          </Badge>
        }
      />

      {/* Monaco Code Editor */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <Editor
          height="100%"
          language={editorLanguage}
          theme="axiom-dark"
          value={code}
          onChange={(val) => onChangeCode(val ?? "")}
          beforeMount={(monaco) => {
            registerVerilogLanguage(monaco);
            registerXdcLanguage(monaco);
            registerVhdlLanguage(monaco);
            registerMemLanguage(monaco);
          }}
          onMount={handleEditorDidMount}
          options={{
            fontFamily: "var(--font-mono), 'JetBrains Mono', 'Fira Code', monospace",
            fontSize: 14,
            lineHeight: 22,
            letterSpacing: 0.2,
            glyphMargin: true,
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
