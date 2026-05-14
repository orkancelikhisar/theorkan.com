import type { Program } from '../../kernel/program';

function cowsay(msg: string): string {
  const text = msg || 'mooo';
  const bar = '─'.repeat(text.length + 2);
  return [
    ' ' + bar,
    `< ${text} >`,
    ' ' + bar,
    '   \\   ^__^',
    '    \\  (oo)\\_______',
    '       (__)\\       )\\/\\',
    '           ||----w |',
    '           ||     ||',
  ].join('\n');
}

const prog: Program = {
  name: 'cowsay',
  manpage: 'cowsay <msg> — the cow says. it speaks turkish on tuesdays.',
  category: 'util',
  mode: 'inline',
  onCommand: (_ctx, argv) => cowsay(argv.slice(1).join(' ')),
};

export default prog;
