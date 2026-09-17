import React from "react";
import { Code2, Play, CheckCircle2 } from "lucide-react";

interface HdlEditorProps {
  code: string;
  topModule: string;
  onChangeCode: (code: string) => void;
  onCompile: () => void;
  compiled: boolean;
}

export const HdlEditor: React.FC<HdlEditorProps> = ({
  code,
  topModule,
  onChangeCode,
  onCompile,
  compiled
}) => {
  const lines = code.split("\n");

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--bg-primary)",
        borderRight: "1px solid var(--border-subtle)",
        overflow: "hidden"
      }}
    >
      {/* Editor Tab Bar */}
      <div
        style={{
          height: 32,
          backgroundColor: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 10px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Code2 size={14} color="var(--accent-cyan)" />
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
            {topModule}.v
          </span>
          {compiled && (
            <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "var(--accent-emerald)", marginLeft: 6 }}>
              <CheckCircle2 size={12} />
              <span>JIT Compiled</span>
            </span>
          )}
        </div>

        <button
          onClick={onCompile}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            fontWeight: 600,
            padding: "2px 8px",
            backgroundColor: "var(--accent-blue)",
            color: "#fff",
            borderRadius: "var(--radius-sm)"
          }}
        >
          <Play size={11} fill="#fff" />
          <span>Elaborate</span>
        </button>
      </div>

      {/* Code Text Area with Line Numbers */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
        {/* Line Numbers Gutter */}
        <div
          style={{
            width: 44,
            backgroundColor: "var(--bg-secondary)",
            borderRight: "1px solid var(--border-subtle)",
            padding: "10px 6px",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--text-muted)",
            textAlign: "right",
            userSelect: "none",
            overflow: "hidden"
          }}
        >
          {lines.map((_, idx) => (
            <div key={idx} style={{ height: 20, lineHeight: "20px" }}>
              {idx + 1}
            </div>
          ))}
        </div>

        {/* Text Area */}
        <textarea
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
            padding: "10px 12px",
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
