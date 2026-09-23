import React, { useRef, useEffect, useState } from "react";
import Editor, { OnMount, loader } from "@monaco-editor/react";
import * as monacoPkg from "monaco-editor";
import {
  Code2,
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
  BarChart2,
  Zap,
  Settings,
  MoreVertical,
  Check
} from "lucide-react";
import { AxiomProject } from "../engine/projectModel";
import { engineBridge, LspDiagnostic, CoverageReport } from "../engine/engineBridge";
import { registerVerilogLanguage } from "../engine/monacoVerilog";
import { registerXdcLanguage } from "../engine/monacoXdc";
import { registerVhdlLanguage } from "../engine/monacoVhdl";
import { registerMemLanguage } from "../engine/monacoMem";
import { Breadcrumbs, BreadcrumbItem, Badge } from "./ui";
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
  onOpenSettings?: (category?: "general" | "editor" | "simulation" | "security") => void;
  isDirty?: boolean;
}

export const HdlEditor: React.FC<HdlEditorProps> = ({
  code,
  topModule,
  onChangeCode,
  onCompile: _onCompile,
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
  predictedFmaxGainMhz,
  onOpenSettings,
  isDirty = false
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
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    return typeof window !== "undefined" ? window.innerWidth <= 768 : false;
  });
  const [keyboardInset, setKeyboardInset] = useState<number>(0);
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOverflowOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setIsOverflowOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [isOverflowOpen]);

  // Dynamic Visual Viewport tracking for mobile virtual keyboard
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const updateViewport = () => {
      const inset = Math.max(0, window.innerHeight - vv.height);
      setKeyboardInset(inset);
      if (editorRef.current) {
        editorRef.current.layout();
        if (inset > 100) {
          const pos = editorRef.current.getPosition();
          if (pos) {
            setTimeout(() => {
              editorRef.current?.revealPositionInCenter(pos, monacoPkg.editor.ScrollType.Smooth);
            }, 60);
          }
        }
      }
    };
    vv.addEventListener("resize", updateViewport);
    vv.addEventListener("scroll", updateViewport);
    return () => {
      vv.removeEventListener("resize", updateViewport);
      vv.removeEventListener("scroll", updateViewport);
    };
  }, []);

  // Sync settings when modified from ProjectSettingsModal
  useEffect(() => {
    const handleSettingsChanged = () => {
      try {
        const savedKatana = localStorage.getItem("axiom_katana_cursor");
        setKatanaEnabled(savedKatana !== null ? savedKatana === "true" : true);

        if (editorRef.current) {
          const showMinimap = localStorage.getItem("axiom_editor_minimap") === "true";
          const showLineNumbers = localStorage.getItem("axiom_editor_line_numbers") !== "false";
          const doWordWrap = localStorage.getItem("axiom_editor_word_wrap") === "true";
          editorRef.current.updateOptions({
            minimap: { enabled: showMinimap },
            lineNumbers: showLineNumbers ? "on" : "off",
            wordWrap: doWordWrap ? "on" : "off"
          });
        }
      } catch {}
    };

    window.addEventListener("axiom-settings-changed", handleSettingsChanged);
    window.addEventListener("storage", handleSettingsChanged);
    return () => {
      window.removeEventListener("axiom-settings-changed", handleSettingsChanged);
      window.removeEventListener("storage", handleSettingsChanged);
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
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

    try {
      const showMinimap = localStorage.getItem("axiom_editor_minimap") === "true";
      const showLineNumbers = localStorage.getItem("axiom_editor_line_numbers") !== "false";
      const doWordWrap = localStorage.getItem("axiom_editor_word_wrap") === "true";
      editor.updateOptions({
        minimap: { enabled: showMinimap },
        lineNumbers: showLineNumbers ? "on" : "off",
        wordWrap: doWordWrap ? "on" : "off"
      });
    } catch {}

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

    // Cursor centering on tap / focus / mobile typing
    editor.onDidChangeCursorPosition((e) => {
      if (isMobile || keyboardInset > 100) {
        editor.revealPositionInCenter(e.position, monacoPkg.editor.ScrollType.Smooth);
      }
    });

    editor.onDidFocusEditorText(() => {
      const pos = editor.getPosition();
      if (pos && (isMobile || keyboardInset > 100)) {
        setTimeout(() => {
          editor.revealPositionInCenter(pos, monacoPkg.editor.ScrollType.Smooth);
        }, 50);
      }
    });

    // Initial live static analysis lint pass on mount
    if (code) {
      engineBridge.lint(code, editorLanguage).then((diags) => {
        setLocalDiags(diags);
        onDiagnosticsChange?.(diags);
        const model = editor.getModel();
        if (model) {
          const markers: monacoPkg.editor.IMarkerData[] = diags.map((d) => ({
            startLineNumber: d.startLineNumber,
            startColumn: d.startColumn,
            endLineNumber: d.endLineNumber,
            endColumn: d.endColumn,
            message: `${d.message}${d.help ? `\n↳ ${d.help}` : ""}`,
            severity:
              d.severity === 1
                ? monaco.MarkerSeverity.Error
                : d.severity === 2
                ? monaco.MarkerSeverity.Warning
                : d.severity === 3
                ? monaco.MarkerSeverity.Info
                : monaco.MarkerSeverity.Hint,
            source: d.source || (isXdc ? "axiom-xdc-linter" : isVhdl ? "axiom-vhdl-linter" : isMem ? "axiom-mem-linter" : "axiom-linter"),
            code: d.code,
          }));
          monaco.editor.setModelMarkers(model, "axiom-linter", markers);
        }
      }).catch(() => {});
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
    }, 80);

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
        <div style={{ display: "flex", alignItems: "center", gap: 3, overflowX: "auto", scrollbarWidth: "none", flex: 1, minWidth: 0 }}>
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

                  {/* Dirty Dot Indicator */}
                  {((isActive && isDirty) || (file as any).isModified) && (
                    <span
                      title={t("editor.dirtyFileTooltip")}
                      style={{
                        fontSize: 9,
                        color: "var(--accent-cyan)",
                        lineHeight: 1,
                        marginLeft: 1,
                        flexShrink: 0
                      }}
                    >
                      ●
                    </span>
                  )}

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

          {openFiles.length > 6 && (
            <div ref={overflowRef} style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setIsOverflowOpen(!isOverflowOpen)}
                title={t("editor.moreFiles")}
                className="btn-icon"
                style={{
                  padding: "3px 4px",
                  color: isOverflowOpen ? "var(--accent-cyan)" : "var(--text-muted)",
                  cursor: "pointer",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: isOverflowOpen ? "var(--bg-tertiary)" : "transparent",
                  border: "none",
                  display: "flex",
                  alignItems: "center"
                }}
              >
                <MoreVertical size={13} />
              </button>

              {isOverflowOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    zIndex: 100,
                    backgroundColor: "var(--bg-secondary)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-md)",
                    boxShadow: "0 6px 16px rgba(0, 0, 0, 0.45)",
                    padding: "4px 0",
                    minWidth: 170,
                    maxWidth: 240,
                    marginTop: 2
                  }}
                >
                  <div
                    style={{
                      padding: "3px 8px 5px",
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "var(--text-muted)",
                      borderBottom: "1px solid var(--border-subtle)"
                    }}
                  >
                    {t("editor.moreFiles")} ({openFiles.length})
                  </div>
                  <div style={{ maxHeight: 200, overflowY: "auto" }}>
                    {openFiles.map((f) => {
                      const isAct = f.id === project?.activeFileId;
                      const isMod = (isAct && isDirty) || (f as any).isModified;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => {
                            onSelectTab?.(f.id);
                            setIsOverflowOpen(false);
                          }}
                          style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "5px 8px",
                            backgroundColor: isAct ? "rgba(6, 182, 212, 0.12)" : "transparent",
                            color: isAct ? "#fff" : "var(--text-secondary)",
                            border: "none",
                            cursor: "pointer",
                            fontSize: 11.5,
                            textAlign: "left"
                          }}
                          onMouseEnter={(e) => {
                            if (!isAct) e.currentTarget.style.backgroundColor = "var(--bg-tertiary)";
                          }}
                          onMouseLeave={(e) => {
                            if (!isAct) e.currentTarget.style.backgroundColor = "transparent";
                          }}
                        >
                          <FileCode size={12} color={isAct ? "var(--accent-cyan)" : "var(--text-muted)"} style={{ flexShrink: 0 }} />
                          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {f.name}
                          </span>
                          {isMod && (
                            <span style={{ fontSize: 8, color: "var(--accent-cyan)" }}>●</span>
                          )}
                          {isAct && <Check size={11} color="var(--accent-cyan)" style={{ flexShrink: 0 }} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
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
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 3 : 6, flexShrink: 0, marginLeft: 6 }}>
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
                padding: isMobile ? "2px 5px" : "2px 8px",
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
              <span>{isMobile ? "Pipe" : `Auto-Pipeline${predictedFmaxGainMhz ? `: +${Math.round(predictedFmaxGainMhz)} MHz` : ""}`}</span>
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
              gap: 3,
              fontSize: 11,
              fontWeight: 600,
              padding: isMobile ? "2px 5px" : "2px 7px",
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
                <span>{errorCount}{!isMobile ? ` ${t("editor.lintErrors")}` : ""}</span>
              </>
            ) : warningCount > 0 ? (
              <>
                <AlertTriangle size={11} />
                <span>{warningCount}{!isMobile ? ` ${t("editor.lintWarnings")}` : ""}</span>
              </>
            ) : (
              <>
                <CheckCircle size={11} />
                {!isMobile && <span>{t("editor.lintClean")}</span>}
              </>
            )}
          </button>

          {/* Editor & Project Settings */}
          {onOpenSettings && (
            <button
              type="button"
              onClick={() => onOpenSettings("editor")}
              title={t("editor.settingsTooltip")}
              className="btn-icon"
              style={{
                padding: "3px 6px",
                color: "var(--text-muted)",
                backgroundColor: "transparent",
                border: "1px solid transparent",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                transition: "all 0.15s ease"
              }}
            >
              <Settings size={13} />
            </button>
          )}

          {!isMobile && onToggleMaximize && (
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
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {/* RTL Code Coverage Heatmap Toggle */}
            {!isXdc && !isMobile && (
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
                    : t("editor.coverageButton")}
                </span>
              </button>
            )}

            {/* Non-Verilog Format Badges (XDC, VHDL, MEM) - "Rust JIT" is REMOVED */}
            {(isXdc || isVhdl || isMem) && (
              <Badge
                color={isXdc ? "purple" : isVhdl ? "emerald" : "amber"}
                size="sm"
              >
                {isXdc ? "Vivado XDC" : isVhdl ? "VHDL (IEEE 1076)" : "Memory Init"}
              </Badge>
            )}
          </div>
        }
      />

      {/* Monaco Code Editor */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <Editor
          height="100%"
          language={editorLanguage}
          theme="axiom-dark"
          path={activeFile ? `axiom://${project?.id || "prj"}/${activeFile.id}/${activeFile.name}` : undefined}
          saveViewState={true}
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
            scrollBeyondLastLine: true,
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
            padding: {
              top: 8,
              bottom: isMobile ? (keyboardInset > 0 ? 160 : 260) : 8
            },
          }}
        />
        <KatanaCursorOverlay editor={editorInstance} enabled={katanaEnabled} />
      </div>
    </div>
  );
};
