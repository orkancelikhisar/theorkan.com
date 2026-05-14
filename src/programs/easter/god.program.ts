import type { Program } from '../../kernel/program';
const prog: Program = {
  name: 'god',
  manpage: 'god — a single eye.',
  category: 'easter',
  mode: 'inline',
  onCommand: () => [
    '',
    '         ╭───╮',
    '        ( ◉ )',
    '         ╰───╯',
    '',
  ].join('\n'),
};
export default prog;
