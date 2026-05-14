import type { Program } from '../../kernel/program';

const prog: Program = {
  name: '__echo_test__',
  manpage: 'internal test program — do not list',
  category: 'meta',
  mode: 'inline',
  onCommand: (_ctx, argv) => argv.slice(1).join(' '),
};

export default prog;
