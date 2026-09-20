import React, { useState } from "react";
import { X, Database, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { RegisterFileMacro } from "../../engine/microarchModel";
import { MicroarchRadix, formatRadix } from "./AluInspectorModal";

interface RegFileModalProps {
  regFile: RegisterFileMacro;
  macroLabel: string;
  registerValues?: number[];
  readPortAAddr?: number;
  readPortBAddr?: number;
  writePortAddr?: number;
  writeEnable?: boolean;
  onClose: () => void;
}

// Standard RISC-V ABI register aliases
const RISCV_ABI_NAMES = ["zero", "ra", "sp", "gp", "tp", "t0", "t1", "t2", "s0/fp", "s1", "a0", "a1", "a2", "a3", "a4", "a5"];

export const RegFileModal: React.FC<RegFileModalProps> = ({
  regFile,
  macroLabel,
  registerValues,
  readPortAAddr = 1,
  readPortBAddr = 2,
  writePortAddr = 3,
  writeEnable = true,
  onClose
}) => {
  const [radix, setRadix] = useState<MicroarchRadix>("hex");

  // Sample default register state if none provided
  const depth = regFile.depth || 8;
  const defaultValues: number[] = [0, 0x1000, 0x7ffffff0, 0x00000004, 0x0000000a, 0x0000002a, 0x00000000, 0x000000ff];
  const currentValues = registerValues || Array.from({ length: depth }, (_, i) => defaultValues[i % defaultValues.length]);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "90%",
          maxWidth: 800,
          maxHeight: "90vh",
          backgroundColor: "var(--bg-primary)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 18px",
            backgroundColor: "var(--bg-secondary)",
            borderBottom: "1px solid var(--border-subtle)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Database size={20} color="#8b5cf6" />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>
                {macroLabel} — Multi-Port Register File Matrix
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Capacity: <strong style={{ color: "var(--text-primary)" }}>{regFile.depth} words</strong> ×{" "}
                <strong style={{ color: "var(--text-primary)" }}>{regFile.word_width}-bit</strong> ({regFile.depth * regFile.word_width} bits total) |{" "}
                Read Ports: <span style={{ color: "var(--accent-cyan)" }}>{regFile.read_ports.length}</span> | Write Ports:{" "}
                <span style={{ color: "#f59e0b" }}>{regFile.write_ports.length}</span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Radix Selector */}
            <div
              style={{
                display: "flex",
                backgroundColor: "var(--bg-tertiary)",
                borderRadius: 4,
                padding: 2,
                border: "1px solid var(--border-subtle)"
              }}
            >
              {(["hex", "dec", "bin"] as MicroarchRadix[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRadix(r)}
                  style={{
                    padding: "2px 8px",
                    fontSize: 10.5,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    borderRadius: 3,
                    border: "none",
                    background: radix === r ? "var(--accent-primary, #3b82f6)" : "transparent",
                    color: radix === r ? "#ffffff" : "var(--text-muted)",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: 4
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Port Status Ribbon */}
        <div
          style={{
            padding: "12px 18px",
            backgroundColor: "#0c1017",
            borderBottom: "1px solid var(--border-subtle)",
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12
          }}
        >
          {/* Read Port 1 */}
          <div
            style={{
              padding: "8px 12px",
              backgroundColor: "rgba(56, 189, 248, 0.06)",
              border: "1px solid rgba(56, 189, 248, 0.25)",
              borderRadius: 6
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "#38bdf8", fontWeight: 600 }}>
              <ArrowDownRight size={13} />
              <span>Read Port 1 (rs1)</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Addr: x{readPortAAddr}</span>
              <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#38bdf8" }}>
                {formatRadix(currentValues[readPortAAddr] || 0, regFile.word_width, radix)}
              </span>
            </div>
          </div>

          {/* Read Port 2 */}
          <div
            style={{
              padding: "8px 12px",
              backgroundColor: "rgba(168, 85, 247, 0.06)",
              border: "1px solid rgba(168, 85, 247, 0.25)",
              borderRadius: 6
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "#c084fc", fontWeight: 600 }}>
              <ArrowDownRight size={13} />
              <span>Read Port 2 (rs2)</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Addr: x{readPortBAddr}</span>
              <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#c084fc" }}>
                {formatRadix(currentValues[readPortBAddr] || 0, regFile.word_width, radix)}
              </span>
            </div>
          </div>

          {/* Write Port */}
          <div
            style={{
              padding: "8px 12px",
              backgroundColor: writeEnable ? "rgba(245, 158, 11, 0.08)" : "rgba(255, 255, 255, 0.02)",
              border: `1px solid ${writeEnable ? "rgba(245, 158, 11, 0.3)" : "var(--border-subtle)"}`,
              borderRadius: 6
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: writeEnable ? "#f59e0b" : "var(--text-muted)", fontWeight: 600 }}>
              <ArrowUpRight size={13} />
              <span>Write Port (rd) {writeEnable ? "• ENABLED" : "• DISABLED"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Addr: x{writePortAddr}</span>
              <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: writeEnable ? "#f59e0b" : "var(--text-muted)" }}>
                {formatRadix(currentValues[writePortAddr] || 0, regFile.word_width, radix)}
              </span>
            </div>
          </div>
        </div>

        {/* Register Table */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-subtle)", color: "var(--text-muted)", fontSize: 10.5, textTransform: "uppercase" }}>
                <th style={{ padding: "6px 12px", width: 80 }}>Register</th>
                <th style={{ padding: "6px 12px", width: 90 }}>ABI Name</th>
                <th style={{ padding: "6px 12px" }}>Current Stored Value ({radix.toUpperCase()})</th>
                <th style={{ padding: "6px 12px", width: 140 }}>Port Activity</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: depth }).map((_, idx) => {
                const val = currentValues[idx] ?? 0;
                const isReadA = idx === readPortAAddr;
                const isReadB = idx === readPortBAddr;
                const isWrite = idx === writePortAddr && writeEnable;

                let rowBg = "transparent";
                if (isWrite) rowBg = "rgba(245, 158, 11, 0.1)";
                else if (isReadA && isReadB) rowBg = "rgba(168, 85, 247, 0.1)";
                else if (isReadA) rowBg = "rgba(56, 189, 248, 0.08)";
                else if (isReadB) rowBg = "rgba(168, 85, 247, 0.08)";

                return (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: "1px solid var(--border-subtle)",
                      backgroundColor: rowBg,
                      transition: "background-color 0.15s ease"
                    }}
                  >
                    <td style={{ padding: "8px 12px", fontFamily: "monospace", fontWeight: 600, color: "var(--text-primary)" }}>
                      x{idx}
                    </td>
                    <td style={{ padding: "8px 12px", color: "var(--text-secondary)" }}>
                      {RISCV_ABI_NAMES[idx] || `r${idx}`}
                    </td>
                    <td style={{ padding: "8px 12px", fontFamily: "monospace", fontWeight: 700, color: isWrite ? "#f59e0b" : isReadA || isReadB ? "#38bdf8" : "var(--text-primary)" }}>
                      {formatRadix(val, regFile.word_width, radix)}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {isReadA && (
                          <span style={{ fontSize: 9.5, padding: "2px 6px", borderRadius: 3, backgroundColor: "rgba(56, 189, 248, 0.2)", color: "#38bdf8", fontWeight: 700 }}>
                            READ 1
                          </span>
                        )}
                        {isReadB && (
                          <span style={{ fontSize: 9.5, padding: "2px 6px", borderRadius: 3, backgroundColor: "rgba(168, 85, 247, 0.2)", color: "#c084fc", fontWeight: 700 }}>
                            READ 2
                          </span>
                        )}
                        {isWrite && (
                          <span style={{ fontSize: 9.5, padding: "2px 6px", borderRadius: 3, backgroundColor: "rgba(245, 158, 11, 0.25)", color: "#f59e0b", fontWeight: 700 }}>
                            WRITE
                          </span>
                        )}
                        {!isReadA && !isReadB && !isWrite && (
                          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "10px 18px",
            backgroundColor: "var(--bg-secondary)",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 11.5,
            color: "var(--text-muted)"
          }}
        >
          <div>Synchronous write on clock posedge; dual asynchronous read ports.</div>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: "4px 12px", fontSize: 11.5 }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
