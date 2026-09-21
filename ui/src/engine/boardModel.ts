// Axiom EDA — Authentic Digilent FPGA Board Hardware Emulation Model
// Defines physical pinouts, parses XDC constraints, and binds physical board peripherals to simulated nets

import type { SimulationState } from "./engineBridge";
import { engineBridge } from "./engineBridge";

export type BoardType = "basys-3" | "nexys-a7";

export type PeripheralType =
  | "switch"
  | "led"
  | "button"
  | "seven_seg_ca"
  | "seven_seg_an"
  | "clock";

export interface BoardPinDef {
  id: string; // e.g. "SW0", "LD0", "BTNC", "CA", "AN0"
  type: PeripheralType;
  label: string;
  pin: string; // Physical FPGA pin e.g. "V17"
  index?: number;
  description?: string;
}

export interface PortRef {
  rawPort: string;
  baseName: string;
  bitIndex?: number;
  isVector: boolean;
}

export interface BoardPeripheralState {
  id: string;
  type: PeripheralType;
  label: string;
  pin: string;
  index?: number;
  portRef?: PortRef;
  isBound: boolean;
  value: number; // 0 or 1
}

export interface SevenSegDisplayState {
  digits: boolean[][]; // 4 digits, each has 8 booleans [a, b, c, d, e, f, g, dp]
  anodesActive: boolean[]; // 4 anodes active
}

