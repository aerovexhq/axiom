// Axiom EDA Radix & 4-State Bit Decomposition Engine

export type DisplayRadix = "hex" | "bin" | "u_dec" | "s_dec" | "ascii";

/**
 * Parses raw string sample (e.g. "0x4A", "8'hA5", "1010", "42", "x", "z") into numeric value or null if X/Z
 */
export function parseRawValue(rawVal: string, width: number): { num: bigint | null; hasX: boolean; hasZ: boolean; rawBits: string } {
  const clean = rawVal.trim().toLowerCase();

  // Check for universal X or Z
  if (clean === "x" || clean === "1'bx") return { num: null, hasX: true, hasZ: false, rawBits: "x".repeat(width) };
  if (clean === "z" || clean === "1'bz") return { num: null, hasX: false, hasZ: true, rawBits: "z".repeat(width) };

  // Hex format: 0x... or 8'h...
  if (clean.startsWith("0x")) {
    const hexStr = clean.slice(2);
    if (hexStr.includes("x") || hexStr.includes("z")) {
      return { num: null, hasX: hexStr.includes("x"), hasZ: hexStr.includes("z"), rawBits: "x".repeat(width) };
    }
    try {
      const num = BigInt("0x" + hexStr);
      const bin = num.toString(2).padStart(width, "0");
      return { num, hasX: false, hasZ: false, rawBits: bin };
    } catch {
      return { num: null, hasX: true, hasZ: false, rawBits: "x".repeat(width) };
    }
  }

  // Pure binary format
  if (/^[01xz_]+$/.test(clean)) {
    const sanitized = clean.replace(/_/g, "");
    if (sanitized.includes("x") || sanitized.includes("z")) {
      return { num: null, hasX: sanitized.includes("x"), hasZ: sanitized.includes("z"), rawBits: sanitized.padStart(width, "x") };
    }
    try {
      const num = BigInt("0b" + sanitized);
      return { num, hasX: false, hasZ: false, rawBits: sanitized.padStart(width, "0") };
    } catch {
      return { num: null, hasX: true, hasZ: false, rawBits: "x".repeat(width) };
    }
  }

  // Decimal number
  try {
    const num = BigInt(clean);
    const bin = (num < 0n ? (1n << BigInt(width)) + num : num).toString(2).padStart(width, "0");
    return { num, hasX: false, hasZ: false, rawBits: bin };
  } catch {
    return { num: null, hasX: true, hasZ: false, rawBits: "x".repeat(width) };
  }
}

/**
 * Format a raw value into the chosen DisplayRadix
 */
export function formatValueWithRadix(rawVal: string, width: number, radix: DisplayRadix): string {
  const parsed = parseRawValue(rawVal, width);

  if (parsed.hasX) return "X";
  if (parsed.hasZ) return "Z";
  if (parsed.num === null) return rawVal;

  const mask = (1n << BigInt(width)) - 1n;
  const unsignedVal = parsed.num & mask;

  switch (radix) {
    case "hex": {
      const hexChars = Math.ceil(width / 4);
      return "0x" + unsignedVal.toString(16).toUpperCase().padStart(hexChars, "0");
    }
    case "bin": {
      return unsignedVal.toString(2).padStart(width, "0");
    }
    case "u_dec": {
      return unsignedVal.toString(10);
    }
    case "s_dec": {
      // Two's complement signed integer
      const msb = 1n << BigInt(width - 1);
      if (width > 1 && (unsignedVal & msb) !== 0n) {
        const signedVal = unsignedVal - (1n << BigInt(width));
        return signedVal.toString(10);
      }
      return unsignedVal.toString(10);
    }
    case "ascii": {
      if (unsignedVal >= 32n && unsignedVal <= 126n) {
        return `'${String.fromCharCode(Number(unsignedVal))}'`;
      }
      return "\\x" + unsignedVal.toString(16).padStart(2, "0");
    }
    default:
      return rawVal;
  }
}

/**
 * Extract single bit value ("0" | "1" | "x" | "z") from bus value at specified bit index
 */
export function extractBitValue(rawVal: string, width: number, bitIndex: number): string {
  if (bitIndex < 0 || bitIndex >= width) return "x";
  const parsed = parseRawValue(rawVal, width);
  if (parsed.hasX && !parsed.rawBits) return "x";
  if (parsed.hasZ && !parsed.rawBits) return "z";

  const bits = parsed.rawBits.padStart(width, "0");
  // In Verilog [N-1:0], bit 0 is at the rightmost end
  const charIdx = bits.length - 1 - bitIndex;
  if (charIdx < 0 || charIdx >= bits.length) return "x";
  return bits[charIdx];
}

/**
 * Safely converts a multi-bit bus raw sample into a numeric float for analog plotting.
 * Returns null if the value is X, Z, or unparseable.
 */
export function parseToFloat(rawVal: string, width: number, isSigned: boolean = false): number | null {
  const parsed = parseRawValue(rawVal, width);
  if (parsed.hasX || parsed.hasZ || parsed.num === null) return null;

  const mask = (1n << BigInt(width)) - 1n;
  const unsignedVal = parsed.num & mask;

  if (isSigned && width > 1) {
    const msb = 1n << BigInt(width - 1);
    if ((unsignedVal & msb) !== 0n) {
      const signedVal = unsignedVal - (1n << BigInt(width));
      return Number(signedVal);
    }
  }

  return Number(unsignedVal);
}

/**
 * Formats a picosecond duration into a human-readable reciprocal frequency string (GHz, MHz, kHz).
 */
export function formatFrequency(deltaPs: number): string {
  if (deltaPs <= 0) return "-";
  const freqHz = 1 / (deltaPs * 1e-12);
  if (freqHz >= 1e9) {
    return `${(freqHz / 1e9).toFixed(3)} GHz`;
  } else if (freqHz >= 1e6) {
    return `${(freqHz / 1e6).toFixed(2)} MHz`;
  } else if (freqHz >= 1e3) {
    return `${(freqHz / 1e3).toFixed(1)} kHz`;
  }
  return `${freqHz.toFixed(1)} Hz`;
}

/**
 * Calculates clock cycles within a given delta time based on clock signal transitions.
 */
export function calculateClockCycles(
  deltaPs: number,
  clockSamples?: Array<{ timePs: number; value: string }>
): { cycles: number; clockPeriodPs: number } | null {
  if (deltaPs <= 0 || !clockSamples || clockSamples.length < 3) return null;

  // Find consecutive rising edges (0 -> 1)
  const risingEdges: number[] = [];
  for (let i = 1; i < clockSamples.length; i++) {
    if (clockSamples[i - 1].value === "0" && clockSamples[i].value === "1") {
      risingEdges.push(clockSamples[i].timePs);
    }
  }

  if (risingEdges.length < 2) return null;

  // Calculate average clock period from the observed rising edges
  let totalPeriodPs = 0;
  let periodCount = 0;
  for (let i = 1; i < risingEdges.length; i++) {
    const p = risingEdges[i] - risingEdges[i - 1];
    if (p > 0) {
      totalPeriodPs += p;
      periodCount++;
    }
  }

  if (periodCount === 0) return null;
  const avgPeriodPs = totalPeriodPs / periodCount;
  const cycles = deltaPs / avgPeriodPs;

  return { cycles: Math.round(cycles * 10) / 10, clockPeriodPs: avgPeriodPs };
}

