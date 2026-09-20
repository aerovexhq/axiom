// Axiom EDA — Vivado FPGA Package & Device Floorplan Engine
// Models 2D BGA Ball Grid Arrays, I/O Banks, Silicon Die Tiles, and XDC I/O Constraints

export type PinType =
  | "user_io"
  | "clock_mrcc"
  | "clock_srcc"
  | "diff_p"
  | "diff_n"
  | "vccint"
  | "vccaux"
  | "vcco"
  | "gnd"
  | "config"
  | "nc";

export interface PackagePinDef {
  pin: string;            // e.g. "W5", "V17"
  row: string;            // e.g. "W", "V"
  col: number;            // 1..19
  bank: number | "GND" | "VCCINT" | "VCCAUX" | "VCCO" | "CFG";
  pinType: PinType;
  symbol: string;         // "+", "-", "C", "S", "•", "G", "V"
  diffPairName?: string;  // e.g. "IO_L12P_T1_MRCC_34"
  label?: string;         // e.g. "CLK100MHZ", "SW0"
}

export interface PackageBankDef {
  id: number | string;
  name: string;
  color: string;
  borderColor: string;
  vcco: string;
  type: "HR" | "HP" | "Config" | "Power";
  description: string;
}

export interface FpgaPackageDef {
  partId: string;         // e.g. "xc7a35tcpg236-1"
  partName: string;       // e.g. "Artix-7 xc7a35tcpg236-1 (Basys 3)"
  packageName: string;   // e.g. "CPG236"
  family: string;         // e.g. "Artix-7"
  gridRows: string[];     // JEDEC Rows: A..W skipping I, O, Q, S, X, Z
  gridCols: number[];     // 1..19
  pins: Record<string, PackagePinDef>;
  banks: Record<string, PackageBankDef>;
}

export interface PortAssignment {
  name: string;           // e.g. "A", "B", "C", "F", "clk"
  direction: "IN" | "OUT" | "INOUT";
  isBus: boolean;
  busIndex?: number;
  packagePin: string;     // e.g. "V17"
  fixed: boolean;         // locked in constraints
  bank: string;           // "34", "14", etc.
  ioStandard: string;     // "LVCMOS33", "LVCMOS18", etc.
  vcco: string;           // "3.3V", "1.8V"
  vref: string;           // "--"
  driveStrength: string;  // "4mA", "8mA", "12mA", "16mA"
  slewType: string;       // "SLOW", "FAST"
  pullType: string;       // "NONE", "PULLUP", "PULLDOWN"
  negDiffPair?: string;
}

export interface SiliconDieTile {
  id: string;
  type: "CLB" | "BRAM" | "DSP" | "IOB" | "CMT" | "CONFIG";
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  color: string;
  bankId?: number;
}

export interface SiliconDieModel {
  width: number;
  height: number;
  tiles: SiliconDieTile[];
}

// JEDEC standard row letters for BGA packages (omits I, O, Q, S, X, Z)
export const BGA_JEDEC_ROWS_19 = [
  "A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "P", "R", "T", "U", "V", "W"
];

export const BGA_JEDEC_ROWS_18 = [
  "A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "P", "R", "T", "U", "V"
];

// Bank color palettes matching AMD Vivado 2018.2 screenshot
export const VIVADO_BANK_PALETTES: Record<string, PackageBankDef> = {
  "0": {
    id: 0,
    name: "Bank 0 (Config / System)",
    color: "rgba(249, 115, 22, 0.28)",
    borderColor: "#f97316",
    vcco: "3.3V",
    type: "Config",
    description: "System & Configuration Pins (JTAG, Done, Mode)"
  },
  "14": {
    id: 14,
    name: "Bank 14 (High Range I/O)",
    color: "rgba(132, 204, 22, 0.28)",
    borderColor: "#84cc16",
    vcco: "3.3V",
    type: "HR",
    description: "User I/O with selectable voltage (Switches, LEDs)"
  },
  "15": {
    id: 15,
    name: "Bank 15 (High Range I/O)",
    color: "rgba(217, 70, 239, 0.28)",
    borderColor: "#d946ef",
    vcco: "3.3V",
    type: "HR",
    description: "User I/O with selectable voltage (7-Segment, Buttons)"
  },
  "34": {
    id: 34,
    name: "Bank 34 (High Range I/O)",
    color: "rgba(6, 182, 212, 0.28)",
    borderColor: "#06b6d4",
    vcco: "3.3V",
    type: "HR",
    description: "User I/O & Master Clock Input (W5 MRCC)"
  },
  "35": {
    id: 35,
    name: "Bank 35 (High Range I/O)",
    color: "rgba(59, 130, 246, 0.28)",
    borderColor: "#3b82f6",
    vcco: "3.3V",
    type: "HR",
    description: "User I/O & High-speed Expansion Header"
  },
  "GND": {
    id: "GND",
    name: "Ground (GND)",
    color: "rgba(71, 85, 105, 0.35)",
    borderColor: "#475569",
    vcco: "0.0V",
    type: "Power",
    description: "Digital Substrate Ground"
  },
  "VCCINT": {
    id: "VCCINT",
    name: "VCCINT (Core 1.0V)",
    color: "rgba(239, 68, 68, 0.35)",
    borderColor: "#ef4444",
    vcco: "1.0V",
    type: "Power",
    description: "FPGA Internal Logic Core Power Supply"
  },
  "VCCAUX": {
    id: "VCCAUX",
    name: "VCCAUX (Auxiliary 1.8V)",
    color: "rgba(234, 179, 8, 0.35)",
    borderColor: "#eab308",
    vcco: "1.8V",
    type: "Power",
    description: "Auxiliary Circuits & Clock Management Power"
  }
};