// --------------------------------------------------------------------------
// 1. Digilent Basys 3 (Artix-7 XC7A35T-CPG236C) Pinout
// --------------------------------------------------------------------------
export const BASYS3_PINS: BoardPinDef[] = [
  // 16 Sliding DIP Switches
  { id: "SW0", type: "switch", label: "SW0", pin: "V17", index: 0, description: "Slide Switch 0" },
  { id: "SW1", type: "switch", label: "SW1", pin: "V16", index: 1, description: "Slide Switch 1" },
  { id: "SW2", type: "switch", label: "SW2", pin: "W16", index: 2, description: "Slide Switch 2" },
  { id: "SW3", type: "switch", label: "SW3", pin: "W17", index: 3, description: "Slide Switch 3" },
  { id: "SW4", type: "switch", label: "SW4", pin: "W15", index: 4, description: "Slide Switch 4" },
  { id: "SW5", type: "switch", label: "SW5", pin: "V15", index: 5, description: "Slide Switch 5" },
  { id: "SW6", type: "switch", label: "SW6", pin: "W14", index: 6, description: "Slide Switch 6" },
  { id: "SW7", type: "switch", label: "SW7", pin: "W13", index: 7, description: "Slide Switch 7" },
  { id: "SW8", type: "switch", label: "SW8", pin: "V2", index: 8, description: "Slide Switch 8" },
  { id: "SW9", type: "switch", label: "SW9", pin: "T3", index: 9, description: "Slide Switch 9" },
  { id: "SW10", type: "switch", label: "SW10", pin: "T2", index: 10, description: "Slide Switch 10" },
  { id: "SW11", type: "switch", label: "SW11", pin: "R3", index: 11, description: "Slide Switch 11" },
  { id: "SW12", type: "switch", label: "SW12", pin: "W2", index: 12, description: "Slide Switch 12" },
  { id: "SW13", type: "switch", label: "SW13", pin: "U1", index: 13, description: "Slide Switch 13" },
  { id: "SW14", type: "switch", label: "SW14", pin: "T1", index: 14, description: "Slide Switch 14" },
  { id: "SW15", type: "switch", label: "SW15", pin: "R2", index: 15, description: "Slide Switch 15" },

  // 16 High-Brightness Green LEDs
  { id: "LD0", type: "led", label: "LD0", pin: "U16", index: 0, description: "Output LED 0" },
  { id: "LD1", type: "led", label: "LD1", pin: "E19", index: 1, description: "Output LED 1" },
  { id: "LD2", type: "led", label: "LD2", pin: "U19", index: 2, description: "Output LED 2" },
  { id: "LD3", type: "led", label: "LD3", pin: "V19", index: 3, description: "Output LED 3" },
  { id: "LD4", type: "led", label: "LD4", pin: "W18", index: 4, description: "Output LED 4" },
  { id: "LD5", type: "led", label: "LD5", pin: "U15", index: 5, description: "Output LED 5" },
  { id: "LD6", type: "led", label: "LD6", pin: "U14", index: 6, description: "Output LED 6" },
  { id: "LD7", type: "led", label: "LD7", pin: "V14", index: 7, description: "Output LED 7" },
  { id: "LD8", type: "led", label: "LD8", pin: "V13", index: 8, description: "Output LED 8" },
  { id: "LD9", type: "led", label: "LD9", pin: "V3", index: 9, description: "Output LED 9" },
  { id: "LD10", type: "led", label: "LD10", pin: "W3", index: 10, description: "Output LED 10" },
  { id: "LD11", type: "led", label: "LD11", pin: "U3", index: 11, description: "Output LED 11" },
  { id: "LD12", type: "led", label: "LD12", pin: "P3", index: 12, description: "Output LED 12" },
  { id: "LD13", type: "led", label: "LD13", pin: "N3", index: 13, description: "Output LED 13" },
  { id: "LD14", type: "led", label: "LD14", pin: "P1", index: 14, description: "Output LED 14" },
  { id: "LD15", type: "led", label: "LD15", pin: "L1", index: 15, description: "Output LED 15" },

  // 5 Push Buttons (Directional Pad + Center)
  { id: "BTNC", type: "button", label: "BTNC", pin: "U18", description: "Center Push Button (Reset)" },
  { id: "BTNU", type: "button", label: "BTNU", pin: "T18", description: "Up Push Button" },
  { id: "BTNL", type: "button", label: "BTNL", pin: "W19", description: "Left Push Button" },
  { id: "BTNR", type: "button", label: "BTNR", pin: "T17", description: "Right Push Button" },
  { id: "BTND", type: "button", label: "BTND", pin: "U17", description: "Down Push Button" },

  // 4-Digit 7-Segment Display (Cathodes CA..CG, DP)
  { id: "CA", type: "seven_seg_ca", label: "CA", pin: "W7", index: 0, description: "Cathode A" },
  { id: "CB", type: "seven_seg_ca", label: "CB", pin: "W6", index: 1, description: "Cathode B" },
  { id: "CC", type: "seven_seg_ca", label: "CC", pin: "U8", index: 2, description: "Cathode C" },
  { id: "CD", type: "seven_seg_ca", label: "CD", pin: "V8", index: 3, description: "Cathode D" },
  { id: "CE", type: "seven_seg_ca", label: "CE", pin: "U5", index: 4, description: "Cathode E" },
  { id: "CF", type: "seven_seg_ca", label: "CF", pin: "V5", index: 5, description: "Cathode F" },
  { id: "CG", type: "seven_seg_ca", label: "CG", pin: "U7", index: 6, description: "Cathode G" },
  { id: "DP", type: "seven_seg_ca", label: "DP", pin: "V7", index: 7, description: "Decimal Point" },

  // 7-Segment Display Anodes (AN0..AN3)
  { id: "AN0", type: "seven_seg_an", label: "AN0", pin: "U2", index: 0, description: "Anode 0 (Rightmost)" },
  { id: "AN1", type: "seven_seg_an", label: "AN1", pin: "U4", index: 1, description: "Anode 1" },
  { id: "AN2", type: "seven_seg_an", label: "AN2", pin: "V4", index: 2, description: "Anode 2" },
  { id: "AN3", type: "seven_seg_an", label: "AN3", pin: "W4", index: 3, description: "Anode 3 (Leftmost)" },

  // System 100MHz Oscillator
  { id: "CLK", type: "clock", label: "CLK", pin: "W5", description: "100MHz System Oscillator" }
];

