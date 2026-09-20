import type * as Monaco from 'monaco-editor';
import { engineBridge } from './engineBridge';

let isRegistered = false;

export function registerVhdlLanguage(monaco: typeof Monaco) {
  if (isRegistered) return;
  isRegistered = true;

  // 1. Register Language ID
  monaco.languages.register({
    id: 'vhdl',
    extensions: ['.vhd', '.vhdl'],
    aliases: ['VHDL', 'vhdl'],
  });

  // 2. Set Language Configuration
  monaco.languages.setLanguageConfiguration('vhdl', {
    comments: {
      lineComment: '--',
    },
    brackets: [
      ['(', ')'],
      ['[', ']'],
    ],
    autoClosingPairs: [
      { open: '(', close: ')' },
      { open: '[', close: ']' },
      { open: '"', close: '"', notIn: ['string', 'comment'] },
      { open: "'", close: "'", notIn: ['string', 'comment'] },
    ],
    surroundingPairs: [
      { open: '(', close: ')' },
      { open: '[', close: ']' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    folding: {
      markers: {
        start: /^\s*--\s*#?region\b/,
        end: /^\s*--\s*#?endregion\b/,
      },
      offSide: false,
    },
  });

  // 3. Monarch Tokenizer for IEEE 1076 VHDL
  monaco.languages.setMonarchTokensProvider('vhdl', {
    defaultToken: '',
    tokenPostfix: '.vhd',
    ignoreCase: true,

    keywords: [
      'abs', 'access', 'after', 'alias', 'all', 'and', 'architecture', 'array',
      'assert', 'attribute', 'begin', 'block', 'body', 'buffer', 'bus', 'case',
      'component', 'configuration', 'constant', 'disconnect', 'downto', 'else',
      'elsif', 'end', 'entity', 'exit', 'file', 'for', 'function', 'generate',
      'generic', 'group', 'guarded', 'if', 'impure', 'in', 'inertial', 'inout',
      'is', 'label', 'library', 'linkage', 'literal', 'loop', 'map', 'mod', 'nand',
      'new', 'next', 'nor', 'not', 'null', 'of', 'on', 'open', 'or', 'others',
      'out', 'package', 'port', 'postponed', 'procedure', 'process', 'pure',
      'range', 'record', 'register', 'reject', 'rem', 'report', 'return', 'rol',
      'ror', 'select', 'severity', 'signal', 'shared', 'sla', 'sll', 'sra', 'srl',
      'subtype', 'then', 'to', 'transport', 'type', 'unaffected', 'units', 'until',
      'use', 'variable', 'wait', 'when', 'while', 'with', 'xnor', 'xor'
    ],

    types: [
      'std_logic', 'std_logic_vector', 'std_ulogic', 'std_ulogic_vector',
      'signed', 'unsigned', 'integer', 'natural', 'positive', 'boolean',
      'bit', 'bit_vector', 'character', 'string', 'time', 'real', 'line', 'text'
    ],

    stdFunctions: [
      'rising_edge', 'falling_edge', 'to_integer', 'to_unsigned', 'to_signed',
      'resize', 'conv_integer', 'conv_std_logic_vector'
    ],

    attributes: [
      'event', 'active', 'last_event', 'last_active', 'last_value',
      'driving', 'driving_value', 'delayed', 'stable', 'quiet', 'transaction',
      'length', 'left', 'right', 'low', 'high', 'range', 'reverse_range',
      'ascending', 'image', 'value', 'pos', 'val', 'succ', 'pred',
      'leftof', 'rightof'
    ],

    operators: [
      '<=', ':=', '=>', '=', '/=', '<', '<=', '>', '>=',
      '+', '-', '*', '/', '&', '**'
    ],

    tokenizer: {
      root: [
        // Comments
        [/--.*$/, 'comment'],

        // Attributes (e.g. 'event, 'range)
        [/'[a-zA-Z_]\w*/, {
          cases: {
            '@attributes': 'type.identifier',
            '@default': 'variable'
          }
        }],

        // Characters (e.g. '0', '1', 'Z')
        [/'[^']'/, 'string'],

        // Strings
        [/"([^"\\]|\\.)*"/, 'string'],

        // Identifiers & Keywords
        [/[a-zA-Z_]\w*/, {
          cases: {
            '@keywords': 'keyword',
            '@types': 'type',
            '@stdFunctions': 'predefined',
            '@default': 'identifier'
          }
        }],

        // Numbers (based on integer, real, bit-string e.g. X"A5", B"1010", 16#FF#)
        [/\b[xX]"[0-9a-fA-F_]+"|\b[bB]"[01_]+"|\b[oO]"[0-7_]+"/, 'number.hex'],
        [/\d+#\w+#/, 'number.hex'],
        [/\d+(\.\d+)?([eE][+-]?\d+)?/, 'number'],

        // Operators & Delimiters
        [/<=|:=|=>|\/=|[<>=+\-*/&]/, 'operator'],
        [/[()[\];,:]/, 'delimiter'],

        // Whitespace
        [/\s+/, 'white'],
      ]
    }
  });

  // 4. Hover Provider
  monaco.languages.registerHoverProvider('vhdl', {
    provideHover: async (_model, position) => {
      const code = _model.getValue();
      const line = position.lineNumber;
      const col = position.column;
      const res = await engineBridge.hoverVhdl(code, line, col);
      if (!res) return null;
      return {
        contents: [{ value: res.contents }],
      };
    },
  });

  // 5. Completion Provider
  monaco.languages.registerCompletionItemProvider('vhdl', {
    triggerCharacters: [' ', '.', '(', ':'],
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
            label: 'entity',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'entity ${1:name} is\n\tport (\n\t\tclk   : in  std_logic;\n\t\trst_n : in  std_logic\n\t);\nend entity ${1:name};',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: 'VHDL Entity Declaration',
            documentation: 'Declare a standard VHDL hardware entity.',
            range
          },
          {
            label: 'architecture',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'architecture rtl of ${1:entity_name} is\nbegin\n\t$0\nend architecture rtl;',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: 'VHDL Architecture Body',
            documentation: 'Implement architecture logic for an entity.',
            range
          },
          {
            label: 'process_clocked',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'process(clk, rst_n)\nbegin\n\tif rst_n = \'0\' then\n\t\t$0\n\telsif rising_edge(clk) then\n\t\t\n\tend if;\nend process;',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: 'Clocked Sequential Process',
            documentation: 'Synchronous edge-triggered process with asynchronous active-low reset.',
            range
          },
          {
            label: 'std_logic_vector',
            kind: monaco.languages.CompletionItemKind.TypeParameter,
            insertText: 'std_logic_vector(${1:7} downto 0)',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: 'Standard Bit Vector',
            documentation: 'Descending std_logic_vector array.',
            range
          }
        ]
      };
    }
  });
}
