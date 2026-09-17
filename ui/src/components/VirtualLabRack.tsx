import React, { useState, useMemo } from "react";
import {
  RotateCcw,
  Sparkles,
  Zap,
  Play
} from "lucide-react";
import { SimulationState, engineBridge } from "../engine/engineBridge";
import { StimulusPainterModal } from "./StimulusPainterModal";

interface VirtualLabRackProps {
  state: SimulationState;
  activeDesignId: string;
}

// 7-Segment Hex Map (a, b, c, d, e, f, g)
const SEVEN_SEG_HEX: Record<string, boolean[]> = {
  "0": [true, true, true, true, true, true, false],
  "1": [false, true, true, false, false, false, false],
  "2": [true, true, false, true, true, false, true],
  "3": [true, true, true, true, false, false, true],
  "4": [false, true, true, false, false, true, true],
  "5": [true, false, true, true, false, true, true],
  "6": [true, false, true, true, true, true, true],
  "7": [true, true, true, false, false, false, false],
  "8": [true, true, true, true, true, true, true],
  "9": [true, true, true, true, false, true, true],
  "A": [true, true, true, false, true, true, true],
  "B": [false, false, true, true, true, true, true],
  "C": [true, false, false, true, true, true, false],
  "D": [false, true, true, true, true, false, true],
  "E": [true, false, false, true, true, true, true],
  "F": [true, false, false, false, true, true, true]
};