// --------------------------------------------------------------------------
// 2. Digilent Nexys A7-100T Pinout
// --------------------------------------------------------------------------
export const NEXYS_A7_PINS: BoardPinDef[] = [
  // 16 Sliding DIP Switches
  { id: "SW0", type: "switch", label: "SW0", pin: "J15", index: 0, description: "Slide Switch 0" },
  { id: "SW1", type: "switch", label: "SW1", pin: "L16", index: 1, description: "Slide Switch 1" },
  { id: "SW2", type: "switch", label: "SW2", pin: "M13", index: 2, description: "Slide Switch 2" },
  { id: "SW3", type: "switch", label: "SW3", pin: "R15", index: 3, description: "Slide Switch 3" },
  { id: "SW4", type: "switch", label: "SW4", pin: "R17", index: 4, description: "Slide Switch 4" },
  { id: "SW5", type: "switch", label: "SW5", pin: "T18", index: 5, description: "Slide Switch 5" },
  { id: "SW6", type: "switch", label: "SW6", pin: "U18", index: 6, description: "Slide Switch 6" },
  { id: "SW7", type: "switch", label: "SW7", pin: "R13", index: 7, description: "Slide Switch 7" },
  { id: "SW8", type: "switch", label: "SW8", pin: "T8", index: 8, description: "Slide Switch 8" },
  { id: "SW9", type: "switch", label: "SW9", pin: "U8", index: 9, description: "Slide Switch 9" },
  { id: "SW10", type: "switch", label: "SW10", pin: "R16", index: 10, description: "Slide Switch 10" },
  { id: "SW11", type: "switch", label: "SW11", pin: "T13", index: 11, description: "Slide Switch 11" },
  { id: "SW12", type: "switch", label: "SW12", pin: "H6", index: 12, description: "Slide Switch 12" },
  { id: "SW13", type: "switch", label: "SW13", pin: "U12", index: 13, description: "Slide Switch 13" },
  { id: "SW14", type: "switch", label: "SW14", pin: "V13", index: 14, description: "Slide Switch 14" },
  { id: "SW15", type: "switch", label: "SW15", pin: "V10", index: 15, description: "Slide Switch 15" },

  // 16 High-Brightness Green LEDs
  { id: "LD0", type: "led", label: "LD0", pin: "H17", index: 0, description: "Output LED 0" },
  { id: "LD1", type: "led", label: "LD1", pin: "K15", index: 1, description: "Output LED 1" },
  { id: "LD2", type: "led", label: "LD2", pin: "J13", index: 2, description: "Output LED 2" },
  { id: "LD3", type: "led", label: "LD3", pin: "N14", index: 3, description: "Output LED 3" },
  { id: "LD4", type: "led", label: "LD4", pin: "R18", index: 4, description: "Output LED 4" },
  { id: "LD5", type: "led", label: "LD5", pin: "V17", index: 5, description: "Output LED 5" },
  { id: "LD6", type: "led", label: "LD6", pin: "U17", index: 6, description: "Output LED 6" },
  { id: "LD7", type: "led", label: "LD7", pin: "U16", index: 7, description: "Output LED 7" },
  { id: "LD8", type: "led", label: "LD8", pin: "V16", index: 8, description: "Output LED 8" },
  { id: "LD9", type: "led", label: "LD9", pin: "T15", index: 9, description: "Output LED 9" },
  { id: "LD10", type: "led", label: "LD10", pin: "U14", index: 10, description: "Output LED 10" },
  { id: "LD11", type: "led", label: "LD11", pin: "T16", index: 11, description: "Output LED 11" },
  { id: "LD12", type: "led", label: "LD12", pin: "V15", index: 12, description: "Output LED 12" },
  { id: "LD13", type: "led", label: "LD13", pin: "V14", index: 13, description: "Output LED 13" },
  { id: "LD14", type: "led", label: "LD14", pin: "V12", index: 14, description: "Output LED 14" },
  { id: "LD15", type: "led", label: "LD15", pin: "V11", index: 15, description: "Output LED 15" },

  // 5 Buttons
  { id: "BTNC", type: "button", label: "BTNC", pin: "N17", description: "Center Push Button" },
  { id: "BTNU", type: "button", label: "BTNU", pin: "M18", description: "Up Push Button" },
  { id: "BTNL", type: "button", label: "BTNL", pin: "P17", description: "Left Push Button" },
  { id: "BTNR", type: "button", label: "BTNR", pin: "M17", description: "Right Push Button" },
  { id: "BTND", type: "button", label: "BTND", pin: "P18", description: "Down Push Button" },

  // Clock
  { id: "CLK", type: "clock", label: "CLK", pin: "E3", description: "100MHz System Oscillator" }
];