/**
 * Builds the CPG236 (19x19 BGA) package database for Artix-7 xc7a35tcpg236-1.
 * Matches Vivado's physical pinout from the screenshot.
 */
export function createCpg236Package(): FpgaPackageDef {
  const gridRows = BGA_JEDEC_ROWS_19;
  const gridCols = Array.from({ length: 19 }, (_, i) => i + 1);
  const pins: Record<string, PackagePinDef> = {};

  for (let r = 0; r < gridRows.length; r++) {
    const row = gridRows[r];
    for (let c = 1; c <= 19; c++) {
      const pinName = `${row}${c}`;

      // 1. Center Power & Ground cavity / grid
      const isCenterArea = r >= 5 && r <= 13 && c >= 6 && c <= 14;
      if (isCenterArea) {
        if ((r + c) % 3 === 0) {
          pins[pinName] = {
            pin: pinName,
            row,
            col: c,
            bank: "GND",
            pinType: "gnd",
            symbol: "•",
            label: "GND"
          };
        } else if ((r + c) % 3 === 1) {
          pins[pinName] = {
            pin: pinName,
            row,
            col: c,
            bank: "VCCINT",
            pinType: "vccint",
            symbol: "V",
            label: "VCCINT (1.0V)"
          };
        } else {
          pins[pinName] = {
            pin: pinName,
            row,
            col: c,
            bank: "VCCAUX",
            pinType: "vccaux",
            symbol: "A",
            label: "VCCAUX (1.8V)"
          };
        }
        continue;
      }

      // 2. Bank 0 (Top Center: Rows A-C, Cols 8-13)
      if (r <= 2 && c >= 8 && c <= 13) {
        pins[pinName] = {
          pin: pinName,
          row,
          col: c,
          bank: 0,
          pinType: "config",
          symbol: "S",
          label: `CFG_${pinName}`
        };
        continue;
      }

      // 3. Bank 35 (Top Right: Rows A-D, Cols 14-19)
      if (r <= 3 && c >= 14) {
        const isDiffP = (r + c) % 2 === 0;
        pins[pinName] = {
          pin: pinName,
          row,
          col: c,
          bank: 35,
          pinType: isDiffP ? "diff_p" : "diff_n",
          symbol: isDiffP ? "+" : "-",
          diffPairName: `IO_L${c}P_T${r}_35`,
          label: `B35_${pinName}`
        };
        continue;
      }

      // 4. Bank 34 (Left Edge: Rows A-N, Cols 1-5)
      if (r <= 12 && c <= 5) {
        const isClock = (row === "W" && c === 5) || (row === "B" && c === 4) || (row === "E" && c === 3);
        const isDiffP = (r + c) % 2 === 0;
        pins[pinName] = {
          pin: pinName,
          row,
          col: c,
          bank: 34,
          pinType: isClock ? "clock_mrcc" : isDiffP ? "diff_p" : "diff_n",
          symbol: isClock ? "C" : isDiffP ? "+" : "-",
          diffPairName: isClock ? `IO_L12P_T1_MRCC_34` : `IO_L${r}P_34`,
          label: isClock ? "CLK100MHZ" : `B34_${pinName}`
        };
        continue;
      }

      // 5. Bank 15 (Bottom Left: Rows P-W, Cols 1-8)
      if (r >= 13 && c <= 8) {
        const isClock = (row === "W" && c === 5);
        const isDiffP = (r + c) % 2 === 0;
        pins[pinName] = {
          pin: pinName,
          row,
          col: c,
          bank: 15,
          pinType: isClock ? "clock_mrcc" : isDiffP ? "diff_p" : "diff_n",
          symbol: isClock ? "C" : isDiffP ? "+" : "-",
          diffPairName: `IO_L${r}P_T2_15`,
          label: `B15_${pinName}`
        };
        continue;
      }

      // 6. Bank 14 (Bottom Right: Rows P-W, Cols 9-19)
      if (r >= 13 && c >= 9) {
        const isDiffP = (r + c) % 2 === 0;
        pins[pinName] = {
          pin: pinName,
          row,
          col: c,
          bank: 14,
          pinType: isDiffP ? "diff_p" : "diff_n",
          symbol: isDiffP ? "+" : "-",
          diffPairName: `IO_L${r}P_T3_14`,
          label: `B14_${pinName}`
        };
        continue;
      }

      // 7. Remaining outer perimeter / corners
      const isDiffP = (r + c) % 2 === 0;
      pins[pinName] = {
        pin: pinName,
        row,
        col: c,
        bank: 34,
        pinType: isDiffP ? "diff_p" : "diff_n",
        symbol: isDiffP ? "+" : "-",
        label: `IO_${pinName}`
      };
    }
  }

  if (pins["W5"]) { pins["W5"].label = "CLK100MHZ (W5)"; pins["W5"].pinType = "clock_mrcc"; pins["W5"].symbol = "C"; }
  if (pins["V17"]) { pins["V17"].label = "SW0 (V17)"; pins["V17"].bank = 14; }
  if (pins["V16"]) { pins["V16"].label = "SW1 (V16)"; pins["V16"].bank = 14; }
  if (pins["W16"]) { pins["W16"].label = "SW2 (W16)"; pins["W16"].bank = 14; }
  if (pins["W17"]) { pins["W17"].label = "SW3 (W17)"; pins["W17"].bank = 14; }
  if (pins["U16"]) { pins["U16"].label = "LD0 (U16)"; pins["U16"].bank = 14; }
  if (pins["E19"]) { pins["E19"].label = "LD1 (E19)"; pins["E19"].bank = 14; }
  if (pins["U18"]) { pins["U18"].label = "BTNC (U18)"; pins["U18"].bank = 15; }
  if (pins["T18"]) { pins["T18"].label = "BTNU (T18)"; pins["T18"].bank = 15; }

  return {
    partId: "xc7a35tcpg236-1",
    partName: "Artix-7 xc7a35tcpg236-1 (Basys 3)",
    packageName: "CPG236",
    family: "Artix-7",
    gridRows,
    gridCols,
    pins,
    banks: VIVADO_BANK_PALETTES
  };
}

