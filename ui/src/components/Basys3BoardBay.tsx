// Axiom EDA — Digilent Basys 3 Artix-7 FPGA Development Board Hardware Emulator Bay
// Provides authentic tactile switches, glowing LEDs, 5-button d-pad, and 4-digit 7-segment display

import React, { useState, useMemo } from "react";
import {
  Cpu,
  RefreshCw,
  Sliders,
  Zap,
  Info,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import type { SimulationState } from "../engine/engineBridge";
import { engineBridge } from "../engine/engineBridge";
import type { AxiomProject } from "../engine/projectModel";
import {
  BASYS3_PINS,
  parseXdcPinBindings,
  resolveSignalBit,
  injectBoardControl,
  resolveSevenSegDisplay,
  PortRef
} from "../engine/boardModel";

export interface Basys3BoardBayProps {
  state: SimulationState;
  project?: AxiomProject | null;
}

// 7-Segment SVG Digit Component
const SevenSegDigit: React.FC<{
  segments: boolean[]; // [a, b, c, d, e, f, g, dp]
  active: boolean;
}> = ({ segments, active }) => {
  const litColor = "#ff2a2a";
  const unlitColor = "rgba(255, 42, 42, 0.08)";
  const glowStyle = (isLit: boolean) => ({
    fill: isLit && active ? litColor : unlitColor,
    filter: isLit && active ? "drop-shadow(0 0 3px #ff2a2a)" : "none",
    transition: "fill 0.08s ease, filter 0.08s ease"
  });

  return (
    <div
      style={{
        width: 38,
        height: 58,
        backgroundColor: "#080c11",
        borderRadius: 4,
        padding: 4,
        border: "1px solid rgba(255, 255, 255, 0.08)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <svg viewBox="0 0 50 80" width="100%" height="100%">
        {/* a: Top */}
        <polygon points="12,8 38,8 33,14 17,14" style={glowStyle(segments[0])} />
        {/* b: Top-Right */}
        <polygon points="39,9 43,13 39,38 34,34" style={glowStyle(segments[1])} />
        {/* c: Bottom-Right */}
        <polygon points="39,42 43,46 39,71 34,66" style={glowStyle(segments[2])} />
        {/* d: Bottom */}
        <polygon points="12,72 38,72 33,66 17,66" style={glowStyle(segments[3])} />
        {/* e: Bottom-Left */}
        <polygon points="11,42 16,46 11,71 7,66" style={glowStyle(segments[4])} />
        {/* f: Top-Left */}
        <polygon points="11,9 16,13 11,38 7,34" style={glowStyle(segments[5])} />
        {/* g: Middle */}
        <polygon points="15,37 35,37 38,40 35,43 15,43 12,40" style={glowStyle(segments[6])} />
        {/* dp: Decimal Point */}
        <circle cx="45" cy="72" r="3" style={glowStyle(segments[7])} />
      </svg>
    </div>
  );
};

export const Basys3BoardBay: React.FC<Basys3BoardBayProps> = ({ state, project }) => {
  const [showPinMap, setShowPinMap] = useState(false);
  const [switchStates, setSwitchStates] = useState<Record<string, number>>({});
  const [activeButtons, setActiveButtons] = useState<Record<string, boolean>>({});

  // 1. Extract XDC constraints from project
  const pinBindings = useMemo(() => {
    if (!project) return new Map<string, PortRef>();
    const constrFile =
      project.files.find((f) => f.fileSet === "constrs_1" && f.fileType === "xdc") ||
      project.files.find((f) => f.name.endsWith(".xdc"));
    if (!constrFile) return new Map<string, PortRef>();
    return parseXdcPinBindings(constrFile.content);
  }, [project]);

  // 2. Count connected pins
  const connectedCount = useMemo(() => {
    return BASYS3_PINS.filter((p) => pinBindings.has(p.pin)).length;
  }, [pinBindings]);

  // 3. Resolve live LED states
  const ledStates = useMemo(() => {
    const states: Record<string, number> = {};
    for (let i = 0; i <= 15; i++) {
      const pinDef = BASYS3_PINS.find((p) => p.id === `LD${i}`);
      if (!pinDef) continue;
      const port = pinBindings.get(pinDef.pin);
      states[pinDef.id] = resolveSignalBit(port, state.signals);
    }
    return states;
  }, [pinBindings, state.signals]);

  // 4. Resolve 7-segment displays
  const sevenSeg = useMemo(() => {
    return resolveSevenSegDisplay(pinBindings, state.signals);
  }, [pinBindings, state.signals]);

  // Switch Toggle Handler
  const handleToggleSwitch = (id: string, pin: string) => {
    const current = switchStates[id] || 0;
    const next = current === 1 ? 0 : 1;
    setSwitchStates((prev) => ({ ...prev, [id]: next }));

    const port = pinBindings.get(pin);
    if (port) {
      injectBoardControl(port, next, state.signals);
    }
  };

  // Reset all switches
  const handleResetAllSwitches = () => {
    const zeroed: Record<string, number> = {};
    for (let i = 0; i <= 15; i++) {
      zeroed[`SW${i}`] = 0;
      const pinDef = BASYS3_PINS.find((p) => p.id === `SW${i}`);
      if (pinDef) {
        const port = pinBindings.get(pinDef.pin);
        if (port) {
          injectBoardControl(port, 0, state.signals);
        }
      }
    }
    setSwitchStates(zeroed);
  };

  // Button Press Handler (Momentary Push Button)
  const handleButtonDown = (id: string, pin: string) => {
    setActiveButtons((prev) => ({ ...prev, [id]: true }));
    const port = pinBindings.get(pin);
    if (port) {
      // BTNC is commonly reset (rst_n active-low -> 0, or active-high -> 1)
      const isRstN = port.baseName.toLowerCase().includes("rst_n") || port.baseName.toLowerCase().includes("reset_n");
      injectBoardControl(port, isRstN ? 0 : 1, state.signals);
    }
  };

  const handleButtonUp = (id: string, pin: string) => {
    setActiveButtons((prev) => ({ ...prev, [id]: false }));
    const port = pinBindings.get(pin);
    if (port) {
      const isRstN = port.baseName.toLowerCase().includes("rst_n") || port.baseName.toLowerCase().includes("reset_n");
      injectBoardControl(port, isRstN ? 1 : 0, state.signals);
    }
  };

  const handleStepClock = () => {
    const clkPin = BASYS3_PINS.find((p) => p.id === "CLK");
    const port = clkPin ? pinBindings.get(clkPin.pin) : undefined;
    const clkNet = port ? port.baseName : "clk";
    engineBridge.pulseSignal(clkNet);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        fontFamily: "var(--font-sans)",
        color: "var(--text-primary)"
      }}
    >
      {/* Header Banner & Board Actions */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          backgroundColor: "var(--bg-tertiary)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-md)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "var(--radius-sm)",
              backgroundColor: "rgba(6, 182, 212, 0.12)",
              border: "1px solid rgba(6, 182, 212, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--accent-cyan)"
            }}
          >
            <Cpu size={18} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)" }}>
                Digilent Basys 3 Hardware Emulator
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "1px 6px",
                  borderRadius: "var(--radius-xs)",
                  backgroundColor: "rgba(16, 185, 129, 0.15)",
                  color: "var(--accent-green)",
                  border: "1px solid rgba(16, 185, 129, 0.3)"
                }}
              >
                Artix-7 XC7A35T
              </span>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              XDC Dynamic Auto-Binding:{" "}
              <span style={{ color: connectedCount > 0 ? "var(--accent-cyan)" : "var(--text-secondary)", fontWeight: 600 }}>
                {connectedCount} / {BASYS3_PINS.length} pins mapped
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={handleStepClock}
            className="btn btn-secondary"
            style={{
              height: 28,
              padding: "0 10px",
              fontSize: 11.5,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 5
            }}
            title="Step 100MHz system clock (pin W5)"
          >
            <Zap size={13} style={{ color: "var(--accent-yellow)" }} />
            <span>Step Clock</span>
          </button>

          <button
            type="button"
            onClick={handleResetAllSwitches}
            className="btn btn-secondary"
            style={{
              height: 28,
              padding: "0 10px",
              fontSize: 11.5,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 5
            }}
            title="Reset all 16 DIP switches to OFF"
          >
            <RefreshCw size={12} />
            <span>Clear Switches</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPinMap((prev) => !prev)}
            className="btn btn-secondary"
            style={{
              height: 28,
              padding: "0 10px",
              fontSize: 11.5,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 5
            }}
          >
            <Sliders size={12} />
            <span>{showPinMap ? "Hide Pins" : "Pin Mapping"}</span>
            {showPinMap ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </div>

      {/* Authentic Physical PCB Board Surface */}
      <div
        style={{
          position: "relative",
          backgroundColor: "#0d131a",
          borderRadius: 8,
          border: "2px solid #1f2937",
          boxShadow: "0 12px 30px rgba(0, 0, 0, 0.7), inset 0 0 80px rgba(0, 0, 0, 0.6)",
          padding: "20px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 22,
          overflow: "hidden"
        }}
      >
        {/* 4 Corner Mounting Holes */}
        <div style={{ position: "absolute", top: 8, left: 8, width: 12, height: 12, borderRadius: "50%", border: "2px solid #b45309", backgroundColor: "#060a0f" }} />
        <div style={{ position: "absolute", top: 8, right: 8, width: 12, height: 12, borderRadius: "50%", border: "2px solid #b45309", backgroundColor: "#060a0f" }} />
        <div style={{ position: "absolute", bottom: 8, left: 8, width: 12, height: 12, borderRadius: "50%", border: "2px solid #b45309", backgroundColor: "#060a0f" }} />
        <div style={{ position: "absolute", bottom: 8, right: 8, width: 12, height: 12, borderRadius: "50%", border: "2px solid #b45309", backgroundColor: "#060a0f" }} />

        {/* Board Silkscreen Branding */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255, 255, 255, 0.07)", paddingBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: "0.12em", color: "#e2e8f0" }}>
              DIGILENT
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.08em", color: "var(--accent-cyan)" }}>
              BASYS 3
            </span>
          </div>

          <span style={{ fontSize: 10.5, fontWeight: 600, color: "rgba(255, 255, 255, 0.35)", letterSpacing: "0.08em" }}>
            ARTIX-7 FPGA TRAINER • XC7A35T-CPG236C
          </span>
        </div>

        {/* Middle Row: 7-Segment Display + Central FPGA Chip + 5-Button D-Pad */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
          {/* Left: 4-Digit 7-Segment Display */}
          <div
            style={{
              padding: 12,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: 6,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {/* Digit 3 (Leftmost, AN3) */}
              <SevenSegDigit segments={sevenSeg.digits[3]} active={sevenSeg.anodesActive[3]} />
              {/* Digit 2 (AN2) */}
              <SevenSegDigit segments={sevenSeg.digits[2]} active={sevenSeg.anodesActive[2]} />
              {/* Digit 1 (AN1) */}
              <SevenSegDigit segments={sevenSeg.digits[1]} active={sevenSeg.anodesActive[1]} />
              {/* Digit 0 (Rightmost, AN0) */}
              <SevenSegDigit segments={sevenSeg.digits[0]} active={sevenSeg.anodesActive[0]} />
            </div>
            <span style={{ fontSize: 9.5, fontWeight: 600, color: "rgba(255, 255, 255, 0.4)", letterSpacing: "0.05em" }}>
              4-DIGIT MULTIPLEXED 7-SEGMENT (W7..V7 / U2..W4)
            </span>
          </div>

          {/* Center: Artix-7 Chip Package Outline */}
          <div
            style={{
              width: 120,
              height: 120,
              backgroundColor: "#111827",
              border: "2px solid #374151",
              borderRadius: 4,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              boxShadow: "inset 0 0 15px rgba(0, 0, 0, 0.8)",
              position: "relative"
            }}
          >
            {/* Chip Orientation Pin 1 Dot */}
            <div style={{ position: "absolute", top: 6, left: 6, width: 6, height: 6, borderRadius: "50%", backgroundColor: "rgba(255, 255, 255, 0.3)" }} />
            <span style={{ fontSize: 9, fontWeight: 800, color: "rgba(255, 255, 255, 0.5)", letterSpacing: "0.08em" }}>
              XILINX
            </span>
            <span style={{ fontSize: 11, fontWeight: 800, color: "var(--accent-cyan)", letterSpacing: "0.05em" }}>
              Artix-7
            </span>
            <span style={{ fontSize: 8.5, color: "rgba(255, 255, 255, 0.4)", fontFamily: "var(--font-mono)" }}>
              XC7A35T
            </span>
            <span style={{ fontSize: 7.5, color: "rgba(255, 255, 255, 0.3)", fontFamily: "var(--font-mono)" }}>
              CPG236ABX
            </span>
          </div>

          {/* Right: 5-Button Directional Pad */}
          <div
            style={{
              padding: 10,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: 6,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4
            }}
          >
            <span style={{ fontSize: 9.5, fontWeight: 600, color: "rgba(255, 255, 255, 0.4)", marginBottom: 4 }}>
              PUSH BUTTONS
            </span>

            {/* D-Pad Layout */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 30px)", gridTemplateRows: "repeat(3, 30px)", gap: 4 }}>
              <div />
              {/* BTNU (Up, T18) */}
              <button
                type="button"
                onMouseDown={() => handleButtonDown("BTNU", "T18")}
                onMouseUp={() => handleButtonUp("BTNU", "T18")}
                onMouseLeave={() => activeButtons["BTNU"] && handleButtonUp("BTNU", "T18")}
                title={`BTNU (T18) ${pinBindings.get("T18") ? `-> ${pinBindings.get("T18")?.rawPort}` : ""}`}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  backgroundColor: activeButtons["BTNU"] ? "var(--accent-cyan)" : "#1e293b",
                  border: "2px solid #475569",
                  color: activeButtons["BTNU"] ? "#000" : "#cbd5e1",
                  fontSize: 8,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: activeButtons["BTNU"] ? "0 0 8px var(--accent-cyan)" : "0 2px 4px rgba(0,0,0,0.5)"
                }}
              >
                U
              </button>
              <div />

              {/* BTNL (Left, W19) */}
              <button
                type="button"
                onMouseDown={() => handleButtonDown("BTNL", "W19")}
                onMouseUp={() => handleButtonUp("BTNL", "W19")}
                onMouseLeave={() => activeButtons["BTNL"] && handleButtonUp("BTNL", "W19")}
                title={`BTNL (W19) ${pinBindings.get("W19") ? `-> ${pinBindings.get("W19")?.rawPort}` : ""}`}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  backgroundColor: activeButtons["BTNL"] ? "var(--accent-cyan)" : "#1e293b",
                  border: "2px solid #475569",
                  color: activeButtons["BTNL"] ? "#000" : "#cbd5e1",
                  fontSize: 8,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: activeButtons["BTNL"] ? "0 0 8px var(--accent-cyan)" : "0 2px 4px rgba(0,0,0,0.5)"
                }}
              >
                L
              </button>

              {/* BTNC (Center / Reset, U18) */}
              <button
                type="button"
                onMouseDown={() => handleButtonDown("BTNC", "U18")}
                onMouseUp={() => handleButtonUp("BTNC", "U18")}
                onMouseLeave={() => activeButtons["BTNC"] && handleButtonUp("BTNC", "U18")}
                title={`BTNC (U18) ${pinBindings.get("U18") ? `-> ${pinBindings.get("U18")?.rawPort}` : ""}`}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  backgroundColor: activeButtons["BTNC"] ? "var(--accent-red)" : "#991b1b",
                  border: "2px solid #ef4444",
                  color: "#fff",
                  fontSize: 8,
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: activeButtons["BTNC"] ? "0 0 10px #ef4444" : "0 2px 4px rgba(0,0,0,0.5)"
                }}
              >
                C
              </button>

              {/* BTNR (Right, T17) */}
              <button
                type="button"
                onMouseDown={() => handleButtonDown("BTNR", "T17")}
                onMouseUp={() => handleButtonUp("BTNR", "T17")}
                onMouseLeave={() => activeButtons["BTNR"] && handleButtonUp("BTNR", "T17")}
                title={`BTNR (T17) ${pinBindings.get("T17") ? `-> ${pinBindings.get("T17")?.rawPort}` : ""}`}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  backgroundColor: activeButtons["BTNR"] ? "var(--accent-cyan)" : "#1e293b",
                  border: "2px solid #475569",
                  color: activeButtons["BTNR"] ? "#000" : "#cbd5e1",
                  fontSize: 8,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: activeButtons["BTNR"] ? "0 0 8px var(--accent-cyan)" : "0 2px 4px rgba(0,0,0,0.5)"
                }}
              >
                R
              </button>

              <div />
              {/* BTND (Down, U17) */}
              <button
                type="button"
                onMouseDown={() => handleButtonDown("BTND", "U17")}
                onMouseUp={() => handleButtonUp("BTND", "U17")}
                onMouseLeave={() => activeButtons["BTND"] && handleButtonUp("BTND", "U17")}
                title={`BTND (U17) ${pinBindings.get("U17") ? `-> ${pinBindings.get("U17")?.rawPort}` : ""}`}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  backgroundColor: activeButtons["BTND"] ? "var(--accent-cyan)" : "#1e293b",
                  border: "2px solid #475569",
                  color: activeButtons["BTND"] ? "#000" : "#cbd5e1",
                  fontSize: 8,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: activeButtons["BTND"] ? "0 0 8px var(--accent-cyan)" : "0 2px 4px rgba(0,0,0,0.5)"
                }}
              >
                D
              </button>
              <div />
            </div>
          </div>
        </div>

        {/* 16 Output LEDs Row (LD15 down to LD0) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em", color: "rgba(255, 255, 255, 0.4)" }}>
              OUTPUT LEDS (LD15..LD0)
            </span>
            <span style={{ fontSize: 9, color: "rgba(255, 255, 255, 0.3)" }}>
              Radial Phosphor Glow Shaders
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(16, 1fr)",
              gap: 6,
              backgroundColor: "rgba(0, 0, 0, 0.4)",
              padding: "10px 8px",
              borderRadius: 6,
              border: "1px solid rgba(255, 255, 255, 0.05)"
            }}
          >
            {Array.from({ length: 16 }, (_, idx) => 15 - idx).map((num) => {
              const id = `LD${num}`;
              const isLit = ledStates[id] === 1;
              const pinDef = BASYS3_PINS.find((p) => p.id === id);
              const port = pinDef ? pinBindings.get(pinDef.pin) : undefined;

              return (
                <div
                  key={id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4
                  }}
                  title={`${id} (${pinDef?.pin}) ${port ? `-> ${port.rawPort} = ${isLit ? 1 : 0}` : "(unbound)"}`}
                >
                  {/* LED Dome */}
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      backgroundColor: isLit ? "#10b981" : "rgba(16, 185, 129, 0.12)",
                      border: isLit ? "1px solid #34d399" : "1px solid rgba(255, 255, 255, 0.15)",
                      boxShadow: isLit
                        ? "0 0 10px #10b981, 0 0 20px rgba(16, 185, 129, 0.6)"
                        : "inset 0 1px 2px rgba(0, 0, 0, 0.8)",
                      transition: "all 0.08s ease"
                    }}
                  />

                  {/* Silkscreen Label */}
                  <span
                    style={{
                      fontSize: 8.5,
                      fontWeight: 700,
                      color: isLit ? "var(--accent-green)" : "rgba(255, 255, 255, 0.35)",
                      fontFamily: "var(--font-mono)"
                    }}
                  >
                    {num}
                  </span>

                  {/* Bound Port Name */}
                  <span
                    style={{
                      fontSize: 7.5,
                      color: port ? "var(--accent-cyan)" : "transparent",
                      maxWidth: 24,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontFamily: "var(--font-mono)"
                    }}
                  >
                    {port?.rawPort || "-"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 16 Tactile Rocker DIP Switches Row (SW15 down to SW0) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em", color: "rgba(255, 255, 255, 0.4)" }}>
              TACTILE SLIDING DIP SWITCHES (SW15..SW0)
            </span>
            <span style={{ fontSize: 9, color: "rgba(255, 255, 255, 0.3)" }}>
              Click rocker to toggle UP (1) / DOWN (0)
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(16, 1fr)",
              gap: 6,
              backgroundColor: "rgba(0, 0, 0, 0.4)",
              padding: "10px 8px",
              borderRadius: 6,
              border: "1px solid rgba(255, 255, 255, 0.05)"
            }}
          >
            {Array.from({ length: 16 }, (_, idx) => 15 - idx).map((num) => {
              const id = `SW${num}`;
              const isOn = (switchStates[id] || 0) === 1;
              const pinDef = BASYS3_PINS.find((p) => p.id === id);
              const port = pinDef ? pinBindings.get(pinDef.pin) : undefined;

              return (
                <div
                  key={id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4
                  }}
                  title={`${id} (${pinDef?.pin}) ${port ? `-> ${port.rawPort} (Click to toggle)` : "(unbound)"}`}
                >
                  {/* Status Indicator Dot */}
                  <div
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      backgroundColor: isOn ? "var(--accent-green)" : "rgba(255, 255, 255, 0.1)",
                      boxShadow: isOn ? "0 0 6px var(--accent-green)" : "none"
                    }}
                  />

                  {/* Rocker Switch Housing */}
                  <div
                    onClick={() => pinDef && handleToggleSwitch(id, pinDef.pin)}
                    style={{
                      width: 18,
                      height: 36,
                      backgroundColor: "#05070a",
                      borderRadius: 3,
                      border: "1px solid #334155",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: isOn ? "flex-start" : "flex-end",
                      padding: 2,
                      boxShadow: "inset 0 1px 3px rgba(0,0,0,0.9)",
                      transition: "all 0.1s ease"
                    }}
                  >
                    {/* Switch Lever Tab */}
                    <div
                      style={{
                        width: "100%",
                        height: 16,
                        borderRadius: 2,
                        backgroundColor: isOn ? "#f1f5f9" : "#475569",
                        border: isOn ? "1px solid #ffffff" : "1px solid #64748b",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.6)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 2,
                          backgroundColor: isOn ? "#94a3b8" : "#1e293b",
                          borderRadius: 1
                        }}
                      />
                    </div>
                  </div>

                  {/* Silkscreen Number */}
                  <span
                    style={{
                      fontSize: 8.5,
                      fontWeight: 700,
                      color: isOn ? "var(--text-primary)" : "rgba(255, 255, 255, 0.35)",
                      fontFamily: "var(--font-mono)"
                    }}
                  >
                    {num}
                  </span>

                  {/* Bound Port Name */}
                  <span
                    style={{
                      fontSize: 7.5,
                      color: port ? "var(--accent-cyan)" : "transparent",
                      maxWidth: 24,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontFamily: "var(--font-mono)"
                    }}
                  >
                    {port?.rawPort || "-"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Collapsible Pin Mapping Table HUD */}
      {showPinMap && (
        <div
          style={{
            padding: 12,
            backgroundColor: "var(--bg-tertiary)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            display: "flex",
            flexDirection: "column",
            gap: 8
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
              <Info size={13} style={{ color: "var(--accent-cyan)" }} />
              XDC Physical Pin Constraint Binding Matrix
            </span>
            <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
              Parsed from constraints.xdc
            </span>
          </div>

          <div style={{ maxHeight: 180, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, textAlign: "left" }}>
              <thead>
                <tr style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-secondary)", borderBottom: "1px solid var(--border-medium)" }}>
                  <th style={{ padding: "5px 8px" }}>Peripheral</th>
                  <th style={{ padding: "5px 8px" }}>Type</th>
                  <th style={{ padding: "5px 8px" }}>FPGA Pin</th>
                  <th style={{ padding: "5px 8px" }}>Bound HDL Port</th>
                  <th style={{ padding: "5px 8px", textAlign: "right" }}>Live Value</th>
                </tr>
              </thead>
              <tbody>
                {BASYS3_PINS.map((p) => {
                  const port = pinBindings.get(p.pin);
                  const isBound = Boolean(port);
                  let liveVal = "-";
                  if (isBound && port) {
                    if (p.type === "switch") liveVal = `${switchStates[p.id] || 0}`;
                    else if (p.type === "led") liveVal = `${ledStates[p.id] || 0}`;
                    else if (p.type === "button") liveVal = activeButtons[p.id] ? "1" : "0";
                    else liveVal = `${resolveSignalBit(port, state.signals)}`;
                  }

                  return (
                    <tr
                      key={p.id}
                      style={{
                        borderBottom: "1px solid var(--border-subtle)",
                        backgroundColor: isBound ? "rgba(6, 182, 212, 0.03)" : "transparent"
                      }}
                    >
                      <td style={{ padding: "4px 8px", fontWeight: 600, color: isBound ? "var(--text-primary)" : "var(--text-muted)" }}>
                        {p.label}
                      </td>
                      <td style={{ padding: "4px 8px", color: "var(--text-muted)", textTransform: "capitalize" }}>
                        {p.type.replace("_", " ")}
                      </td>
                      <td className="mono-num" style={{ padding: "4px 8px", color: "var(--accent-yellow)" }}>
                        {p.pin}
                      </td>
                      <td className="mono-num" style={{ padding: "4px 8px", color: isBound ? "var(--accent-cyan)" : "var(--text-muted)" }}>
                        {port?.rawPort || "—"}
                      </td>
                      <td className="mono-num" style={{ padding: "4px 8px", textAlign: "right", color: isBound && liveVal === "1" ? "var(--accent-green)" : "var(--text-muted)" }}>
                        {liveVal}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