/**
 * Parses raw port name into baseName and optional bit index (e.g. "in[2]" -> { baseName: "in", bitIndex: 2 })
 */
export function parsePortName(portStr: string): PortRef {
  const trimmed = portStr.trim().replace(/^\{+|\}+$/g, "");
  const match = /^([a-zA-Z_][a-zA-Z0-9_]*)(?:\[(\d+)\])?$/.exec(trimmed);
  if (!match) {
    return { rawPort: trimmed, baseName: trimmed, isVector: false };
  }
  const baseName = match[1];
  const bitIndex = match[2] !== undefined ? parseInt(match[2], 10) : undefined;
  return {
    rawPort: trimmed,
    baseName,
    bitIndex,
    isVector: bitIndex !== undefined
  };
}

/**
 * Parses XDC constraint content and maps physical FPGA pin -> PortRef.
 * Matches: set_property PACKAGE_PIN <PIN> [get_ports {<PORT>}]
 * Also matches: set_property -dict { PACKAGE_PIN <PIN> ... } [get_ports {<PORT>}]
 */
export function parseXdcPinBindings(xdcContent: string): Map<string, PortRef> {
  const pinMap = new Map<string, PortRef>();
  if (!xdcContent) return pinMap;

  // Normalize lines and strip comments
  const lines = xdcContent.split(/\r?\n/);
  for (const line of lines) {
    const cleanLine = line.split("#")[0].trim();
    if (!cleanLine.startsWith("set_property")) continue;

    // Pattern A: set_property PACKAGE_PIN <PIN> [get_ports {<PORT>}]
    const matchSimple = /set_property\s+PACKAGE_PIN\s+([A-Za-z0-9_]+)\s+\[get_ports\s+\{?([^\]}]+)\}?\]/i.exec(cleanLine);
    if (matchSimple) {
      const pin = matchSimple[1].trim().toUpperCase();
      const port = parsePortName(matchSimple[2]);
      pinMap.set(pin, port);
      continue;
    }

    // Pattern B: set_property -dict { ... PACKAGE_PIN <PIN> ... } [get_ports {<PORT>}]
    const matchDict = /PACKAGE_PIN\s+([A-Za-z0-9_]+).*?\[get_ports\s+\{?([^\]}]+)\}?\]/i.exec(cleanLine);
    if (matchDict) {
      const pin = matchDict[1].trim().toUpperCase();
      const port = parsePortName(matchDict[2]);
      pinMap.set(pin, port);
    }
  }

  return pinMap;
}

/**
 * Resolves current binary value (0 or 1) of a signal or vector bit from simulation state.
 */