/**
 * Builds the CSG324 (18x18 BGA) package database for Artix-7 xc7a35t-csg324-1.
 */
export function createCsg324Package(): FpgaPackageDef {
  const gridRows = BGA_JEDEC_ROWS_18;
  const gridCols = Array.from({ length: 18 }, (_, i) => i + 1);
  const pins: Record<string, PackagePinDef> = {};

  for (let r = 0; r < gridRows.length; r++) {
    const row = gridRows[r];
    for (let c = 1; c <= 18; c++) {
      const pinName = `${row}${c}`;
      const isCenter = r >= 6 && r <= 11 && c >= 6 && c <= 11;
      if (isCenter) {
        pins[pinName] = {
          pin: pinName,
          row,
          col: c,
          bank: (r + c) % 2 === 0 ? "GND" : "VCCINT",
          pinType: (r + c) % 2 === 0 ? "gnd" : "vccint",
          symbol: (r + c) % 2 === 0 ? "•" : "V",
          label: (r + c) % 2 === 0 ? "GND" : "VCCINT"
        };
      } else {
        const bank = r < 5 ? (c <= 9 ? 34 : 35) : (c <= 9 ? 15 : 14);
        const isClock = (row === "E" && c === 3) || (row === "N" && c === 15);
        pins[pinName] = {
          pin: pinName,
          row,
          col: c,
          bank,
          pinType: isClock ? "clock_mrcc" : (r + c) % 2 === 0 ? "diff_p" : "diff_n",
          symbol: isClock ? "C" : (r + c) % 2 === 0 ? "+" : "-",
          label: `IO_${pinName}`
        };
      }
    }
  }

  return {
    partId: "xc7a35t-csg324-1",
    partName: "Artix-7 xc7a35t-csg324-1",
    packageName: "CSG324",
    family: "Artix-7",
    gridRows,
    gridCols,
    pins,
    banks: VIVADO_BANK_PALETTES
  };
}

