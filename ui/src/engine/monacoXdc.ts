import type * as Monaco from 'monaco-editor';
import { engineBridge } from './engineBridge';

let isRegistered = false;

export function registerXdcLanguage(monaco: typeof Monaco) {
  if (isRegistered) return;
  isRegistered = true;

  // 1. Register Language ID
  monaco.languages.register({
    id: 'xdc',
    extensions: ['.xdc', '.sdc'],
    aliases: ['XDC', 'Vivado Constraints', 'SDC'],
  });

  // 2. Set Language Configuration
  monaco.languages.setLanguageConfiguration('xdc', {
    comments: {
      lineComment: '#',
    },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"', notIn: ['string', 'comment'] },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
    ],
    folding: {
      markers: {
        start: /^\s*#\s*#?region\b/,
        end: /^\s*#\s*#?endregion\b/,
      },
      offSide: false,
    },
  });

  // 3. Monarch Tokenizer with Axiom Engineering Palette
  monaco.languages.setMonarchTokensProvider('xdc', {
    defaultToken: '',
    tokenPostfix: '.xdc',

    keywords: [
      'set_property', 'create_clock', 'create_generated_clock',
      'set_input_delay', 'set_output_delay', 'set_false_path',
      'set_max_delay', 'set_min_delay', 'set_multicycle_path',
      'set_clock_groups', 'set_operating_conditions', 'set_case_analysis',
      'set_disable_timing', 'get_ports', 'get_pins', 'get_cells',
      'get_nets', 'get_clocks', 'all_inputs', 'all_outputs', 'all_clocks',
      'current_design', 'set', 'puts', 'expr', 'if', 'else', 'foreach',
      'break', 'continue'
    ],

    properties: [
      'PACKAGE_PIN', 'IOSTANDARD', 'DRIVE', 'SLEW', 'PULLUP', 'PULLDOWN',
      'DIFF_TERM', 'DIFF_TERM_ADV', 'IN_TERM', 'OFFCHIP_TERM', 'KEEPER',
      'DONT_TOUCH', 'MARK_DEBUG', 'LOC', 'BEL', 'PROHIBIT',
      'CLOCK_DEDICATED_ROUTE', 'VCCAUX_IO', 'IBUF_LOW_PWR', 'LUTNM', 'HLUTNM'
    ],

    standards: [
      'LVCMOS33', 'LVCMOS25', 'LVCMOS18', 'LVCMOS15', 'LVCMOS12',
      'LVDS', 'LVDS_25', 'TMDS_33', 'SSTL15', 'SSTL15_R', 'SSTL135',
      'SSTL135_R', 'DIFF_SSTL15', 'DIFF_SSTL15_R', 'DIFF_SSTL135',
      'DIFF_SSTL135_R', 'HSTL_I', 'HSTL_II', 'HSTL_I_18', 'HSTL_II_18',
      'MOBILE_DDR', 'PCI33_3'
    ],

    tokenizer: {
      root: [
        // Comments
        [/#.*$/, 'comment'],

        // Flags (e.g. -period, -name, -waveform, -source, -clock, -asynchronous)
        [/-\w+/, 'predefined'],

        // Identifiers and Keywords
        [/[a-zA-Z_$][\w$]*/, {
          cases: {
            '@keywords': 'keyword',
            '@properties': 'type',
            '@standards': 'string',
            '@default': 'identifier'
          }
        }],

        // Package Pin Names (e.g. J15, L16, M13, H17, W5, AA1, V12)
        [/\b[A-Z]{1,2}\d{1,3}\b/, 'number'],

        // Numeric Literals (clock periods, delay values)
        [/\b\d+(\.\d+)?\b/, 'number'],

        // Variables
        [/\$[a-zA-Z_]\w*/, 'predefined'],

        // Delimiters
        [/[{}[\]()]/, 'delimiter'],

        // Strings
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],

        // Whitespace
        { include: '@whitespace' },
      ],

      string: [
        [/[^\\"]+/, 'string'],
        [/\\./, 'string.escape'],
        [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }]
      ],

      whitespace: [
        [/[ \t\r\n]+/, 'white'],
      ],
    },
  });

  // 4. Register Completion Provider
  monaco.languages.registerCompletionItemProvider('xdc', {
    triggerCharacters: [' ', '-', '[', '{'],
    async provideCompletionItems(model, position) {
      try {
        const text = model.getValue();
        const items = await engineBridge.completeXdc(text, position.lineNumber, position.column);
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
        console.error('[monacoXdc] Autocompletion failed:', err);
        return { suggestions: [] };
      }
    },
  });

  // 5. Register Hover Provider
  monaco.languages.registerHoverProvider('xdc', {
    async provideHover(model, position) {
      try {
        const text = model.getValue();
        const res = await engineBridge.hoverXdc(text, position.lineNumber, position.column);
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
        console.error('[monacoXdc] Hover lookup failed:', err);
        return null;
      }
    },
  });
}