export function resolveSignalBit(
  portRef: PortRef | undefined,
  signals: SimulationState["signals"]
): number {
  if (!portRef) return 0;

  // Search exact or scoped match
  const sig = signals.find(
    (s) =>
      s.name === portRef.baseName ||
      s.name.toLowerCase() === portRef.baseName.toLowerCase() ||
      s.name.endsWith("." + portRef.baseName)
  );

  if (!sig || !sig.samples || sig.samples.length === 0) {
    return 0;
  }

  const latestVal = sig.samples[sig.samples.length - 1].value;

  // If single bit
  if (portRef.bitIndex === undefined) {
    if (latestVal === "1" || latestVal === "1'b1") return 1;
    if (latestVal === "0" || latestVal === "1'b0") return 0;
    const num = parseInt(latestVal, latestVal.startsWith("0x") ? 16 : 10);
    return isNaN(num) ? 0 : (num & 1);
  }

  // Vector bit extraction
  let numVal = 0;
  if (latestVal.startsWith("0x") || latestVal.startsWith("0X")) {
    numVal = parseInt(latestVal, 16);
  } else if (latestVal.includes("'b")) {
    const bitPart = latestVal.split("'b")[1];
    numVal = parseInt(bitPart, 2);
  } else {
    numVal = parseInt(latestVal, 10);
  }

  if (isNaN(numVal)) return 0;
  return (numVal >> portRef.bitIndex) & 1;
}

/**
 * Injects stimulus from a board switch or button into the simulation engine.
 * Automatically handles single-bit nets and bus slicing updates.
 */
export function injectBoardControl(
  portRef: PortRef,
  nextBit: number,
  signals: SimulationState["signals"]
): void {
  if (portRef.bitIndex === undefined) {
    // Single bit direct injection
    engineBridge.injectStimulus(portRef.baseName, nextBit ? "1" : "0");
    return;
  }

  // Vector bit update
  const sig = signals.find(
    (s) =>
      s.name === portRef.baseName ||
      s.name.toLowerCase() === portRef.baseName.toLowerCase() ||
      s.name.endsWith("." + portRef.baseName)
  );

  let currentVal = 0;
  if (sig && sig.samples && sig.samples.length > 0) {
    const valStr = sig.samples[sig.samples.length - 1].value;
    if (valStr.startsWith("0x") || valStr.startsWith("0X")) {
      currentVal = parseInt(valStr, 16);
    } else if (valStr.includes("'b")) {
      currentVal = parseInt(valStr.split("'b")[1], 2);
    } else {
      currentVal = parseInt(valStr, 10);
    }
  }

  if (isNaN(currentVal)) currentVal = 0;

  // Mask and insert updated bit
  const mask = 1 << portRef.bitIndex;
  const updatedVal = nextBit ? currentVal | mask : currentVal & ~mask;
  const hexStr = "0x" + updatedVal.toString(16).toUpperCase();

  engineBridge.injectStimulus(portRef.baseName, hexStr);
}

/**
 * Resolves 4-digit 7-segment display states from simulation signals.
 */
export function resolveSevenSegDisplay(
  pinMap: Map<string, PortRef>,
  signals: SimulationState["signals"]
): SevenSegDisplayState {
  // Cathodes: W7=CA, W6=CB, U8=CC, V8=CD, U5=CE, V5=CF, U7=CG, V7=DP
  // Anodes: U2=AN0, U4=AN1, V4=AN2, W4=AN3
  const cathodePins = ["W7", "W6", "U8", "V8", "U5", "V5", "U7", "V7"];
  const anodePins = ["U2", "U4", "V4", "W4"];

  const cathodesLit: boolean[] = cathodePins.map((pin) => {
    const port = pinMap.get(pin);
    if (!port) return false;
    // Basys 3 7-seg cathodes are active-low (0 is ON)
    const bit = resolveSignalBit(port, signals);
    return bit === 0;
  });

  const anodesActive: boolean[] = anodePins.map((pin) => {
    const port = pinMap.get(pin);
    if (!port) return false;
    // Basys 3 7-seg anodes are active-low (0 enables digit)
    const bit = resolveSignalBit(port, signals);
    return bit === 0;
  });

  // Digits array
  const digits: boolean[][] = [
    [...cathodesLit],
    [...cathodesLit],
    [...cathodesLit],
    [...cathodesLit]
  ];

  return {
    digits,
    anodesActive
  };
}
