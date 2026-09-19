import React, { useState } from "react";
import { X, Play, Download, Copy, Check, Sparkles } from "lucide-react";
import { engineBridge } from "../engine/engineBridge";
import { Select } from "./ui";

interface StimulusPainterModalProps {
  topModule: string;
  isOpen: boolean;
  onClose: () => void;
}

export const StimulusPainterModal: React.FC<StimulusPainterModalProps> = ({
  topModule,
  isOpen,
  onClose
}) => {
  const [selectedPattern, setSelectedPattern] = useState<string>("ramp");
  const [clockFreqMhz, setClockFreqMhz] = useState<number>(100);
  const [cycleCount, setCycleCount] = useState<number>(16);
  const [copied, setCopied] = useState<boolean>(false);
  const [applied, setApplied] = useState<boolean>(false);

  if (!isOpen) return null;

  const testbenchCode = engineBridge.generateSystemVerilogTestbench(topModule);

  const handleCopy = () => {
    navigator.clipboard.writeText(testbenchCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([testbenchCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${topModule}_tb.sv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleApplyStimulus = () => {
    // Generate multi-cycle pattern into in-RAM simulation
    const isAlu = topModule.includes("alu");
    const isCounter = topModule.includes("counter");

    // Assert and release reset
    engineBridge.injectStimulus("rst_n", "0");
    engineBridge.tick(1000);
    engineBridge.injectStimulus("rst_n", "1");
    engineBridge.tick(1000);

    for (let c = 0; c < cycleCount; c++) {
      if (isAlu) {
        let aVal = 0;
        let bVal = 0;
        let opVal = c % 8;

        if (selectedPattern === "ramp") {
          aVal = (c * 17) & 0xFF;
          bVal = (c * 7 + 3) & 0xFF;
        } else if (selectedPattern === "walking") {
          aVal = (1 << (c % 8)) & 0xFF;
          bVal = (1 << ((7 - c) % 8)) & 0xFF;
        } else if (selectedPattern === "alternating") {
          aVal = c % 2 === 0 ? 0x55 : 0xAA;
          bVal = c % 2 === 0 ? 0xAA : 0x55;
        } else {
          // PRBS / pseudo-random
          aVal = (c * 37 + 13) & 0xFF;
          bVal = (c * 53 + 29) & 0xFF;
        }

        const aHex = "0x" + aVal.toString(16).padStart(2, "0");
        const bHex = "0x" + bVal.toString(16).padStart(2, "0");
        const opBin = opVal.toString(2).padStart(3, "0");

        engineBridge.injectStimulus("a", aHex);
        engineBridge.injectStimulus("b", bHex);
        engineBridge.injectStimulus("opcode", opBin);
      } else if (isCounter) {
        engineBridge.injectStimulus("enable", "1");
        engineBridge.injectStimulus("up_down", selectedPattern === "ramp" ? "1" : c % 4 < 2 ? "1" : "0");
      } else {
        const dVal = (c * 23) & 0xFF;
        engineBridge.injectStimulus("data_in", "0x" + dVal.toString(16).padStart(2, "0"));
      }

      // Step clock cycle (1000 ps = 1 ns)
      engineBridge.tick(1000);
    }

    setApplied(true);
    setTimeout(() => setApplied(false), 2500);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100
      }}
    >
      <div
        style={{
          width: "90%",
          maxWidth: 780,
          maxHeight: "85vh",
          backgroundColor: "var(--bg-primary)",
          border: "1px solid var(--border-medium)",
          borderRadius: 8,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.8)"
        }}
      >
        {/* Header */}
        <div
          style={{
            height: 48,
            backgroundColor: "var(--bg-secondary)",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={16} color="var(--accent-cyan)" />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
              Axiom Stimulus Painter & Synthesizable Testbench Generator
            </span>
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
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 16, overflowY: "auto", gap: 14 }}>
          {/* Pattern Presets */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase" }}>
              1. Select Waveform Stimulus Pattern
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {[
                { id: "ramp", name: "Linear Ramp", desc: "Sequential counter increment" },
                { id: "alternating", name: "Alternating 0xAA/55", desc: "Maximum switching toggle stress" },
                { id: "walking", name: "Walking Ones", desc: "Single-hot bit shifted pattern" },
                { id: "prbs", name: "PRBS7 Random", desc: "Pseudo-random noise generator" }
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPattern(p.id)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: selectedPattern === p.id ? "1px solid var(--accent-cyan)" : "1px solid var(--border-subtle)",
                    backgroundColor: selectedPattern === p.id ? "rgba(56, 189, 248, 0.12)" : "var(--bg-secondary)",
                    textAlign: "left",
                    cursor: "pointer"
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, color: selectedPattern === p.id ? "var(--accent-cyan)" : "#fff" }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Clock & Sequence Options */}
          <div style={{ display: "flex", gap: 16, alignItems: "center", backgroundColor: "var(--bg-secondary)", padding: "10px 14px", borderRadius: 6, border: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Clock Frequency:</span>
              <Select
                size="sm"
                value={String(clockFreqMhz)}
                onChange={(val) => setClockFreqMhz(Number(val))}
                options={[
                  { value: "50", label: "50 MHz (20 ns)" },
                  { value: "100", label: "100 MHz (10 ns)" },
                  { value: "200", label: "200 MHz (5 ns)" }
                ]}
                buttonStyle={{
                  height: 26,
                  fontSize: 11,
                  padding: "2px 8px"
                }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Cycle Count:</span>
              <input
                type="number"
                min={4}
                max={64}
                value={cycleCount}
                onChange={(e) => setCycleCount(Math.max(4, Math.min(64, Number(e.target.value))))}
                style={{
                  width: 55,
                  fontSize: 11,
                  backgroundColor: "var(--bg-tertiary)",
                  color: "#fff",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 4,
                  padding: "3px 6px",
                  textAlign: "center"
                }}
              />
            </div>

            <button
              onClick={handleApplyStimulus}
              style={{
                marginLeft: "auto",
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11,
                fontWeight: 600,
                padding: "5px 12px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: applied ? "var(--accent-emerald)" : "var(--accent-blue)",
                color: "#fff"
              }}
            >
              {applied ? <Check size={12} /> : <Play size={12} fill="#fff" />}
              <span>{applied ? "Applied In-RAM!" : "Apply Stimulus to Circuit"}</span>
            </button>
          </div>

          {/* Synthesizable SystemVerilog Testbench Preview */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 220 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
                2. Generated Synthesizable IEEE 1800 SystemVerilog Testbench (`{topModule}_tb.sv`)
              </div>

              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={handleCopy}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 4,
                    backgroundColor: "var(--bg-tertiary)",
                    color: copied ? "var(--accent-emerald)" : "var(--text-muted)",
                    border: "1px solid var(--border-subtle)"
                  }}
                >
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                  <span>{copied ? "Copied!" : "Copy Code"}</span>
                </button>

                <button
                  onClick={handleDownload}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 4,
                    backgroundColor: "var(--bg-tertiary)",
                    color: "var(--accent-cyan)",
                    border: "1px solid var(--border-subtle)"
                  }}
                >
                  <Download size={11} />
                  <span>Download .sv</span>
                </button>
              </div>
            </div>

            <pre
              style={{
                flex: 1,
                backgroundColor: "#070a0e",
                border: "1px solid var(--border-subtle)",
                borderRadius: 6,
                padding: "10px 12px",
                color: "#94a3b8",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                lineHeight: "18px",
                overflowX: "auto",
                overflowY: "auto",
                maxHeight: 220,
                margin: 0
              }}
            >
              <code>{testbenchCode}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
