import type { Program } from '../../kernel/program';

const prog: Program = {
  name: 'contact',
  manpage: 'contact — how to reach orkan.',
  category: 'info',
  mode: 'inline',
  onCommand: () => [
    '',
    '  linkedin    https://www.linkedin.com/in/orkan00/',
    '',
    '  (everything else lives in here.)',
    '',
  ].join('\n'),
};

export default prog;
