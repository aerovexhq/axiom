import type { LspDiagnostic } from './engineBridge';

export function lintMemSource(source: string, fileName?: string): LspDiagnostic[] {
  const isCoe = (fileName && fileName.endsWith('.coe')) || source.includes('memory_initialization_radix');

  if (isCoe) {
    return lintCoe(source);
  } else {
    return lintVerilogMem(source);
  }
}

function lintCoe(source: string): LspDiagnostic[] {
  const diagnostics: LspDiagnostic[] = [];
  let declaredRadix: number | null = null;
  let foundVector = false;
  let inVector = false;
  const vectorTokens: { text: string; line: number; colStart: number; colEnd: number }[] = [];

  const lines = source.split('\n');

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineNum = lineIdx + 1;
    const line = lines[lineIdx];
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith(';')) {
      continue;
    }

    const lower = trimmed.toLowerCase();

    // Check Radix header
    if (lower.includes('memory_initialization_radix')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const valStr = trimmed.slice(eqIdx + 1).replace(/;$/, '').trim();
        const valCol = line.indexOf(valStr) + 1;

        if (['2', '10', '16'].includes(valStr)) {
          declaredRadix = parseInt(valStr, 10);
        } else {
          diagnostics.push({
            startLineNumber: lineNum,
            startColumn: valCol,
            endLineNumber: lineNum,
            endColumn: valCol + valStr.length,
            message: `Invalid memory initialization radix '${valStr}'. Supported radices are 2, 10, or 16.`,
            severity: 1,
            code: "AXIOM_MEM_E001_INVALID_RADIX",
            source: "axiom-mem-linter",
            help: "Specify `memory_initialization_radix = 16;` for hexadecimal or 2 for binary."
          });
        }
      }
    }

    // Check Vector header
    if (lower.includes('memory_initialization_vector')) {
      foundVector = true;
      inVector = true;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const rest = trimmed.slice(eqIdx + 1).trim();
        if (rest) {
          collectTokens(rest, lineNum, line.indexOf(rest) + 1, vectorTokens);
        }
      }
      continue;
    }

    if (inVector) {
      collectTokens(trimmed, lineNum, line.indexOf(trimmed) + 1, vectorTokens);
      if (trimmed.endsWith(';')) {
        inVector = false;
      }
    }
  }

  if (declaredRadix === null && diagnostics.length === 0) {
    diagnostics.push({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 1,
      message: "Missing `memory_initialization_radix = <2|10|16>;` header.",
      severity: 1,
      code: "AXIOM_MEM_E001_MISSING_RADIX",
      source: "axiom-mem-linter",
      help: "Add `memory_initialization_radix = 16;` at the top of the .coe file."
    });
  }

  if (!foundVector) {
    diagnostics.push({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 1,
      message: "Missing `memory_initialization_vector = ...;` declaration.",
      severity: 1,
      code: "AXIOM_MEM_E002_MISSING_VECTOR",
      source: "axiom-mem-linter",
      help: "Add `memory_initialization_vector = <data>;` containing initialization words."
    });
  }

  // Validate digits against radix
  const radix = declaredRadix ?? 16;
  const wordLengths: number[] = [];

  for (const item of vectorTokens) {
    const clean = item.text.replace(/[,;]/g, '').trim();
    if (!clean) continue;

    let valid = true;
    if (radix === 2) {
      valid = /^[01]+$/.test(clean);
    } else if (radix === 10) {
      valid = /^\d+$/.test(clean);
    } else if (radix === 16) {
      valid = /^[0-9a-fA-F]+$/.test(clean);
    }

    if (!valid) {
      diagnostics.push({
        startLineNumber: item.line,
        startColumn: item.colStart,
        endLineNumber: item.line,
        endColumn: item.colEnd,
        message: `Vector word '${clean}' contains characters invalid for radix ${radix}.`,
        severity: 1,
        code: "AXIOM_MEM_E003_INVALID_DIGIT",
        source: "axiom-mem-linter",
        help: `Ensure all digits conform to radix ${radix} formatting.`
      });
    } else {
      wordLengths.push(clean.length);
    }
  }

  // Width consistency check
  if ((radix === 16 || radix === 2) && wordLengths.length > 1) {
    const firstLen = wordLengths[0];
    for (let i = 1; i < wordLengths.length; i++) {
      if (wordLengths[i] !== firstLen) {
        const item = vectorTokens[i];
        diagnostics.push({
          startLineNumber: item.line,
          startColumn: item.colStart,
          endLineNumber: item.line,
          endColumn: item.colEnd,
          message: `Word length ${wordLengths[i]} does not match preceding word length ${firstLen}.`,
          severity: 2,
          code: "AXIOM_MEM_W001_WIDTH_INCONSISTENCY",
          source: "axiom-mem-linter",
          help: "Ensure all memory initialization words share a uniform bit-width."
        });
        break;
      }
    }
  }

  return diagnostics;
}

function lintVerilogMem(source: string): LspDiagnostic[] {
  const diagnostics: LspDiagnostic[] = [];
  const lines = source.split('\n');

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineNum = lineIdx + 1;
    const line = lines[lineIdx];
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('//')) {
      continue;
    }

    const tokens = trimmed.split(/\s+/);
    for (const token of tokens) {
      const colStart = line.indexOf(token) + 1;
      const colEnd = colStart + token.length;

      if (token.startsWith('@')) {
        const hex = token.slice(1);
        if (!hex || !/^[0-9a-fA-F]+$/.test(hex)) {
          diagnostics.push({
            startLineNumber: lineNum,
            startColumn: colStart,
            endLineNumber: lineNum,
            endColumn: colEnd,
            message: `Invalid hexadecimal address directive '${token}'.`,
            severity: 1,
            code: "AXIOM_MEM_E004_INVALID_ADDRESS",
            source: "axiom-mem-linter",
            help: "Address directives must format as `@<hex_address>` (e.g. `@0000` or `@003F`)."
          });
        }
      } else {
        const clean = token.replace(/[,;]/g, '');
        if (!/^[0-9a-fA-FxXzZ_]+$/.test(clean)) {
          diagnostics.push({
            startLineNumber: lineNum,
            startColumn: colStart,
            endLineNumber: lineNum,
            endColumn: colEnd,
            message: `Invalid hexadecimal data entry '${clean}'.`,
            severity: 1,
            code: "AXIOM_MEM_E005_INVALID_DATA",
            source: "axiom-mem-linter",
            help: "Verilog `$readmemh` data vectors accept hexadecimal digits 0-9, a-f, A-F, and x/z."
          });
        }
      }
    }
  }

  return diagnostics;
}

function collectTokens(
  s: string,
  line: number,
  baseCol: number,
  out: { text: string; line: number; colStart: number; colEnd: number }[]
) {
  const parts = s.split(/[\s,]+/);
  for (const part of parts) {
    const clean = part.replace(/;$/, '').trim();
    if (clean) {
      out.push({
        text: clean,
        line,
        colStart: baseCol,
        colEnd: baseCol + clean.length
      });
    }
  }
}
