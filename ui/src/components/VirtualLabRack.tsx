import React, { useState, useMemo, useEffect } from "react";
import {
  RotateCcw,
  Sparkles,
  Zap,
  Play,
  Terminal,
  Cpu,
  Radio,
  Gauge,
  Send,
  RefreshCw
} from "lucide-react";
import { SimulationState, engineBridge } from "../engine/engineBridge";
import { StimulusPainterModal } from "./StimulusPainterModal";
import { useTranslation } from "../i18n";
import { Select, SelectGroup } from "./ui";

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
  const { t } = useTranslation();
  const [isPainterOpen, setIsPainterOpen] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    return typeof window !== "undefined" ? window.innerWidth <= 768 : false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

  // Dynamic design states
  const [uartTxInput, setUartTxInput] = useState<string>("A");
  const [spiTxInput, setSpiTxInput] = useState<string>("0xA5");
  const [pwmDutyInput, setPwmDutyInput] = useState<number>(128);
  const [pwmDtInput, setPwmDtInput] = useState<number>(3);

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

  const dipPortGroups: SelectGroup[] = useMemo(() => [
    {
      label: "Input Ports",
      options: availableInputPorts.map((p) => ({
        value: p.id,
        label: `Drive: ${p.name}`,
        badge: `${p.width || 1}b`
      }))
    },
    ...(availableOutputPorts.length > 0
      ? [
          {
            label: "Other Ports",
            options: availableOutputPorts.map((p) => ({
              value: p.id,
              label: `Drive: ${p.name}`,
              badge: `${p.width || 1}b`
            }))
          }
        ]
      : [])
  ], [availableInputPorts, availableOutputPorts]);

  const dispPortGroups: SelectGroup[] = useMemo(() => [
    {
      label: "Output Ports",
      options: availableOutputPorts.map((p) => ({
        value: p.id,
        label: `Monitor: ${p.name}`,
        badge: `${p.width || 1}b`
      }))
    },
    ...(availableInputPorts.length > 0
      ? [
          {
            label: "Other Ports",
            options: availableInputPorts.map((p) => ({
              value: p.id,
              label: `Monitor: ${p.name}`,
              badge: `${p.width || 1}b`
            }))
          }
        ]
      : [])
  ], [availableInputPorts, availableOutputPorts]);

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

  const getSigVal = (id: string, defVal: string = "0") => {
    const s = state.signals.find(sig => sig.id === id || sig.name === id || sig.fullName.endsWith(`.${id}`));
    return s?.samples[s.samples.length - 1]?.value ?? defVal;
  };

  const handleUartSend = () => {
    const code = (uartTxInput.charCodeAt(0) || 0x41) & 0xFF;
    engineBridge.injectStimulus("tx_data", "0x" + code.toString(16).padStart(2, "0").toUpperCase());
    engineBridge.injectStimulus("tx_start", "1");
    setTimeout(() => engineBridge.injectStimulus("tx_start", "0"), 250);
  };

  const handleSpiSend = () => {
    engineBridge.injectStimulus("tx_byte", spiTxInput);
    engineBridge.injectStimulus("start", "1");
    setTimeout(() => engineBridge.injectStimulus("start", "0"), 250);
  };

  const handlePwmDutyChange = (val: number) => {
    setPwmDutyInput(val);
    engineBridge.injectStimulus("duty_cycle", "0x" + val.toString(16).padStart(2, "0").toUpperCase());
  };

  const handleRiscvStep = () => {
    engineBridge.pulseSignal("clk");
  };

  const handleRiscvReset = () => {
    engineBridge.injectStimulus("rst_n", "0");
    setTimeout(() => engineBridge.injectStimulus("rst_n", "1"), 250);
  };

  const renderLogicCircuitBays = () => {
    const sigA = getSigVal("A", "0") === "1";
    const sigB = getSigVal("B", "0") === "1";
    const sigC = getSigVal("C", "0") === "1";
    const sigW1 = getSigVal("w1", (!sigA ? "1" : "0")) === "1";
    const sigW2 = getSigVal("w2", (sigW1 && sigB ? "1" : "0")) === "1";
    const sigW3 = getSigVal("w3", (sigW2 && sigC ? "1" : "0")) === "1";
    const sigW4 = getSigVal("w4", (!sigB ? "1" : "0")) === "1";
    const sigF = getSigVal("F", (sigW3 || sigW4 ? "1" : "0")) === "1";

    const handleToggleInput = (name: "A" | "B" | "C", currentVal: boolean) => {
      const nextStr = currentVal ? "0" : "1";
      engineBridge.injectStimulus(name, nextStr);
    };

    const handleCycleAll = () => {
      const currentNum = (sigA ? 4 : 0) | (sigB ? 2 : 0) | (sigC ? 1 : 0);
      const nextNum = (currentNum + 1) % 8;
      engineBridge.injectStimulus("A", (nextNum & 4) ? "1" : "0");
      engineBridge.injectStimulus("B", (nextNum & 2) ? "1" : "0");
      engineBridge.injectStimulus("C", (nextNum & 1) ? "1" : "0");
    };

    const truthTable = [
      { a: 0, b: 0, c: 0, w1: 1, w2: 0, w3: 0, w4: 1, f: 1 },
      { a: 0, b: 0, c: 1, w1: 1, w2: 0, w3: 0, w4: 1, f: 1 },
      { a: 0, b: 1, c: 0, w1: 1, w2: 1, w3: 0, w4: 0, f: 0 },
      { a: 0, b: 1, c: 1, w1: 1, w2: 1, w3: 1, w4: 0, f: 1 },
      { a: 1, b: 0, c: 0, w1: 0, w2: 0, w3: 0, w4: 1, f: 1 },
      { a: 1, b: 0, c: 1, w1: 0, w2: 0, w3: 0, w4: 1, f: 1 },
      { a: 1, b: 1, c: 0, w1: 0, w2: 0, w3: 0, w4: 0, f: 0 },
      { a: 1, b: 1, c: 1, w1: 0, w2: 0, w3: 0, w4: 0, f: 0 },
    ];

    return (
      <>
        {/* BAY 1: Primary Logic Inputs A, B, C */}
        <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-medium)", borderRadius: 8, padding: 14, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", textTransform: "uppercase", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Zap size={14} color="var(--accent-emerald)" />
              <span>{t("virtualLab.inputsGroup")} (A, B, C)</span>
            </div>
            <button
              onClick={handleCycleAll}
              className="btn btn-secondary"
              style={{ fontSize: 11, padding: "2px 8px", color: "var(--accent-cyan)" }}
              title="Cycle through truth table 000 -> 111"
            >
              {t("common.cycle")}
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, margin: "14px 0" }}>
            {[
              { label: "Input A (SW0)", name: "A" as const, val: sigA, color: "var(--accent-blue)" },
              { label: "Input B (SW1)", name: "B" as const, val: sigB, color: "var(--accent-amber)" },
              { label: "Input C (SW2)", name: "C" as const, val: sigC, color: "var(--accent-purple)" }
            ].map(item => (
              <div
                key={item.name}
                onClick={() => handleToggleInput(item.name, item.val)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: isMobile ? "12px 14px" : "8px 12px",
                  minHeight: isMobile ? 44 : 38,
                  borderRadius: 6,
                  backgroundColor: item.val ? "rgba(59, 130, 246, 0.15)" : "var(--bg-tertiary)",
                  border: `1px solid ${item.val ? item.color : "var(--border-subtle)"}`,
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: item.val ? "var(--accent-emerald)" : "var(--text-muted)", boxShadow: item.val ? "0 0 8px var(--accent-emerald)" : "none" }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{item.label}</span>
                </div>
                <span className="mono-num" style={{ fontSize: 13, fontWeight: 700, color: item.val ? "var(--accent-emerald)" : "var(--text-muted)" }}>
                  {item.val ? "1 (HIGH)" : "0 (LOW)"}
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => { engineBridge.injectStimulus("A", "0"); engineBridge.injectStimulus("B", "0"); engineBridge.injectStimulus("C", "0"); }}
              className="btn btn-secondary"
              style={{ flex: 1, padding: "6px 0", fontSize: 11, justifyContent: "center" }}
            >
              {t("common.all0s")}
            </button>
            <button
              onClick={() => { engineBridge.injectStimulus("A", "1"); engineBridge.injectStimulus("B", "1"); engineBridge.injectStimulus("C", "1"); }}
              className="btn btn-secondary"
              style={{ flex: 1, padding: "6px 0", fontSize: 11, justifyContent: "center" }}
            >
              {t("common.all1s")}
            </button>
          </div>
        </div>

        {/* BAY 2: Intermediate Net Probes (w1, w2, w3, w4) */}
        <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-medium)", borderRadius: 8, padding: 14, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
            <Cpu size={14} color="var(--accent-cyan)" />
            <span>{t("virtualLab.gateProbes")}</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "10px 0" }}>
            {[
              { label: "w1 = ~A", op: "NOT", val: sigW1 },
              { label: "w2 = w1 & B", op: "AND", val: sigW2 },
              { label: "w3 = w2 & C", op: "AND", val: sigW3 },
              { label: "w4 = ~B", op: "NOT", val: sigW4 }
            ].map((probe, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 10px",
                  borderRadius: 5,
                  backgroundColor: "var(--bg-tertiary)",
                  border: "1px solid var(--border-subtle)"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, backgroundColor: "rgba(6, 182, 212, 0.15)", color: "var(--accent-cyan)", fontWeight: 700 }}>
                    {probe.op}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{probe.label}</span>
                </div>
                <span className="mono-num" style={{ fontSize: 12, fontWeight: 700, color: probe.val ? "var(--accent-emerald)" : "var(--text-muted)" }}>
                  {probe.val ? "1" : "0"}
                </span>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center" }}>
            Real-time zero-time gate evaluation
          </div>
        </div>

        {/* BAY 3: Circuit Output F */}
        <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-medium)", borderRadius: 8, padding: 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ width: "100%", fontSize: 12, fontWeight: 700, color: "#fff", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
            <Radio size={14} color="var(--accent-rose)" />
            <span>{t("virtualLab.circuitOutput")}</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, margin: "14px 0" }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                backgroundColor: sigF ? "var(--accent-emerald)" : "#1e293b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: sigF ? "0 0 28px rgba(16, 185, 129, 0.6)" : "inset 0 2px 4px rgba(0,0,0,0.5)",
                border: `3px solid ${sigF ? "#34d399" : "#334155"}`,
                transition: "all 0.2s ease"
              }}
            >
              <span className="mono-num" style={{ fontSize: 24, fontWeight: 900, color: sigF ? "#fff" : "var(--text-muted)" }}>
                {sigF ? "1" : "0"}
              </span>
            </div>

            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: sigF ? "var(--accent-emerald)" : "var(--text-muted)" }}>
                {sigF ? t("virtualLab.outputActive") : t("virtualLab.outputInactive")}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>
                Pin H17 • LD0
              </div>
            </div>
          </div>

          <div style={{ width: "100%", padding: "6px 8px", backgroundColor: "var(--bg-tertiary)", borderRadius: 4, textAlign: "center", fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            F = ((~A & B) & C) | ~B
          </div>
        </div>

        {/* BAY 4: Interactive Truth Table HUD */}
        <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-medium)", borderRadius: 8, padding: 12, display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <Sparkles size={14} color="var(--accent-amber)" />
            <span>{t("virtualLab.truthTableTitle")}</span>
          </div>

          <div style={{ fontSize: 11, fontFamily: "var(--font-mono)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "24px 24px 24px 1fr 24px", gap: 4, padding: "2px 4px", borderBottom: "1px solid var(--border-subtle)", color: "var(--text-muted)", fontWeight: 700 }}>
              <span>A</span>
              <span>B</span>
              <span>C</span>
              <span style={{ textAlign: "center" }}>w1..w4</span>
              <span style={{ textAlign: "right" }}>F</span>
            </div>
            {truthTable.map((row, idx) => {
              const isMatch = (row.a === (sigA ? 1 : 0)) && (row.b === (sigB ? 1 : 0)) && (row.c === (sigC ? 1 : 0));
              return (
                <div
                  key={idx}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "24px 24px 24px 1fr 24px",
                    gap: 4,
                    padding: "3px 4px",
                    margin: "1px 0",
                    borderRadius: 3,
                    backgroundColor: isMatch ? "rgba(6, 182, 212, 0.2)" : "transparent",
                    color: isMatch ? "#fff" : "var(--text-secondary)",
                    fontWeight: isMatch ? 700 : 400,
                    border: isMatch ? "1px solid var(--accent-cyan)" : "1px solid transparent"
                  }}
                >
                  <span style={{ color: isMatch ? "var(--accent-cyan)" : undefined }}>{row.a}</span>
                  <span style={{ color: isMatch ? "var(--accent-cyan)" : undefined }}>{row.b}</span>
                  <span style={{ color: isMatch ? "var(--accent-cyan)" : undefined }}>{row.c}</span>
                  <span style={{ textAlign: "center", fontSize: 10, opacity: isMatch ? 1 : 0.6 }}>{row.w1}{row.w2}{row.w3}{row.w4}</span>
                  <span style={{ textAlign: "right", color: row.f ? "var(--accent-emerald)" : "var(--text-muted)", fontWeight: 700 }}>{row.f}</span>
                </div>
              );
            })}
          </div>
        </div>
      </>
    );
  };

  const renderUartBays = () => {
    const rxDataVal = getSigVal("rx_data", "0x00");
    const rxNum = parseInt(rxDataVal.replace("0x", ""), 16) || 0;
    const rxChar = (rxNum >= 32 && rxNum <= 126) ? String.fromCharCode(rxNum) : ".";
    const txBusy = getSigVal("tx_busy") === "1";
    const txDone = getSigVal("tx_done") === "1";
    const rxReady = getSigVal("rx_ready") === "1";
    const rxError = getSigVal("rx_error") === "1";
    const txSerial = getSigVal("tx_serial", "1");
    const rxSerial = getSigVal("rx_serial", "1");

    return (
      <>
        {/* BAY 1: UART Transmitter */}
        <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-medium)", borderRadius: 8, padding: 14, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
            <Terminal size={14} color="var(--accent-cyan)" />
            <span>UART Transmitter</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "12px 0" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Transmit Character / ASCII:</div>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="text"
                maxLength={1}
                value={uartTxInput}
                onChange={(e) => setUartTxInput(e.target.value)}
                style={{ width: 44, textAlign: "center", fontSize: 16, fontWeight: 700, backgroundColor: "#070a0e", border: "1px solid var(--border-medium)", color: "var(--accent-cyan)", borderRadius: 4 }}
              />
              <button
                onClick={handleUartSend}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "var(--accent-blue)", color: "#fff", border: "none", borderRadius: 4, fontWeight: 600, fontSize: 11, cursor: "pointer" }}
              >
                <Send size={12} />
                <span>Send Byte</span>
              </button>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: txBusy ? "var(--accent-amber)" : "#222" }} />
              <span style={{ color: txBusy ? "var(--accent-amber)" : "var(--text-muted)" }}>TX Busy</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: txDone ? "var(--accent-emerald)" : "#222" }} />
              <span style={{ color: txDone ? "var(--accent-emerald)" : "var(--text-muted)" }}>TX Done</span>
            </span>
          </div>
        </div>

        {/* BAY 2: UART Receiver */}
        <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-medium)", borderRadius: 8, padding: 14, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
            <Radio size={14} color="var(--accent-emerald)" />
            <span>UART Receiver</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 75, backgroundColor: "#070a0e", border: "1px solid var(--border-subtle)", borderRadius: 6, margin: "8px 0" }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: "var(--accent-emerald)", fontFamily: "var(--font-mono)" }}>
              '{rxChar}'
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              Hex: {rxDataVal}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: rxReady ? "var(--accent-emerald)" : "#222" }} />
              <span style={{ color: rxReady ? "var(--accent-emerald)" : "var(--text-muted)" }}>RX Ready</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: rxError ? "var(--accent-rose)" : "#222" }} />
              <span style={{ color: rxError ? "var(--accent-rose)" : "var(--text-muted)" }}>Frame Err</span>
            </span>
          </div>
        </div>

        {/* BAY 3: Serial Physical Line */}
        <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-medium)", borderRadius: 8, padding: 14, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", textTransform: "uppercase" }}>
            Line Activity
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "10px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", backgroundColor: "#070a0e", borderRadius: 4 }}>
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>tx_serial:</span>
              <span style={{ fontWeight: 700, fontFamily: "var(--font-mono)", color: txSerial === "1" ? "var(--accent-emerald)" : "var(--accent-rose)" }}>
                {txSerial} ({txSerial === "1" ? "MARK" : "SPACE"})
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", backgroundColor: "#070a0e", borderRadius: 4 }}>
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>rx_serial:</span>
              <span style={{ fontWeight: 700, fontFamily: "var(--font-mono)", color: rxSerial === "1" ? "var(--accent-emerald)" : "var(--accent-rose)" }}>
                {rxSerial} ({rxSerial === "1" ? "MARK" : "SPACE"})
              </span>
            </div>
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
            8-N-1 (1 Start, 8 Data, 1 Stop)
          </div>
        </div>

        {/* BAY 4: Baud Prescaler */}
        <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-medium)", borderRadius: 8, padding: 14, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", textTransform: "uppercase" }}>
            Protocol Controls
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: "8px 0" }}>
            <button
              onClick={() => {
                const chars = ["A", "X", "I", "O", "M"];
                let idx = 0;
                const itv = setInterval(() => {
                  if (idx >= chars.length) { clearInterval(itv); return; }
                  const code = chars[idx].charCodeAt(0);
                  engineBridge.injectStimulus("tx_data", "0x" + code.toString(16).padStart(2, "0").toUpperCase());
                  engineBridge.injectStimulus("tx_start", "1");
                  setTimeout(() => engineBridge.injectStimulus("tx_start", "0"), 120);
                  idx++;
                }, 350);
              }}
              style={{ padding: "6px", backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-medium)", color: "var(--accent-purple)", borderRadius: 4, fontWeight: 600, fontSize: 11, cursor: "pointer" }}
            >
              Stream "AXIOM" String
            </button>
            <button
              onClick={() => {
                engineBridge.injectStimulus("rst_n", "0");
                setTimeout(() => engineBridge.injectStimulus("rst_n", "1"), 200);
              }}
              style={{ padding: "6px", backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-medium)", color: "var(--text-secondary)", borderRadius: 4, fontSize: 11, cursor: "pointer" }}
            >
              Reset Transceiver (rst_n)
            </button>
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
            Baud Rate: 115200 (4 cycles/baud)
          </div>
        </div>
      </>
    );
  };

  const renderSpiBays = () => {
    const sck = getSigVal("sck");
    const csN = getSigVal("cs_n", "1");
    const mosi = getSigVal("mosi");
    const miso = getSigVal("miso");
    const spiBusy = getSigVal("busy") === "1";
    const spiDone = getSigVal("done") === "1";
    const rxByte = getSigVal("rx_byte", "0x00");

    return (
      <>
        {/* BAY 1: SPI Master Config */}
        <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-medium)", borderRadius: 8, padding: 14, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
            <Cpu size={14} color="var(--accent-cyan)" />
            <span>SPI Master Config</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "12px 0" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Mode: Mode 0 (CPOL=0, CPHA=0)</div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => {
                  engineBridge.injectStimulus("cpol", "0");
                  engineBridge.injectStimulus("cpha", "0");
                }}
                style={{ flex: 1, padding: "4px", backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-subtle)", borderRadius: 4, fontSize: 10, color: "var(--accent-cyan)", cursor: "pointer" }}
              >
                Mode 0
              </button>
              <button
                onClick={() => {
                  engineBridge.injectStimulus("cpol", "1");
                  engineBridge.injectStimulus("cpha", "1");
                }}
                style={{ flex: 1, padding: "4px", backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-subtle)", borderRadius: 4, fontSize: 10, color: "var(--accent-purple)", cursor: "pointer" }}
              >
                Mode 3
              </button>
            </div>
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
            Clock Prescaler: div_by_4
          </div>
        </div>

        {/* BAY 2: SPI Transfer */}
        <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-medium)", borderRadius: 8, padding: 14, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", textTransform: "uppercase" }}>
            Transfer Controller
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "10px 0" }}>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="text"
                value={spiTxInput}
                onChange={(e) => setSpiTxInput(e.target.value)}
                style={{ width: 60, textAlign: "center", fontSize: 12, fontFamily: "var(--font-mono)", backgroundColor: "#070a0e", border: "1px solid var(--border-medium)", color: "var(--accent-cyan)", borderRadius: 4 }}
              />
              <button
                onClick={handleSpiSend}
                style={{ flex: 1, backgroundColor: "var(--accent-blue)", color: "#fff", border: "none", borderRadius: 4, fontWeight: 600, fontSize: 11, cursor: "pointer" }}
              >
                Transfer
              </button>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: spiBusy ? "var(--accent-amber)" : "#222" }} />
              <span style={{ color: spiBusy ? "var(--accent-amber)" : "var(--text-muted)" }}>Busy</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: spiDone ? "var(--accent-emerald)" : "#222" }} />
              <span style={{ color: spiDone ? "var(--accent-emerald)" : "var(--text-muted)" }}>Done</span>
            </span>
          </div>
        </div>

        {/* BAY 3: Bus Monitor */}
        <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-medium)", borderRadius: 8, padding: 14, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", textTransform: "uppercase" }}>
            Physical SPI Bus
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, margin: "8px 0" }}>
            <div style={{ padding: "4px 8px", backgroundColor: "#070a0e", borderRadius: 4, fontSize: 11, display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>SCK:</span>
              <span style={{ fontWeight: 700, fontFamily: "var(--font-mono)", color: sck === "1" ? "var(--accent-cyan)" : "#64748b" }}>{sck}</span>
            </div>
            <div style={{ padding: "4px 8px", backgroundColor: "#070a0e", borderRadius: 4, fontSize: 11, display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>CS#:</span>
              <span style={{ fontWeight: 700, fontFamily: "var(--font-mono)", color: csN === "0" ? "var(--accent-emerald)" : "#64748b" }}>{csN}</span>
            </div>
            <div style={{ padding: "4px 8px", backgroundColor: "#070a0e", borderRadius: 4, fontSize: 11, display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>MOSI:</span>
              <span style={{ fontWeight: 700, fontFamily: "var(--font-mono)", color: mosi === "1" ? "var(--accent-amber)" : "#64748b" }}>{mosi}</span>
            </div>
            <div style={{ padding: "4px 8px", backgroundColor: "#070a0e", borderRadius: 4, fontSize: 11, display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>MISO:</span>
              <span style={{ fontWeight: 700, fontFamily: "var(--font-mono)", color: miso === "1" ? "var(--accent-purple)" : "#64748b" }}>{miso}</span>
            </div>
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
            Full-Duplex Synchronous Serial
          </div>
        </div>

        {/* BAY 4: Received Data */}
        <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-medium)", borderRadius: 8, padding: 14, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", textTransform: "uppercase" }}>
            Received Buffer
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 60, backgroundColor: "#070a0e", border: "1px solid var(--border-subtle)", borderRadius: 6, margin: "8px 0" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--accent-cyan)", fontFamily: "var(--font-mono)" }}>
              {rxByte}
            </div>
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
            8-Bit Shift Register Latch
          </div>
        </div>
      </>
    );
  };

  const renderPwmBays = () => {
    const pwmHigh = getSigVal("pwm_high") === "1";
    const pwmLow = getSigVal("pwm_low") === "1";
    const periodCnt = getSigVal("period_count", "0x00");
    const cycleSync = getSigVal("cycle_sync") === "1";

    return (
      <>
        {/* BAY 1: Duty Cycle Fader */}
        <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-medium)", borderRadius: 8, padding: 14, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
            <Gauge size={14} color="var(--accent-amber)" />
            <span>Duty Cycle Control</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "10px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: "var(--text-muted)" }}>Duty:</span>
              <span style={{ fontWeight: 700, color: "var(--accent-amber)", fontFamily: "var(--font-mono)" }}>
                {((pwmDutyInput / 256) * 100).toFixed(1)}% (0x{pwmDutyInput.toString(16).toUpperCase()})
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={255}
              value={pwmDutyInput}
              onChange={(e) => handlePwmDutyChange(parseInt(e.target.value))}
              style={{ width: "100%", accentColor: "var(--accent-amber)", cursor: "pointer" }}
            />
            <div style={{ display: "flex", gap: 4 }}>
              {[64, 128, 192].map((v) => (
                <button
                  key={v}
                  onClick={() => handlePwmDutyChange(v)}
                  style={{ flex: 1, padding: "3px", backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-subtle)", borderRadius: 4, fontSize: 10, color: "var(--text-secondary)", cursor: "pointer" }}
                >
                  {((v / 256) * 100).toFixed(0)}%
                </button>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
            8-Bit Resolution (0..255)
          </div>
        </div>

        {/* BAY 2: Half-Bridge Gate Drivers */}
        <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-medium)", borderRadius: 8, padding: 14, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", textTransform: "uppercase" }}>
            Gate Driver Outputs
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "10px 0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", backgroundColor: "#070a0e", borderRadius: 6 }}>
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>High-Side (HS):</span>
              <span style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: pwmHigh ? "var(--accent-emerald)" : "#222", boxShadow: pwmHigh ? "0 0 10px #10b981" : "none" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", backgroundColor: "#070a0e", borderRadius: 6 }}>
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Low-Side (LS):</span>
              <span style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: pwmLow ? "var(--accent-cyan)" : "#222", boxShadow: pwmLow ? "0 0 10px #06b6d4" : "none" }} />
            </div>
          </div>
          <div style={{ fontSize: 10, color: (pwmHigh && pwmLow) ? "var(--accent-rose)" : "var(--accent-emerald)" }}>
            {(pwmHigh && pwmLow) ? "CRITICAL: Shoot-Through Overlap!" : "Break-Before-Make Verified"}
          </div>
        </div>

        {/* BAY 3: Dead-Time Adjuster */}
        <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-medium)", borderRadius: 8, padding: 14, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", textTransform: "uppercase" }}>
            Dead-Time Safety
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: "10px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
              <span style={{ color: "var(--text-muted)" }}>Dead-Time:</span>
              <span style={{ fontWeight: 700, color: "var(--accent-cyan)", fontFamily: "var(--font-mono)" }}>
                {pwmDtInput} clock cycles
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={8}
              value={pwmDtInput}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                setPwmDtInput(v);
                engineBridge.injectStimulus("dead_time", "0x" + v.toString(16));
              }}
              style={{ width: "100%", accentColor: "var(--accent-cyan)", cursor: "pointer" }}
            />
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
            Prevents Half-Bridge Cross-Conduction
          </div>
        </div>

        {/* BAY 4: Period Sync */}
        <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-medium)", borderRadius: 8, padding: 14, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", textTransform: "uppercase" }}>
            Period Counter
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 60, backgroundColor: "#070a0e", border: "1px solid var(--border-subtle)", borderRadius: 6, margin: "8px 0" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--accent-purple)", fontFamily: "var(--font-mono)" }}>
              {periodCnt}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
            <span style={{ color: "var(--text-muted)" }}>Cycle Sync:</span>
            <span style={{ fontWeight: 700, color: cycleSync ? "var(--accent-emerald)" : "#64748b" }}>
              {cycleSync ? "PULSE" : "IDLE"}
            </span>
          </div>
        </div>
      </>
    );
  };

  const renderRiscvBays = () => {
    const pc = getSigVal("pc", "0x00000000");
    const instr = getSigVal("instr", "0x00000013");
    const aluRes = getSigVal("alu_result", "0x00000000");
    const regX1 = getSigVal("reg_x1", "0x00000000");
    const regX2 = getSigVal("reg_x2", "0x00000000");
    const branchTaken = getSigVal("branch_taken") === "1";

    let mnemonic = "nop";
    if (instr === "0x00500093") mnemonic = "addi x1, x0, 5";
    else if (instr === "0x00A00113") mnemonic = "addi x2, x0, 10";
    else if (instr === "0x002081B3") mnemonic = "add x3, x1, x2";
    else if (instr === "0x40110233") mnemonic = "sub x4, x2, x1";
    else if (instr === "0x0020C2B3") mnemonic = "xor x5, x1, x2";
    else if (instr === "0x0010E333") mnemonic = "or x6, x1, x2";
    else if (instr === "0x0020F3B3") mnemonic = "and x7, x1, x2";
    else if (instr === "0x0000006F") mnemonic = "jal x0, loop";

    return (
      <>
        {/* BAY 1: Execution Control */}
        <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-medium)", borderRadius: 8, padding: 14, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
            <Cpu size={14} color="var(--accent-cyan)" />
            <span>RV32I Core Stepper</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "10px 0" }}>
            <button
              onClick={handleRiscvStep}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px", backgroundColor: "var(--accent-blue)", color: "#fff", border: "none", borderRadius: 4, fontWeight: 600, fontSize: 11, cursor: "pointer" }}
            >
              <Play size={12} />
              <span>Step Clock Cycle</span>
            </button>
            <button
              onClick={handleRiscvReset}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "6px", backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)", borderRadius: 4, fontSize: 11, cursor: "pointer" }}
            >
              <RefreshCw size={12} />
              <span>Reset Core (rst_n)</span>
            </button>
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
            Single-Cycle RV32I Datapath
          </div>
        </div>

        {/* BAY 2: Program Counter & ROM */}
        <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-medium)", borderRadius: 8, padding: 14, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", textTransform: "uppercase" }}>
            Instruction ROM
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: "8px 0" }}>
            <div style={{ padding: "4px 8px", backgroundColor: "#070a0e", borderRadius: 4, display: "flex", justifyContent: "space-between", fontSize: 11 }}>
              <span style={{ color: "var(--text-muted)" }}>PC:</span>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent-cyan)", fontWeight: 700 }}>{pc}</span>
            </div>
            <div style={{ padding: "6px 8px", backgroundColor: "#070a0e", borderRadius: 4, display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Mnemonic:</span>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent-emerald)", fontWeight: 700, fontSize: 12 }}>
                {mnemonic}
              </span>
            </div>
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            Raw: {instr}
          </div>
        </div>

        {/* BAY 3: Register File matrix */}
        <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-medium)", borderRadius: 8, padding: 14, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", textTransform: "uppercase" }}>
            Register File (x1..x2)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: "8px 0" }}>
            <div style={{ padding: "4px 8px", backgroundColor: "#070a0e", borderRadius: 4, display: "flex", justifyContent: "space-between", fontSize: 11 }}>
              <span style={{ color: "var(--text-muted)" }}>x1 (reg_x1):</span>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent-amber)", fontWeight: 700 }}>{regX1}</span>
            </div>
            <div style={{ padding: "4px 8px", backgroundColor: "#070a0e", borderRadius: 4, display: "flex", justifyContent: "space-between", fontSize: 11 }}>
              <span style={{ color: "var(--text-muted)" }}>x2 (reg_x2):</span>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent-purple)", fontWeight: 700 }}>{regX2}</span>
            </div>
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
            Dual-Read Single-Write Register File
          </div>
        </div>

        {/* BAY 4: ALU & Branch */}
        <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-medium)", borderRadius: 8, padding: 14, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", textTransform: "uppercase" }}>
            ALU Execution
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 60, backgroundColor: "#070a0e", border: "1px solid var(--border-subtle)", borderRadius: 6, margin: "8px 0" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--accent-blue)", fontFamily: "var(--font-mono)" }}>
              {aluRes}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
            <span style={{ color: "var(--text-muted)" }}>Branch Taken:</span>
            <span style={{ fontWeight: 700, color: branchTaken ? "var(--accent-emerald)" : "#64748b" }}>
              {branchTaken ? "YES" : "NO"}
            </span>
          </div>
        </div>
      </>
    );
  };

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
          padding: "0 10px",
          zIndex: 5,
          flexShrink: 0
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--accent-amber)",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              letterSpacing: "0.03em"
            }}
          >
            {isMobile ? "Virtual Lab" : "Virtual Lab Stimulus Rack"}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>•</span>
          <span
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: "var(--text-primary)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}
          >
            DUT: <strong style={{ color: "#fff" }}>{state.topModule}</strong>
          </span>
          {!isMobile && (
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
                gap: 4,
                whiteSpace: "nowrap"
              }}
            >
              <Zap size={10} />
              <span>Zero-JTAG In-RAM Stimulus Active</span>
            </div>
          )}
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
            padding: "3px 9px",
            borderRadius: "var(--radius-sm)",
            backgroundColor: "var(--accent-blue)",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            whiteSpace: "nowrap",
            flexShrink: 0
          }}
        >
          <Sparkles size={12} />
          <span>{isMobile ? "Paint TB" : "Paint Waveforms & Export TB"}</span>
        </button>
      </div>

      {/* Virtual Lab Modular Bays Container */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 14,
          padding: 14,
          paddingBottom: isMobile ? 32 : 14,
          overflowY: "auto"
        }}
      >
        {(activeDesignId === "logic_circuit" || activeDesignId.includes("logic_circuit")) && renderLogicCircuitBays()}
        {activeDesignId === "uart" && renderUartBays()}
        {activeDesignId === "spi" && renderSpiBays()}
        {activeDesignId === "pwm" && renderPwmBays()}
        {activeDesignId === "riscv" && renderRiscvBays()}

        {!["uart", "spi", "pwm", "riscv", "logic_circuit"].some(k => activeDesignId.includes(k)) && (
          <>
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
            {/* Target Port Custom Selector */}
            <Select
              size="xs"
              align="right"
              value={dipTargetPort}
              onChange={setDipTargetPort}
              groups={dipPortGroups}
              buttonStyle={{
                fontSize: 11,
                color: "var(--accent-cyan)",
                borderColor: "rgba(6, 182, 212, 0.3)",
                height: 24,
                padding: "2px 7px"
              }}
            />
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
            {/* Custom Monitor Source Selector */}
            <Select
              size="xs"
              align="right"
              value={dispSource}
              onChange={setDispSource}
              groups={dispPortGroups}
              buttonStyle={{
                fontSize: 11,
                color: "var(--accent-emerald)",
                borderColor: "rgba(16, 185, 129, 0.3)",
                height: 24,
                padding: "2px 7px"
              }}
            />
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
      </>
    )}
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
