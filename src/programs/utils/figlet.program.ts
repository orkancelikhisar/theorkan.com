import type { Program } from '../../kernel/program';

const SPACE = ['     ', '     ', '     ', '     ', '     '];
const GLYPHS: Record<string, string[]> = {
  ' ': SPACE,
  '0': [' ███ ', '█   █', '█   █', '█   █', ' ███ '],
  '1': ['  █  ', ' ██  ', '  █  ', '  █  ', ' ███ '],
  '2': [' ███ ', '█   █', '   █ ', '  █  ', '█████'],
  '3': [' ███ ', '█   █', '   █ ', '█   █', ' ███ '],
  '4': ['█   █', '█   █', '█████', '    █', '    █'],
  '5': ['█████', '█    ', '████ ', '    █', '████ '],
  '6': [' ███ ', '█    ', '████ ', '█   █', ' ███ '],
  '7': ['█████', '    █', '   █ ', '  █  ', '  █  '],
  '8': [' ███ ', '█   █', ' ███ ', '█   █', ' ███ '],
  '9': [' ███ ', '█   █', ' ████', '    █', ' ███ '],
};

// Compact letter glyphs — 5-line block per letter.
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
for (const ch of LETTERS) {
  GLYPHS[ch] = [
    '█████',
    `█ ${ch.toUpperCase()} █`,
    '█████',
    '     ',
    '     ',
  ];
}

function figlet(text: string): string {
  const lower = text.toLowerCase();
  const rows = ['', '', '', '', ''];
  for (const ch of lower) {
    const glyph = GLYPHS[ch] || SPACE;
    for (let i = 0; i < 5; i++) rows[i] += glyph[i] + ' ';
  }
  return rows.join('\n');
}

const prog: Program = {
  name: 'figlet',
  manpage: 'figlet <text> — large block letters.',
  category: 'util',
  mode: 'inline',
  onCommand: (_ctx, argv) => {
    const text = argv.slice(1).join(' ');
    if (!text) return 'figlet: nothing to write.';
    return figlet(text);
  },
};

export default prog;
