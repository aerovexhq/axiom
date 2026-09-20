import React, { useState } from "react";
import { X, Cpu, CheckCircle2, Circle } from "lucide-react";
import { AluMacro, AluOperation, AluFlag } from "../../engine/microarchModel";

export type MicroarchRadix = "hex" | "dec" | "bin";

interface AluInspectorModalProps {
  alu: AluMacro;
  macroLabel: string;
  currentOpcode?: number;
  operandAValue?: number | string;
  operandBValue?: number | string;
  resultValue?: number | string;
  flagsState?: Record<string, boolean>;
  onClose: () => void;
}

export function formatRadix(val: number | string | undefined, width: number, radix: MicroarchRadix): string {
  if (val === undefined || val === null) return "--";
  let num: number;
  if (typeof val === "number") {
    num = val;
  } else {
    const clean = val.replace(/^0x/i, "").replace(/b$/i, "");
    num = parseInt(clean, 16) || 0;
  }

  if (radix === "hex") {
    const hexChars = Math.max(1, Math.ceil(width / 4));
    return "0x" + (num >>> 0).toString(16).toUpperCase().padStart(hexChars, "0");
  } else if (radix === "dec") {
    return (num >>> 0).toString(10);
  } else {
    return (num >>> 0).toString(2).padStart(width, "0") + "b";
  }
}

