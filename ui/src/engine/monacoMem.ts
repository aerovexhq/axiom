import type * as Monaco from 'monaco-editor';
import { engineBridge } from './engineBridge';

let isRegistered = false;

export function registerMemLanguage(monaco: typeof Monaco) {
  if (isRegistered) return;
  isRegistered = true;

  // 1. Register Language ID
  monaco.languages.register({
    id: 'mem',
    extensions: ['.mem', '.hex', '.coe'],
    aliases: ['Memory Init File', 'COE', 'HEX', 'MEM'],
  });

  // 2. Set Language Configuration
  monaco.languages.setLanguageConfiguration('mem', {
    comments: {
      lineComment: ';',
    },
    brackets: [
      ['[', ']'],
      ['{', '}'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '"', close: '"', notIn: ['string', 'comment'] },
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
    ],
  });

  // 3. Monarch Tokenizer for Memory Files (COE & Verilog $readmemh)
  monaco.languages.setMonarchTokensProvider('mem', {
    defaultToken: '',
    tokenPostfix: '.mem',

    keywords: [
      'memory_initialization_radix',
      'memory_initialization_vector',
    ],

    tokenizer: {
      root: [
        // Comments (COE style ';' and C/Verilog style '//')
        [/;.*$/, 'comment'],
        [/\/\/.*$/, 'comment'],
        [/\/\*/, 'comment', '@comment'],

        // Address tags, e.g. @0000 or @001F
        [/@[0-9a-fA-F_]+/, 'type.identifier'],

        // COE Keywords
        [/memory_initialization_radix|memory_initialization_vector/i, 'keyword'],

        // Hexadecimal and Binary Literals
        [/\b[0-9a-fA-F_]+\b/, 'number.hex'],

        // Equal sign & separators
        [/=/, 'operator'],
        [/[,;]/, 'delimiter'],

        // Whitespace
        [/\s+/, 'white'],
      ],

      comment: [
        [/[^/*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[/*]/, 'comment']
      ]
    }
  });

  // 4. Hover Provider
  monaco.languages.registerHoverProvider('mem', {
    provideHover: async (_model, position) => {
      const code = _model.getValue();
      const line = position.lineNumber;
      const col = position.column;
      const res = await engineBridge.hoverMem(code, line, col);
      if (!res) return null;
      return {
        contents: [{ value: res.contents }],
      };
    },
  });

  // 5. Completion Provider
  monaco.languages.registerCompletionItemProvider('mem', {
    triggerCharacters: [' ', ';', '='],
    provideCompletionItems: (model, position) => {
      const wordInfo = model.getWordUntilPosition(position);
      const range: Monaco.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: wordInfo.startColumn,
        endColumn: wordInfo.endColumn,
      };

      return {
        suggestions: [
          {
            label: 'coe_header',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '; Vivado Memory Initialization Vector (COE)\nmemory_initialization_radix = 16;\nmemory_initialization_vector =\n  ${1:00000000},\n  ${2:00000001};',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: 'Xilinx BRAM/ROM COE Template',
            documentation: 'Standard Xilinx COE file header with radix and initialization vector.',
            range
          },
          {
            label: 'readmemh_entry',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '@${1:0000} ${2:00000000} ${3:00000001}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: 'Verilog $readmemh Block',
            documentation: 'Address marker and vector values for $readmemh.',
            range
          }
        ]
      };
    }
  });
}
