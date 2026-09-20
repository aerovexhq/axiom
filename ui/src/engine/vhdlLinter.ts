import type { LspDiagnostic } from './engineBridge';

export function lintVhdlSource(source: string): LspDiagnostic[] {
  const diagnostics: LspDiagnostic[] = [];
  const declaredEntities: { name: string; line: number; colStart: number; colEnd: number }[] = [];

  let inPortClause = false;
  let portParenDepth = 0;
  let currentProcessSens: string[] = [];

  let globalParenCount = 0;
  let lastOpenParenPos: { line: number; col: number } | null = null;

  const lines = source.split('\n');

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineNum = lineIdx + 1;
    const line = lines[lineIdx];
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('--')) {
      continue;
    }

    const commentIdx = line.indexOf('--');
    const codePart = commentIdx !== -1 ? line.slice(0, commentIdx) : line;
    const trimmedCode = codePart.trim();
    if (!trimmedCode) continue;

    const startCol = line.indexOf(trimmedCode) + 1;
    const endCol = startCol + trimmedCode.length;
    const lower = trimmedCode.toLowerCase();

    // 1. Parentheses & Quotes Delimiter Balance
    let inQuote = false;
    for (let i = 0; i < trimmedCode.length; i++) {
      const c = trimmedCode[i];
      if (c === '"') {
        inQuote = !inQuote;
      } else if (!inQuote) {
        if (c === '(') {
          globalParenCount++;
          lastOpenParenPos = { line: lineNum, col: startCol + i };
        } else if (c === ')') {
          globalParenCount--;
          if (globalParenCount < 0) {
            diagnostics.push({
              startLineNumber: lineNum,
              startColumn: startCol + i,
              endLineNumber: lineNum,
              endColumn: startCol + i + 1,
              message: "Unexpected closing parenthesis ')' with no matching opening delimiter.",
              severity: 1,
              code: "AXIOM_VHDL_E003_UNCLOSED_DELIMITER",
              source: "axiom-vhdl-linter",
              help: "Ensure every closing parenthesis has a corresponding opening delimiter."
            });
            globalParenCount = 0;
          }
        }
      }
    }

    if (inQuote) {
      diagnostics.push({
        startLineNumber: lineNum,
        startColumn: startCol,
        endLineNumber: lineNum,
        endColumn: endCol,
        message: "Unclosed string literal quote '\"'.",
        severity: 1,
        code: "AXIOM_VHDL_E003_UNCLOSED_DELIMITER",
        source: "axiom-vhdl-linter",
        help: "Ensure all string literals are properly closed with '\"'."
      });
    }

    // 2. Entity Declaration: `entity <Name> is`
    if (lower.startsWith('entity ')) {
      const parts = trimmedCode.split(/\s+/);
      if (parts.length >= 2) {
        const name = parts[1].replace(/;$/, '');
        if (name.toLowerCase() !== 'is') {
          const col = line.indexOf(name) + 1;
          declaredEntities.push({
            name,
            line: lineNum,
            colStart: col,
            colEnd: col + name.length
          });
        }
      }
    }

    // 3. Architecture Declaration: `architecture <ArchName> of <EntityTarget> is`
    if (lower.startsWith('architecture ')) {
      const parts = trimmedCode.split(/\s+/);
      const ofIdx = parts.findIndex((p) => p.toLowerCase() === 'of');
      if (ofIdx !== -1 && ofIdx + 1 < parts.length) {
        const targetEntity = parts[ofIdx + 1].replace(/;$/, '');
        const targetCol = line.indexOf(targetEntity) + 1;

        if (declaredEntities.length > 0) {
          const matched = declaredEntities.some(
            (e) => e.name.toLowerCase() === targetEntity.toLowerCase()
          );
          if (!matched) {
            const first = declaredEntities[0].name;
            diagnostics.push({
              startLineNumber: lineNum,
              startColumn: targetCol,
              endLineNumber: lineNum,
              endColumn: targetCol + targetEntity.length,
              message: `Architecture references entity '${targetEntity}', but declared entity is '${first}'.`,
              severity: 1,
              code: "AXIOM_VHDL_E001_ENTITY_MISMATCH",
              source: "axiom-vhdl-linter",
              help: `Change target entity to '${first}' or declare entity '${targetEntity}'.`
            });
          }
        }
      }
    }

    // 4. Port Clause & Direction Checking
    if (lower.includes('port ') && lower.includes('(')) {
      inPortClause = true;
    }

    if (inPortClause) {
      for (const c of trimmedCode) {
        if (c === '(') portParenDepth++;
        else if (c === ')') {
          portParenDepth--;
          if (portParenDepth <= 0) inPortClause = false;
        }
      }

      if (lower.includes('input ') || lower.includes('output ')) {
        const isInput = lower.includes('input ');
        const badWord = isInput ? 'input' : 'output';
        const correct = isInput ? 'in' : 'out';
        const badCol = line.toLowerCase().indexOf(badWord) + 1;

        diagnostics.push({
          startLineNumber: lineNum,
          startColumn: badCol,
          endLineNumber: lineNum,
          endColumn: badCol + badWord.length,
          message: `Invalid port direction '${badWord}'. In VHDL, port directions must be 'in', 'out', 'inout', or 'buffer'.`,
          severity: 1,
          code: "AXIOM_VHDL_E002_PORT_DIRECTION",
          source: "axiom-vhdl-linter",
          help: `Replace '${badWord}' with '${correct}'.`
        });
      }
    }

    // 5. Process Sensitivity List
    if (lower.startsWith('process')) {
      currentProcessSens = [];
      const openP = trimmedCode.indexOf('(');
      const closeP = trimmedCode.indexOf(')');
      if (openP !== -1 && closeP !== -1 && closeP > openP) {
        const inner = trimmedCode.slice(openP + 1, closeP);
        currentProcessSens = inner
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
      }
    }

    if (lower.includes('rising_edge(') || lower.includes('falling_edge(')) {
      const func = lower.includes('rising_edge(') ? 'rising_edge' : 'falling_edge';
      const pos = lower.indexOf(func);
      if (pos !== -1) {
        const sub = trimmedCode.slice(pos + func.length);
        const openP = sub.indexOf('(');
        const closeP = sub.indexOf(')');
        if (openP !== -1 && closeP !== -1 && closeP > openP) {
          const clkName = sub.slice(openP + 1, closeP).trim();
          if (clkName && currentProcessSens.length > 0) {
            if (!currentProcessSens.includes(clkName.toLowerCase())) {
              const clkCol = line.indexOf(clkName) + 1;
              diagnostics.push({
                startLineNumber: lineNum,
                startColumn: clkCol,
                endLineNumber: lineNum,
                endColumn: clkCol + clkName.length,
                message: `Clock signal '${clkName}' is evaluated by '${func}' but missing from the process sensitivity list.`,
                severity: 2,
                code: "AXIOM_VHDL_W001_PROCESS_SENSITIVITY",
                source: "axiom-vhdl-linter",
                help: `Add '${clkName}' to the process sensitivity list: process(${clkName})`
              });
            }
          }
        }
      }
    }

    if (lower.startsWith('end process')) {
      currentProcessSens = [];
    }
  }

  if (globalParenCount > 0 && lastOpenParenPos) {
    diagnostics.push({
      startLineNumber: lastOpenParenPos.line,
      startColumn: lastOpenParenPos.col,
      endLineNumber: lastOpenParenPos.line,
      endColumn: lastOpenParenPos.col + 1,
      message: "Unclosed opening parenthesis '('.",
      severity: 1,
      code: "AXIOM_VHDL_E003_UNCLOSED_DELIMITER",
      source: "axiom-vhdl-linter",
      help: "Ensure all opening parentheses '(' have matching closing delimiters ')'."
    });
  }

  return diagnostics;
}