export const VirtualLabRack: React.FC<VirtualLabRackProps> = ({ state, activeDesignId }) => {
  const [isPainterOpen, setIsPainterOpen] = useState<boolean>(false);

  // Active target port driven by DIP switches
  const defaultTarget = useMemo(() => {
    if (activeDesignId === "counter") return "enable";
    if (activeDesignId === "hierarchy") return "data_in";
    return "a";
  }, [activeDesignId]);

  const [dipTargetPort, setDipTargetPort] = useState<string>(defaultTarget);

  // DIP Switches state (8 bits: bit 7 down to bit 0)
  const [dipBits, setDipBits] = useState<boolean[]>([false, false, false, false, false, false, false, false]);

  // Rotary Dial Value (0 to 255)
  const [rotaryVal, setRotaryVal] = useState<number>(0);

  // 7-Segment Display Source
  const defaultDispSource = useMemo(() => {
    if (activeDesignId === "counter") return "count";
    if (activeDesignId === "hierarchy") return "accum_out";
    return "result";
  }, [activeDesignId]);

  const [dispSource, setDispSource] = useState<string>(defaultDispSource);

  // Available input and output ports
  const availableInputPorts = useMemo(() => {
    return state.signals.filter((s) => !s.name.includes("result") && !s.name.includes("flag") && !s.name.includes("out"));
  }, [state.signals]);

  const availableOutputPorts = useMemo(() => {
    return state.signals.filter((s) => s.name.includes("result") || s.name.includes("count") || s.name.includes("out") || s.name.includes("flag"));
  }, [state.signals]);

  // Convert DIP bits to numerical and hex value
  const dipValue = useMemo(() => {
    let val = 0;
    for (let i = 0; i < 8; i++) {
      if (dipBits[i]) val |= (1 << i);
    }
    return val;
  }, [dipBits]);

  // Handle DIP Switch Toggle
  const handleToggleDip = (bitIndex: number) => {
    const nextBits = [...dipBits];
    nextBits[bitIndex] = !nextBits[bitIndex];
    setDipBits(nextBits);

    let nextVal = 0;
    for (let i = 0; i < 8; i++) {
      if (nextBits[i]) nextVal |= (1 << i);
    }

    const hexStr = "0x" + nextVal.toString(16).padStart(2, "0");
    const binStr = nextVal.toString(2).padStart(8, "0");

    // Inject into targeted signal
    const targetSig = state.signals.find((s) => s.id === dipTargetPort || s.name.startsWith(dipTargetPort));
    if (targetSig) {
      const formattedVal = targetSig.width === 1 ? (nextBits[0] ? "1" : "0") : targetSig.width === 3 ? binStr.slice(-3) : hexStr;
      engineBridge.injectStimulus(targetSig.id, formattedVal);
    }
  };

  // DIP Presets
  const setAllDip = (allHigh: boolean) => {
    const next = Array(8).fill(allHigh);
    setDipBits(next);
    engineBridge.injectStimulus(dipTargetPort, allHigh ? "0xFF" : "0x00");
  };

  const invertDip = () => {
    const next = dipBits.map((b) => !b);
    setDipBits(next);
    let nextVal = 0;
    for (let i = 0; i < 8; i++) {
      if (next[i]) nextVal |= (1 << i);
    }
    engineBridge.injectStimulus(dipTargetPort, "0x" + nextVal.toString(16).padStart(2, "0"));
  };

  // Rotary Encoder Adjust
  const handleRotaryChange = (delta: number) => {
    const nextVal = Math.min(255, Math.max(0, rotaryVal + delta));
    setRotaryVal(nextVal);
    const hexStr = "0x" + nextVal.toString(16).padStart(2, "0");
    engineBridge.injectStimulus(dipTargetPort, hexStr);
  };

  // Tactical Button Actions
  const handleResetPress = () => {
    engineBridge.injectStimulus("rst_n", "0");
    setTimeout(() => {
      engineBridge.injectStimulus("rst_n", "1");
    }, 250);
  };

  const handleClockStep = () => {
    engineBridge.pulseSignal("clk");
  };

  // Resolve current logic value for 7-Segment Display
  const currentDispValue = useMemo(() => {
    const sig = state.signals.find((s) => s.id === dispSource || s.name.startsWith(dispSource));
    if (!sig) return { highDigit: "0", lowDigit: "0", numVal: 0 };

    const lastSample = sig.samples[sig.samples.length - 1];
    const rawVal = lastSample?.value ?? "0";
    const cleanHex = rawVal.replace("0x", "").replace("8'h", "").toUpperCase();
    const num = parseInt(cleanHex || "0", 16) || 0;

    const padded = cleanHex.padStart(2, "0");
    const highDigit = padded[padded.length - 2] ?? "0";
    const lowDigit = padded[padded.length - 1] ?? "0";

    return { highDigit, lowDigit, numVal: num };
  }, [dispSource, state.signals]);

  return (
    <div
      style={{
        flex: 1,
        backgroundColor: "var(--bg-primary)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden"
      }}
    >
      {/* Front Panel Header */}
      <div
        style={{
          height: 36,
          backgroundColor: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 14px",
          zIndex: 5
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-cyan)", textTransform: "uppercase" }}>
            Virtual Lab Stimulus Rack
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            DUT: <span style={{ color: "#fff", fontFamily: "var(--font-mono)" }}>{state.topModule}</span>
          </span>
          <div
            style={{
              fontSize: 10,
              padding: "1px 6px",
              borderRadius: 3,
              backgroundColor: "rgba(16, 185, 129, 0.12)",
              color: "var(--accent-emerald)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              display: "flex",
              alignItems: "center",
              gap: 4
            }}
          >
            <Zap size={10} />
            <span>Zero-JTAG In-RAM Stimulus Active</span>
          </div>
        </div>

        {/* Trigger Stimulus Painter Modal */}
        <button
          onClick={() => setIsPainterOpen(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 11,
            fontWeight: 600,
            padding: "3px 10px",
            borderRadius: "var(--radius-sm)",
            backgroundColor: "var(--accent-blue)",
            color: "#fff",
            border: "none",
            cursor: "pointer"
          }}
        >
          <Sparkles size={12} />
          <span>Paint Waveforms & Export TB</span>
        </button>
      </div>

      {/* Virtual Lab Modular Bays Container */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr 1fr 1.2fr",
          gap: 12,
          padding: 14,
          overflowY: "auto"
        }}
      >
        {/* ==================================================================== */}
        {/* BAY 1: 8-Bit DIP Switch Bank & Bus Injector                         */}
        {/* ==================================================================== */}
        <div
          style={{
            backgroundColor: "var(--bg-secondary)",
            border: "1px solid var(--border-medium)",
            borderRadius: 8,
            padding: 14,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.05)"
          }}
        >
          {/* Bay Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", textTransform: "uppercase" }}>
              8-Bit DIP Switch Array
            </div>
            {/* Target Port Selector */}
            <select
              value={dipTargetPort}
              onChange={(e) => setDipTargetPort(e.target.value)}
              style={{
                fontSize: 11,
                backgroundColor: "var(--bg-tertiary)",
                color: "var(--accent-cyan)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 4,
                padding: "2px 6px"
              }}
            >
              {availableInputPorts.map((p) => (
                <option key={p.id} value={p.id}>
                  Drive: {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Value HUD */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: "#070a0e",
              border: "1px solid var(--border-subtle)",
              borderRadius: 6,
              padding: "6px 12px",
              margin: "10px 0"
            }}
          >
            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Value:</div>
            <div style={{ display: "flex", gap: 8, fontFamily: "var(--font-mono)", fontSize: 12 }}>
              <span style={{ color: "var(--accent-cyan)", fontWeight: 700 }}>
                0x{dipValue.toString(16).padStart(2, "0").toUpperCase()}
              </span>
              <span style={{ color: "var(--accent-emerald)" }}>
                0b{dipValue.toString(2).padStart(8, "0")}
              </span>
              <span style={{ color: "var(--text-muted)" }}>
                ({dipValue})
              </span>
            </div>
          </div>

          {/* 8 Mechanical DIP Switches */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-around",
              backgroundColor: "#111722",
              padding: "12px 8px",
              borderRadius: 6,
              border: "1px solid var(--border-medium)"
            }}
          >
            {[7, 6, 5, 4, 3, 2, 1, 0].map((bitIdx) => {
              const isOn = dipBits[bitIdx];
              return (
                <div
                  key={bitIdx}
                  onClick={() => handleToggleDip(bitIdx)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    cursor: "pointer",
                    userSelect: "none"
                  }}
                >
                  <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                    [{bitIdx}]
                  </span>

                  {/* DIP Switch Housing */}
                  <div
                    style={{
                      width: 22,
                      height: 48,
                      backgroundColor: "#0a0d14",
                      border: "1px solid #1e293b",
                      borderRadius: 4,
                      padding: 2,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: isOn ? "flex-start" : "flex-end",
                      transition: "all 0.15s ease"
                    }}
                  >
                    {/* Switch Lever Handle */}
                    <div
                      style={{
                        height: 20,
                        backgroundColor: isOn ? "var(--accent-emerald)" : "#475569",
                        borderRadius: 2,
                        boxShadow: isOn
                          ? "0 0 8px rgba(16, 185, 129, 0.6), inset 0 1px 1px #fff"
                          : "inset 0 1px 1px rgba(255, 255, 255, 0.2)"
                      }}
                    />
                  </div>

                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      fontFamily: "var(--font-mono)",
                      color: isOn ? "var(--accent-emerald)" : "#64748b"
                    }}
                  >
                    {isOn ? "1" : "0"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Quick Preset Buttons */}
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <button
              onClick={() => setAllDip(false)}
              style={{ flex: 1, fontSize: 10, padding: "3px 0", backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)", borderRadius: 4, border: "1px solid var(--border-subtle)" }}
            >
              All 0s
            </button>
            <button
              onClick={() => setAllDip(true)}
              style={{ flex: 1, fontSize: 10, padding: "3px 0", backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)", borderRadius: 4, border: "1px solid var(--border-subtle)" }}
            >
              All 1s
            </button>
            <button
              onClick={invertDip}
              style={{ flex: 1, fontSize: 10, padding: "3px 0", backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)", borderRadius: 4, border: "1px solid var(--border-subtle)" }}
            >
              Invert
            </button>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* BAY 2: Tactical Pushbuttons & Pulsers                               */}
        {/* ==================================================================== */}
        <div
          style={{
            backgroundColor: "var(--bg-secondary)",
            border: "1px solid var(--border-medium)",
            borderRadius: 8,
            padding: 14,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between"
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", textTransform: "uppercase" }}>
            Tactile Controls
          </div>

          {/* Pushbuttons Container */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, margin: "auto 0" }}>
            {/* Reset Button (Red) */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>RESET (rst_n)</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Active-Low Strobe</div>
              </div>
              <button
                onClick={handleResetPress}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  backgroundColor: "#dc2626",
                  border: "3px solid #7f1d1d",
                  boxShadow: "0 0 12px rgba(220, 38, 38, 0.5), inset 0 2px 4px rgba(255, 255, 255, 0.4)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff"
                }}
                title="Pulse rst_n low"
              >
                <RotateCcw size={18} />
              </button>
            </div>

            {/* Clock Step Button (Blue) */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>STEP CLOCK</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>+1 Cycle (1000 ps)</div>
              </div>
              <button
                onClick={handleClockStep}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  backgroundColor: "var(--accent-blue)",
                  border: "3px solid #1e3a8a",
                  boxShadow: "0 0 12px rgba(37, 99, 235, 0.5), inset 0 2px 4px rgba(255, 255, 255, 0.4)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff"
                }}
                title="Single-step posedge clock"
              >
                <Play size={18} fill="#fff" />
              </button>
            </div>
          </div>

          <div style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center" }}>
            Instant sub-microsecond in-RAM stepping
          </div>
        </div>

        {/* ==================================================================== */}
        {/* BAY 3: Rotary Quadrature Hex Dial                                    */}
        {/* ==================================================================== */}
        <div
          style={{
            backgroundColor: "var(--bg-secondary)",
            border: "1px solid var(--border-medium)",
            borderRadius: 8,
            padding: 14,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <div style={{ width: "100%", fontSize: 11, fontWeight: 700, color: "#fff", textTransform: "uppercase" }}>
            Rotary Hex Encoder
          </div>

          {/* Rotary Dial Visualizer */}
          <div
            style={{
              width: 90,
              height: 90,
              borderRadius: "50%",
              backgroundColor: "#1e293b",
              border: "4px solid #334155",
              boxShadow: "inset 0 4px 8px rgba(0, 0, 0, 0.6), 0 4px 12px rgba(0, 0, 0, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              margin: "6px 0"
            }}
          >
            {/* Pointer notch */}
            <div
              style={{
                position: "absolute",
                width: 4,
                height: 18,
                backgroundColor: "var(--accent-cyan)",
                borderRadius: 2,
                top: 8,
                transformOrigin: "bottom center",
                transform: `rotate(${(rotaryVal / 255) * 300 - 150}deg)`
              }}
            />
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                fontWeight: 700,
                color: "#fff"
              }}
            >
              0x{rotaryVal.toString(16).padStart(2, "0").toUpperCase()}
            </div>
          </div>

          {/* Rotary Steppers */}
          <div style={{ display: "flex", gap: 6, width: "100%" }}>
            <button
              onClick={() => handleRotaryChange(-16)}
              style={{ flex: 1, fontSize: 10, padding: "3px 0", backgroundColor: "var(--bg-tertiary)", color: "#fff", borderRadius: 4, border: "1px solid var(--border-subtle)" }}
            >
              -16
            </button>
            <button
              onClick={() => handleRotaryChange(-1)}
              style={{ flex: 1, fontSize: 10, padding: "3px 0", backgroundColor: "var(--bg-tertiary)", color: "#fff", borderRadius: 4, border: "1px solid var(--border-subtle)" }}
            >
              -1
            </button>
            <button
              onClick={() => handleRotaryChange(1)}
              style={{ flex: 1, fontSize: 10, padding: "3px 0", backgroundColor: "var(--bg-tertiary)", color: "#fff", borderRadius: 4, border: "1px solid var(--border-subtle)" }}
            >
              +1
            </button>
            <button
              onClick={() => handleRotaryChange(16)}
              style={{ flex: 1, fontSize: 10, padding: "3px 0", backgroundColor: "var(--bg-tertiary)", color: "#fff", borderRadius: 4, border: "1px solid var(--border-subtle)" }}
            >
              +16
            </button>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* BAY 4: Dual Multi-Digit 7-Segment LED Displays                      */}
        {/* ==================================================================== */}
        <div
          style={{
            backgroundColor: "var(--bg-secondary)",
            border: "1px solid var(--border-medium)",
            borderRadius: 8,
            padding: 14,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", textTransform: "uppercase" }}>
              7-Segment Hex Display
            </div>
            {/* Monitor Source Selector */}
            <select
              value={dispSource}
              onChange={(e) => setDispSource(e.target.value)}
              style={{
                fontSize: 11,
                backgroundColor: "var(--bg-tertiary)",
                color: "var(--accent-emerald)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 4,
                padding: "2px 6px"
              }}
            >
              {availableOutputPorts.map((p) => (
                <option key={p.id} value={p.id}>
                  Monitor: {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Dual 7-Segment Render Frame */}
          <div
            style={{
              backgroundColor: "#05070a",
              border: "2px solid #1e293b",
              borderRadius: 6,
              padding: "10px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              margin: "auto 0"
            }}
          >
            {/* High Nibble Digit */}
            <SevenSegmentDigit hexChar={currentDispValue.highDigit} />

            {/* Low Nibble Digit */}
            <SevenSegmentDigit hexChar={currentDispValue.lowDigit} hasDot />
          </div>

          {/* 8-Bit SMD LED Bar Graph */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
            {[7, 6, 5, 4, 3, 2, 1, 0].map((b) => {
              const bitVal = (currentDispValue.numVal >> b) & 1;
              return (
                <div
                  key={b}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 3
                  }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      backgroundColor: bitVal ? "#10b981" : "#0f231c",
                      border: `1px solid ${bitVal ? "#34d399" : "#1e293b"}`,
                      boxShadow: bitVal ? "0 0 8px #10b981" : "none"
                    }}
                  />
                  <span style={{ fontSize: 8, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    {b}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Waveform Stimulus Painter Modal */}
      <StimulusPainterModal
        topModule={state.topModule}
        isOpen={isPainterOpen}
        onClose={() => setIsPainterOpen(false)}
      />
    </div>
  );
};

// Subcomponent: Authentic SVG 7-Segment LED Digit
const SevenSegmentDigit: React.FC<{ hexChar: string; hasDot?: boolean }> = ({ hexChar, hasDot }) => {
  const segs = SEVEN_SEG_HEX[hexChar.toUpperCase()] ?? [false, false, false, false, false, false, false];

  const onColor = "#ef4444";
  const offColor = "#260e0e";
  const glow = "drop-shadow(0px 0px 6px rgba(239, 68, 68, 0.8))";

  return (
    <svg width="44" height="68" viewBox="0 0 44 68" style={{ overflow: "visible" }}>
      {/* Segment A (Top) */}
      <polygon
        points="7,4 37,4 32,9 12,9"
        fill={segs[0] ? onColor : offColor}
        style={{ filter: segs[0] ? glow : "none" }}
      />
      {/* Segment B (Top-Right) */}
      <polygon
        points="38,5 38,32 33,29 33,10"
        fill={segs[1] ? onColor : offColor}
        style={{ filter: segs[1] ? glow : "none" }}
      />
      {/* Segment C (Bottom-Right) */}
      <polygon
        points="38,36 38,63 33,58 33,39"
        fill={segs[2] ? onColor : offColor}
        style={{ filter: segs[2] ? glow : "none" }}
      />
      {/* Segment D (Bottom) */}
      <polygon
        points="7,64 37,64 32,59 12,59"
        fill={segs[3] ? onColor : offColor}
        style={{ filter: segs[3] ? glow : "none" }}
      />
      {/* Segment E (Bottom-Left) */}
      <polygon
        points="6,36 11,39 11,58 6,63"
        fill={segs[4] ? onColor : offColor}
        style={{ filter: segs[4] ? glow : "none" }}
      />
      {/* Segment F (Top-Left) */}
      <polygon
        points="6,5 11,10 11,29 6,32"
        fill={segs[5] ? onColor : offColor}
        style={{ filter: segs[5] ? glow : "none" }}
      />
      {/* Segment G (Middle) */}
      <polygon
        points="9,34 13,31 31,31 35,34 31,37 13,37"
        fill={segs[6] ? onColor : offColor}
        style={{ filter: segs[6] ? glow : "none" }}
      />
      {/* Decimal Point (DP) */}
      {hasDot && (
        <circle
          cx="42"
          cy="62"
          r="3"
          fill={onColor}
          style={{ filter: glow }}
        />
      )}
    </svg>
  );
};