/**
 * Returns package database for given target device ID.
 */
export function getPackageForDevice(targetDeviceId?: string): FpgaPackageDef {
  if (targetDeviceId?.includes("cpg236") || targetDeviceId?.includes("basys")) {
    return createCpg236Package();
  }
  if (targetDeviceId?.includes("csg324")) {
    return createCsg324Package();
  }
  return createCpg236Package();
}

/**
 * Builds the Silicon Die Floorplan representation with CLBs, BRAMs, DSPs, and IOBs.
 */
export function createSiliconDieModel(): SiliconDieModel {
  const tiles: SiliconDieTile[] = [];
  const cols = 28;
  const rows = 18;
  const tileW = 28;
  const tileH = 22;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = 50 + c * (tileW + 2);
      const y = 40 + r * (tileH + 2);

      // Peripheral I/O Banks
      if (r === 0 || r === rows - 1 || c === 0 || c === cols - 1) {
        const bankId = r === 0 ? (c < 14 ? 34 : 35) : (c < 14 ? 15 : 14);
        tiles.push({
          id: `iob_${r}_${c}`,
          type: "IOB",
          x,
          y,
          width: tileW,
          height: tileH,
          label: `IOB`,
          color: bankId === 14 ? "#84cc16" : bankId === 15 ? "#d946ef" : bankId === 34 ? "#06b6d4" : "#3b82f6",
          bankId
        });
        continue;
      }

      // BRAM columns (columns 8 and 20)
      if (c === 8 || c === 20) {
        tiles.push({
          id: `bram_${r}_${c}`,
          type: "BRAM",
          x,
          y,
          width: tileW,
          height: tileH,
          label: `RAMB36`,
          color: "#8b5cf6"
        });
        continue;
      }

      // DSP columns (columns 14)
      if (c === 14) {
        tiles.push({
          id: `dsp_${r}_${c}`,
          type: "DSP",
          x,
          y,
          width: tileW,
          height: tileH,
          label: `DSP48`,
          color: "#ec4899"
        });
        continue;
      }

      // Clock Management Tile (center top)
      if (r === 1 && (c === 13 || c === 15)) {
        tiles.push({
          id: `cmt_${r}_${c}`,
          type: "CMT",
          x,
          y,
          width: tileW,
          height: tileH,
          label: `MMCM`,
          color: "#eab308"
        });
        continue;
      }

      // Standard Configurable Logic Blocks (CLB)
      tiles.push({
        id: `clb_${r}_${c}`,
        type: "CLB",
        x,
        y,
        width: tileW,
        height: tileH,
        label: `CLB`,
        color: "#1e293b"
      });
    }
  }

  return {
    width: 50 + cols * (tileW + 2) + 50,
    height: 40 + rows * (tileH + 2) + 40,
    tiles
  };
}

/**
 * Extracts top-level module ports from Verilog source.
 */
