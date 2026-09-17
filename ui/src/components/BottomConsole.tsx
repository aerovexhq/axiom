import React, { useState, useEffect, useRef } from "react";
import { Terminal, Download, Bug, Trash2 } from "lucide-react";
import { SimulationState, engineBridge } from "../engine/engineBridge";

interface BottomConsoleProps {
  state: SimulationState;
}

interface LogEntry {
  id: string;
  time: string;
  msg: string;
  level: "info" | "warn" | "error" | "event";
}

export const BottomConsole: React.FC<BottomConsoleProps> = ({ state }) => {
  const [activeTab, setActiveTab] = useState<"logs" | "glitches">("logs");
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: "1",
      time: new Date().toLocaleTimeString(),
      msg: "Betterado In-RAM JIT HDL Engine initialized. Ready to compile.",
      level: "info"
    }
  ]);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsub = engineBridge.subscribeLog((msg, level) => {
      setLogs((prev) => [
        ...prev.slice(-400),
        {
          id: Math.random().toString(36).substring(2, 9),
          time: new Date().toLocaleTimeString(),
          msg,
          level
        }
      ]);
    });
    return unsub;
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleExportVcd = () => {
    const vcd = engineBridge.exportVcd();
    const blob = new Blob([vcd], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.topModule}.vcd`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportSaif = () => {
    const saif = engineBridge.exportSaif();
    const blob = new Blob([saif], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.topModule}.saif`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      style={{
        height: 160,
        backgroundColor: "var(--bg-secondary)",
        borderTop: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0
      }}
    >
      {/* Console Tab Header */}
      <div
        style={{
          height: 30,
          backgroundColor: "var(--bg-primary)",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 10px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={() => setActiveTab("logs")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 8px",
              fontSize: 11,
              fontWeight: 600,
              color: activeTab === "logs" ? "var(--text-primary)" : "var(--text-muted)",
              borderBottom: activeTab === "logs" ? "2px solid var(--accent-blue)" : "2px solid transparent"
            }}
          >
            <Terminal size={12} />
            <span>Simulation Kernel Console</span>
          </button>

          <button
            onClick={() => setActiveTab("glitches")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 8px",
              fontSize: 11,
              fontWeight: 600,
              color: activeTab === "glitches" ? "var(--signal-glitch)" : "var(--text-muted)",
              borderBottom: activeTab === "glitches" ? "2px solid var(--signal-glitch)" : "2px solid transparent"
            }}
          >
            <Bug size={12} />
            <span>Glitches & Hazards ({state.glitches.length})</span>
          </button>
        </div>

        {/* Exporter Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={handleExportVcd}
            disabled={!state.compiled}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              padding: "2px 8px",
              backgroundColor: "var(--bg-tertiary)",
              color: "var(--text-primary)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-subtle)",
              opacity: state.compiled ? 1 : 0.5
            }}
            title="Export IEEE 1364 Value Change Dump (.vcd)"
          >
            <Download size={11} />
            <span>Export VCD</span>
          </button>

          <button
            onClick={handleExportSaif}
            disabled={!state.compiled}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              padding: "2px 8px",
              backgroundColor: "var(--bg-tertiary)",
              color: "var(--text-primary)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-subtle)",
              opacity: state.compiled ? 1 : 0.5
            }}
            title="Export SAIF 2.0 for Vivado read_saif"
          >
            <Download size={11} />
            <span>Export SAIF</span>
          </button>

          <button
            onClick={() => setLogs([])}
            title="Clear Console"
            style={{
              padding: "2px 6px",
              color: "var(--text-muted)",
              borderRadius: "var(--radius-sm)"
            }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      <div style={{ flex: 1, overflowY: "auto", padding: "6px 12px", fontFamily: "var(--font-mono)", fontSize: 11 }}>
        {activeTab === "logs" ? (
          <div>
            {logs.map((l) => (
              <div
                key={l.id}
                style={{
                  lineHeight: "18px",
                  color:
                    l.level === "error"
                      ? "var(--signal-x)"
                      : l.level === "warn"
                      ? "var(--accent-amber)"
                      : l.level === "event"
                      ? "var(--accent-cyan)"
                      : "var(--text-secondary)"
                }}
              >
                <span style={{ color: "var(--text-muted)", marginRight: 8 }}>[{l.time}]</span>
                <span>{l.msg}</span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        ) : (
          <div>
            {state.glitches.length === 0 ? (
              <div style={{ color: "var(--text-muted)", padding: 8 }}>
                No combinational hazards or delta-cycle glitches detected.
              </div>
            ) : (
              state.glitches.map((g, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "4px 0",
                    color: "var(--signal-glitch)",
                    borderBottom: "1px solid var(--border-subtle)"
                  }}
                >
                  <Bug size={13} />
                  <span>
                    t={g.timePs}ps (δ={g.delta}) — {g.message}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