export const AluInspectorModal: React.FC<AluInspectorModalProps> = ({
  alu,
  macroLabel,
  currentOpcode = 0,
  operandAValue = 42,
  operandBValue = 15,
  resultValue,
  flagsState = {},
  onClose
}) => {
  const [radix, setRadix] = useState<MicroarchRadix>("hex");

  // Determine active operation
  const activeOp = alu.operations.find((op) => op.opcode_val === currentOpcode) || alu.operations[0];

  // Compute fallback result if not passed
  let displayedResult = resultValue;
  if (displayedResult === undefined && typeof operandAValue === "number" && typeof operandBValue === "number") {
    switch (activeOp?.name?.toUpperCase()) {
      case "ADD":
        displayedResult = (operandAValue + operandBValue) & ((1 << alu.result_width) - 1);
        break;
      case "SUB":
        displayedResult = (operandAValue - operandBValue) & ((1 << alu.result_width) - 1);
        break;
      case "AND":
        displayedResult = operandAValue & operandBValue;
        break;
      case "OR":
        displayedResult = operandAValue | operandBValue;
        break;
      case "XOR":
        displayedResult = operandAValue ^ operandBValue;
        break;
      case "SLL":
      case "SHL":
        displayedResult = (operandAValue << (operandBValue & 0x1f)) & ((1 << alu.result_width) - 1);
        break;
      case "SRL":
      case "SHR":
        displayedResult = (operandAValue >>> (operandBValue & 0x1f)) & ((1 << alu.result_width) - 1);
        break;
      case "NOT":
        displayedResult = (~operandAValue) & ((1 << alu.result_width) - 1);
        break;
      default:
        displayedResult = operandAValue;
    }
  }

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
          maxWidth: 780,
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
            <Cpu size={20} color="#f59e0b" />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>
                {macroLabel} — Arithmetic Logic Unit (ALU) Inspector
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Opcode: <code style={{ color: "var(--accent-cyan)" }}>{alu.opcode_signal}</code> ({alu.opcode_width}-bit) |
                Operands: <code style={{ color: "var(--text-secondary)" }}>{alu.operand_a}</code>,{" "}
                <code style={{ color: "var(--text-secondary)" }}>{alu.operand_b}</code> ({alu.operand_width}-bit) |
                Result: <code style={{ color: "#38bdf8" }}>{alu.result_signal}</code> ({alu.result_width}-bit)
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

        {/* Live Datapath Execution Ribbon */}
        <div
          style={{
            padding: "16px 20px",
            backgroundColor: "#0c1017",
            borderBottom: "1px solid var(--border-subtle)",
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr auto 1.2fr auto 1.5fr",
            alignItems: "center",
            gap: 12
          }}
        >
          {/* Operand A Card */}
          <div
            style={{
              padding: "10px 14px",
              backgroundColor: "rgba(56, 189, 248, 0.05)",
              border: "1px solid rgba(56, 189, 248, 0.2)",
              borderRadius: 6,
              textAlign: "center"
            }}
          >
            <div style={{ fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Operand A ({alu.operand_a})
            </div>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 16,
                fontWeight: 700,
                color: "#38bdf8",
                marginTop: 4
              }}
            >
              {formatRadix(operandAValue, alu.operand_width, radix)}
            </div>
          </div>

          <span style={{ fontSize: 18, color: "var(--text-muted)", fontWeight: 700 }}>
            {activeOp?.name === "ADD" ? "+" : activeOp?.name === "SUB" ? "−" : "&"}
          </span>

          {/* Operand B Card */}
          <div
            style={{
              padding: "10px 14px",
              backgroundColor: "rgba(56, 189, 248, 0.05)",
              border: "1px solid rgba(56, 189, 248, 0.2)",
              borderRadius: 6,
              textAlign: "center"
            }}
          >
            <div style={{ fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Operand B ({alu.operand_b})
            </div>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 16,
                fontWeight: 700,
                color: "#38bdf8",
                marginTop: 4
              }}
            >
              {formatRadix(operandBValue, alu.operand_width, radix)}
            </div>
          </div>

          <span style={{ fontSize: 20, color: "#f59e0b", fontWeight: 700 }}>=</span>

          {/* Result Card */}
          <div
            style={{
              padding: "10px 14px",
              backgroundColor: "rgba(16, 185, 129, 0.08)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              borderRadius: 6,
              textAlign: "center"
            }}
          >
            <div style={{ fontSize: 10.5, color: "#10b981", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>
              Result ({alu.result_signal})
            </div>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 16,
                fontWeight: 700,
                color: "#10b981",
                marginTop: 4
              }}
            >
              {formatRadix(displayedResult, alu.result_width, radix)}
            </div>
          </div>

          <div style={{ width: 1, height: 40, backgroundColor: "var(--border-subtle)" }} />

          {/* Active Operation Badge */}
          <div
            style={{
              padding: "8px 12px",
              backgroundColor: "rgba(245, 158, 11, 0.08)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              borderRadius: 6,
              display: "flex",
              flexDirection: "column",
              gap: 2
            }}
          >
            <div style={{ fontSize: 10, color: "#f59e0b", textTransform: "uppercase", fontWeight: 600 }}>
              Active Instruction
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
              {activeOp?.name || "NOP"} ({activeOp?.expression || "—"})
            </div>
            <div style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text-muted)" }}>
              Opcode: {activeOp?.opcode_bin || "0000"} ({formatRadix(currentOpcode, alu.opcode_width, "hex")})
            </div>
          </div>
        </div>

        {/* Status Flags Section */}
        {alu.flags && alu.flags.length > 0 && (
          <div
            style={{
              padding: "10px 20px",
              backgroundColor: "var(--bg-secondary)",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              gap: 16
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
              Status Flags:
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {alu.flags.map((flag: AluFlag) => {
                const isActive = Boolean(flagsState[flag.signal] ?? (flag.name === "Zero" && displayedResult === 0));
                return (
                  <div
                    key={flag.name}
                    title={flag.description}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 10px",
                      borderRadius: 4,
                      backgroundColor: isActive ? "rgba(16, 185, 129, 0.15)" : "var(--bg-tertiary)",
                      border: `1px solid ${isActive ? "#10b981" : "var(--border-subtle)"}`,
                      color: isActive ? "#10b981" : "var(--text-muted)",
                      fontSize: 11,
                      fontWeight: 600
                    }}
                  >
                    {isActive ? <CheckCircle2 size={13} color="#10b981" /> : <Circle size={13} color="var(--text-muted)" />}
                    <span>{flag.name}</span>
                    <span style={{ fontSize: 9.5, opacity: 0.75 }}>({flag.signal})</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Operation Truth Table */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
            ALU Opcode Function Table ({alu.operations.length} Defined Operations)
          </div>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 11.5,
              textAlign: "left"
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--border-subtle)",
                  color: "var(--text-muted)",
                  fontSize: 10.5,
                  textTransform: "uppercase"
                }}
              >
                <th style={{ padding: "6px 10px" }}>Status</th>
                <th style={{ padding: "6px 10px" }}>Opcode (Bin)</th>
                <th style={{ padding: "6px 10px" }}>Opcode (Hex)</th>
                <th style={{ padding: "6px 10px" }}>Operation</th>
                <th style={{ padding: "6px 10px" }}>Verilog Expression</th>
              </tr>
            </thead>
            <tbody>
              {alu.operations.map((op: AluOperation) => {
                const isCurrent = op.opcode_val === currentOpcode;
                return (
                  <tr
                    key={op.name + op.opcode_val}
                    style={{
                      borderBottom: "1px solid var(--border-subtle)",
                      backgroundColor: isCurrent ? "rgba(245, 158, 11, 0.1)" : "transparent",
                      transition: "background-color 0.15s ease"
                    }}
                  >
                    <td style={{ padding: "8px 10px" }}>
                      {isCurrent ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "2px 6px",
                            backgroundColor: "#f59e0b",
                            color: "#000",
                            borderRadius: 3,
                            fontSize: 9.5,
                            fontWeight: 700
                          }}
                        >
                          ACTIVE
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: 10 }}>IDLE</span>
                      )}
                    </td>
                    <td style={{ padding: "8px 10px", fontFamily: "monospace", color: isCurrent ? "#f59e0b" : "var(--text-primary)" }}>
                      {op.opcode_bin}
                    </td>
                    <td style={{ padding: "8px 10px", fontFamily: "monospace", color: "var(--text-muted)" }}>
                      {formatRadix(op.opcode_val, alu.opcode_width, "hex")}
                    </td>
                    <td
                      style={{
                        padding: "8px 10px",
                        fontWeight: 600,
                        color: isCurrent ? "#f59e0b" : "var(--text-primary)"
                      }}
                    >
                      {op.name}
                    </td>
                    <td style={{ padding: "8px 10px", fontFamily: "monospace", color: "#38bdf8" }}>
                      {op.expression}
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
          <div>
            Showing live operand registers and decoded ALU function mapping.
          </div>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: "4px 12px", fontSize: 11.5 }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
