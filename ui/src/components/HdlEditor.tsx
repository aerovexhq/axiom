import React, { useRef, useEffect } from "react";
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
  ChevronRight
} from "lucide-react";
import { AxiomProject } from "../engine/projectModel";

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
  onToggleMaximize
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const lines = code.split("\n");

  useEffect(() => {
    if (highlightLineSpan && textareaRef.current) {
      const targetY = Math.max(0, (highlightLineSpan.lineStart - 3) * 20);
      textareaRef.current.scrollTo({ top: targetY, behavior: "smooth" });
      if (gutterRef.current) {
        gutterRef.current.scrollTo({ top: targetY, behavior: "smooth" });
      }
    }
  }, [highlightLineSpan]);

  // Determine active file info from project if available
  const activeFile = project?.files.find((f) => f.id === project.activeFileId);
  const openFiles = project
    ? project.openFileIds
        .map((id) => project.files.find((f) => f.id === id))
        .filter((f): f is NonNullable<typeof f> => !!f)
    : [];

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
                        marginLeft: 2
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
                borderRadius: "var(--radius-sm)"
              }}
            >
              <Plus size={13} />
            </button>
          )}
        </div>

        {/* Right: Actions (Compiled status, Elaborate, Maximize) */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8 }}>
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
              borderRadius: "var(--radius-sm)"
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
                cursor: "pointer"
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
      </div>

      {/* Code Text Area with Line Numbers */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
        {/* Line Numbers Gutter */}
        <div
          ref={gutterRef}
          style={{
            width: 44,
            backgroundColor: "var(--bg-secondary)",
            borderRight: "1px solid var(--border-subtle)",
            padding: "8px 6px",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--text-muted)",
            textAlign: "right",
            userSelect: "none",
            overflow: "hidden"
          }}
        >
          {lines.map((_, idx) => {
            const lineNum = idx + 1;
            const isHighlighted =
              highlightLineSpan &&
              lineNum >= highlightLineSpan.lineStart &&
              lineNum <= highlightLineSpan.lineEnd;
            return (
              <div
                key={idx}
                style={{
                  height: 20,
                  lineHeight: "20px",
                  color: isHighlighted ? "var(--accent-cyan)" : "inherit",
                  fontWeight: isHighlighted ? 700 : 400,
                  backgroundColor: isHighlighted ? "rgba(56, 189, 248, 0.15)" : "transparent",
                  borderRadius: 2
                }}
              >
                {lineNum}
              </div>
            );
          })}
        </div>

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          value={code}
          onChange={(e) => onChangeCode(e.target.value)}
          spellCheck={false}
          style={{
            flex: 1,
            height: "100%",
            backgroundColor: "transparent",
            color: "var(--text-primary)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            lineHeight: "20px",
            padding: "8px 12px",
            border: "none",
            resize: "none",
            outline: "none",
            whiteSpace: "pre",
            overflowWrap: "normal",
            overflowX: "auto"
          }}
        />
      </div>
    </div>
  );
};
