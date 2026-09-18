import type * as Monaco from 'monaco-editor';
import { engineBridge } from './engineBridge';

let isRegistered = false;

export function registerVerilogLanguage(monaco: typeof Monaco) {
  if (isRegistered) return;
  isRegistered = true;

  // 1. Register Language ID
  monaco.languages.register({ id: 'verilog' });

  // 2. Set Language Configuration
  monaco.languages.setLanguageConfiguration('verilog', {
    comments: {
      lineComment: '//',
      blockComment: ['/*', '*/'],
    },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
      ['begin', 'end'],
      ['module', 'endmodule'],
      ['case', 'endcase'],
      ['casex', 'endcase'],
      ['casez', 'endcase'],
      ['generate', 'endgenerate'],
      ['function', 'endfunction'],
      ['task', 'endtask'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"', notIn: ['string'] },
      { open: '/*', close: '*/', notIn: ['string'] },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
    ],
    folding: {
      markers: {
        start: /^\s*\/\/\s*#?region\b/,
        end: /^\s*\/\/\s*#?endregion\b/,
      },
      offSide: false,
    },
  });

  // 3. Monarch Tokenizer with Axiom Engineering Aesthetic
  monaco.languages.setMonarchTokensProvider('verilog', {
    defaultToken: '',
    tokenPostfix: '.v',

    keywords: [
      'always', 'always_comb', 'always_ff', 'always_latch', 'and', 'assert', 'assign', 'automatic',
      'begin', 'buf', 'bufif0', 'bufif1', 'case', 'casex', 'casez', 'cell', 'cmos', 'config',
      'deassign', 'default', 'defparam', 'design', 'disable', 'edge', 'else', 'end', 'endcase',
      'endconfig', 'endfunction', 'endgenerate', 'endmodule', 'endprimitive', 'endspecify',
      'endtable', 'endtask', 'event', 'for', 'force', 'forever', 'fork', 'function', 'generate',
      'genvar', 'highz0', 'highz1', 'if', 'ifnone', 'incdir', 'include', 'initial', 'inout',
      'input', 'instance', 'integer', 'join', 'large', 'liblist', 'library', 'localparam', 'macromodule',
      'medium', 'module', 'nand', 'negedge', 'nmos', 'nor', 'noshowcancelled', 'not', 'notif0',
      'notif1', 'or', 'output', 'parameter', 'pmos', 'posedge', 'primitive', 'pull0', 'pull1',
      'pulldown', 'pullup', 'rcmos', 'real', 'realtime', 'reg', 'release', 'repeat', 'rnmos',
      'rpmos', 'rtran', 'rtranif0', 'rtranif1', 'scalared', 'showcancelled', 'signed', 'small',
      'specify', 'specparam', 'strong0', 'strong1', 'supply0', 'supply1', 'table', 'task', 'time',
      'tran', 'tranif0', 'tranif1', 'tri', 'tri0', 'tri1', 'triand', 'trior', 'trireg', 'unsigned',
      'use', 'vectored', 'wait', 'wand', 'weak0', 'weak1', 'while', 'wire', 'wor', 'xnor', 'xor',
      'logic', 'bit', 'byte', 'int', 'longint', 'shortint', 'struct', 'union', 'enum', 'typedef',
      'return', 'break', 'continue', 'import', 'package', 'endpackage', 'interface', 'endinterface'
    ],

    operators: [
      '=', '<=', '+', '-', '*', '/', '%', '==', '!=', '===', '!==', '==?', '!=?',
      '&&', '||', '!', '&', '|', '^', '~^', '^~', '~', '<<', '>>', '<<<', '>>>',
      '<', '<=', '>', '>=', '?', ':', '@', '#', '->', '++'
    ],

    brackets: [
      { token: 'delimiter.curly', open: '{', close: '}' },
      { token: 'delimiter.parenthesis', open: '(', close: ')' },
      { token: 'delimiter.square', open: '[', close: ']' }
    ],

    tokenizer: {
      root: [
        // Identifiers and keywords
        [/[a-zA-Z_$][\w$]*/, {
          cases: {
            '@keywords': 'keyword',
            '@default': 'identifier'
          }
        }],

        // Directives & system tasks
        [/`[a-zA-Z_]\w*/, 'directive'],
        [/\$[a-zA-Z_]\w*/, 'predefined'],

        // Whitespace
        { include: '@whitespace' },

        // Delimiters and operators
        [/[{}()\[\]]/, '@brackets'],
        [/[<>](?!@symbols)/, '@brackets'],
        [/@symbols/, {
          cases: {
            '@operators': 'operator',
            '@default': ''
          }
        }],

        // Numbers: Verilog sized/radix literals (e.g., 32'hdeadbeef, 8'b1010_0011, 4'd12, '1)
        [/\d+('[bBoOdDhH][0-9a-fA-F_xzXZ]+|\b)/, 'number'],
        [/'[01xzXZ]/, 'number'],
        [/\b\d+([._]\d+)*\b/, 'number'],

        // Strings
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
      ],

      string: [
        [/[^\\"]+/, 'string'],
        [/\\./, 'string.escape'],
        [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }]
      ],

      whitespace: [
        [/[ \t\r\n]+/, 'white'],
        [/\/\*/, 'comment', '@comment'],
        [/\/\/.*$/, 'comment'],
      ],

      comment: [
        [/[^\/*]+/, 'comment'],
        [/\/\*/, 'comment', '@push'],
        ["\\*/", 'comment', '@pop'],
        [/[\/*]/, 'comment']
      ],
    },
    symbols: /[=><!~?:&|+\-*\/\^%#@]+/
  });

  // 4. Define Axiom Dark Engineering Theme
  monaco.editor.defineTheme('axiom-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '', foreground: 'd4d4d8', background: '090d16' },
      { token: 'keyword', foreground: '38bdf8', fontStyle: 'bold' },          // Sky cyan
      { token: 'identifier', foreground: 'e2e8f0' },                         // Clean light slate
      { token: 'directive', foreground: 'f472b6', fontStyle: 'italic' },     // Pink for `timescale, `define
      { token: 'predefined', foreground: 'fbbf24', fontStyle: 'bold' },       // Amber for $display, $finish
      { token: 'operator', foreground: '06b6d4' },                           // Vibrant cyan
      { token: 'number', foreground: 'a78bfa' },                             // Purple for literals
      { token: 'string', foreground: '34d399' },                             // Emerald green
      { token: 'comment', foreground: '64748b', fontStyle: 'italic' },       // Muted slate gray
      { token: 'delimiter', foreground: '94a3b8' },
    ],
    colors: {
      'editor.background': '#090d16',
      'editor.foreground': '#d4d4d8',
      'editor.lineHighlightBackground': '#131b2e',
      'editorLineNumber.foreground': '#334155',
      'editorLineNumber.activeForeground': '#38bdf8',
      'editorCursor.foreground': '#38bdf8',
      'editor.selectionBackground': '#1e3a8a66',
      'editor.inactiveSelectionBackground': '#1e293b55',
      'editorIndentGuide.background': '#1e293b',
      'editorIndentGuide.activeBackground': '#334155',
      'editorWhitespace.foreground': '#1e293b',
      'editorGutter.background': '#090d16',
      'editorWidget.background': '#0f172a',
      'editorWidget.border': '#1e293b',
      'editorHoverWidget.background': '#0f172a',
      'editorHoverWidget.border': '#38bdf844',
      'editorSuggestWidget.background': '#0f172a',
      'editorSuggestWidget.border': '#1e293b',
      'editorSuggestWidget.selectedBackground': '#1e293b',
      'editorSuggestWidget.highlightForeground': '#38bdf8',
    },
  });

  // 5. Register Completion Provider
  monaco.languages.registerCompletionItemProvider('verilog', {
    triggerCharacters: ['.', '$', '@', '`'],
    async provideCompletionItems(model, position) {
      try {
        const text = model.getValue();
        const items = await engineBridge.complete(text, position.lineNumber, position.column);
        if (!items || items.length === 0) return { suggestions: [] };

        const wordInfo = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: wordInfo.startColumn,
          endColumn: wordInfo.endColumn,
        };

        const suggestions: Monaco.languages.CompletionItem[] = items.map((item) => ({
          label: item.label,
          kind: item.kind as unknown as Monaco.languages.CompletionItemKind,
          detail: item.detail,
          insertText: item.insertText,
          insertTextRules: item.kind === 27 // Snippet
            ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
            : undefined,
          documentation: item.documentation
            ? { value: item.documentation }
            : undefined,
          range,
        }));

        return { suggestions };
      } catch (err) {
        console.error('[monacoVerilog] Autocompletion failed:', err);
        return { suggestions: [] };
      }
    },
  });

  // 6. Register Hover Provider
  monaco.languages.registerHoverProvider('verilog', {
    async provideHover(model, position) {
      try {
        const text = model.getValue();
        const res = await engineBridge.hover(text, position.lineNumber, position.column);
        if (!res || !res.contents) return null;

        return {
          contents: [{ value: res.contents }],
          range: res.range ? {
            startLineNumber: res.range.start_line_number,
            startColumn: res.range.start_column,
            endLineNumber: res.range.end_line_number,
            endColumn: res.range.end_column,
          } : undefined,
        };
      } catch (err) {
        console.error('[monacoVerilog] Hover lookup failed:', err);
        return null;
      }
    },
  });
}