export function extractTopPortsFromVerilog(verilogCode: string, topModuleName: string): { name: string; direction: "IN" | "OUT" | "INOUT"; width: number }[] {
  const modRegex = new RegExp(`module\\s+${topModuleName}\\s*(?:#\\s*\\([\\s\\S]*?\\))?\\s*\\(([\\s\\S]*?)\\);`, "i");
  const modMatch = verilogCode.match(modRegex);
  if (!modMatch || !modMatch[1]) {
    const genericMod = verilogCode.match(/module\\s+\\w+\\s*(?:#\\s*\\([\\s\\S]*?\\))?\\s*\\(([\\s\\S]*?)\\);/i);
    if (!genericMod || !genericMod[1]) return [];
    return parsePortList(genericMod[1]);
  }

  return parsePortList(modMatch[1]);
}

function parsePortList(portListStr: string): { name: string; direction: "IN" | "OUT" | "INOUT"; width: number }[] {
  const result: { name: string; direction: "IN" | "OUT" | "INOUT"; width: number }[] = [];
  const entries = portListStr.split(",").map((s) => s.trim()).filter(Boolean);

  let currentDir: "IN" | "OUT" | "INOUT" = "IN";
  let currentWidth = 1;

  for (const entry of entries) {
    const clean = entry.replace(/\/\/.*$/gm, "").trim();
    if (!clean) continue;

    if (clean.includes("input")) currentDir = "IN";
    else if (clean.includes("output")) currentDir = "OUT";
    else if (clean.includes("inout")) currentDir = "INOUT";

    const widthMatch = clean.match(/\[(\d+):(\d+)\]/);
    if (widthMatch) {
      const msb = parseInt(widthMatch[1], 10);
      const lsb = parseInt(widthMatch[2], 10);
      currentWidth = Math.abs(msb - lsb) + 1;
    } else if (clean.includes("input") || clean.includes("output") || clean.includes("inout")) {
      currentWidth = 1;
    }

    const nameMatch = clean.match(/([A-Za-z_][A-Za-z0-9_]*)\s*$/);
    if (nameMatch && !["wire", "reg", "logic", "input", "output", "inout"].includes(nameMatch[1])) {
      result.push({
        name: nameMatch[1],
        direction: currentDir,
        width: currentWidth
      });
    }
  }

  return result;
}

/**
 * Parses Vivado XDC constraints to extract pin assignments and I/O standards.
 */
export function parseXdcPortConstraints(xdcText: string): Record<string, Partial<PortAssignment>> {
  const constraints: Record<string, Partial<PortAssignment>> = {};
  if (!xdcText) return constraints;

  const lines = xdcText.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || !trimmed.startsWith("set_property")) continue;

    const pinMatch = trimmed.match(/set_property\s+PACKAGE_PIN\s+([A-Za-z0-9_]+)\s+\[get_ports\s+\{?([A-Za-z0-9_\[\]]+)\}?\]/i);
    if (pinMatch) {
      const pin = pinMatch[1];
      const port = pinMatch[2];
      if (!constraints[port]) constraints[port] = {};
      constraints[port].packagePin = pin;
      constraints[port].fixed = true;
    }

    const stdMatch = trimmed.match(/set_property\s+IOSTANDARD\s+([A-Za-z0-9_]+)\s+\[get_ports\s+\{?([A-Za-z0-9_\[\]]+)\}?\]/i);
    if (stdMatch) {
      const std = stdMatch[1];
      const port = stdMatch[2];
      if (!constraints[port]) constraints[port] = {};
      constraints[port].ioStandard = std;
    }

    const driveMatch = trimmed.match(/set_property\s+DRIVE\s+(\d+)\s+\[get_ports\s+\{?([A-Za-z0-9_\[\]]+)\}?\]/i);
    if (driveMatch) {
      const port = driveMatch[2];
      if (!constraints[port]) constraints[port] = {};
      constraints[port].driveStrength = `${driveMatch[1]}mA`;
    }

    const slewMatch = trimmed.match(/set_property\s+SLEW\s+([A-Za-z]+)\s+\[get_ports\s+\{?([A-Za-z0-9_\[\]]+)\}?\]/i);
    if (slewMatch) {
      const port = slewMatch[2];
      if (!constraints[port]) constraints[port] = {};
      constraints[port].slewType = slewMatch[1].toUpperCase();
    }
  }

  return constraints;
}

/**
 * Serializes port assignments back into clean Vivado XDC constraint text.
 */
export function serializePortAssignmentsToXdc(
  assignments: PortAssignment[],
  existingXdc: string
): string {
  const portNames = new Set(assignments.map((a) => a.name));
  const lines = existingXdc.split("\n");
  const retainedLines = lines.filter((l) => {
    const trimmed = l.trim();
    if (!trimmed.startsWith("set_property")) return true;
    for (const name of portNames) {
      if (trimmed.includes(`[get_ports {${name}}]`) || trimmed.includes(`[get_ports ${name}]`)) {
        return false;
      }
    }
    return true;
  });

  const generatedLines: string[] = [];
  generatedLines.push("");
  generatedLines.push("## ====================================================================");
  generatedLines.push("## Axiom I/O Planning & Package Pin Constraints (Vivado Synced)");
  generatedLines.push("## ====================================================================");

  for (const a of assignments) {
    if (a.packagePin) {
      generatedLines.push(`set_property PACKAGE_PIN ${a.packagePin} [get_ports {${a.name}}]`);
      generatedLines.push(`set_property IOSTANDARD ${a.ioStandard || "LVCMOS33"} [get_ports {${a.name}}]`);
      if (a.direction === "OUT") {
        if (a.driveStrength) generatedLines.push(`set_property DRIVE ${a.driveStrength.replace("mA", "")} [get_ports {${a.name}}]`);
        if (a.slewType) generatedLines.push(`set_property SLEW ${a.slewType} [get_ports {${a.name}}]`);
      }
      if (a.pullType === "PULLUP") generatedLines.push(`set_property PULLUP true [get_ports {${a.name}}]`);
      else if (a.pullType === "PULLDOWN") generatedLines.push(`set_property PULLDOWN true [get_ports {${a.name}}]`);
      generatedLines.push("");
    }
  }

  return retainedLines.join("\n").trimEnd() + "\n" + generatedLines.join("\n").trimEnd() + "\n";
}
