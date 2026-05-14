import type { Program } from '../../kernel/program';
const prog: Program = {
  name: 'vim',
  manpage: 'vim — you couldn\'t if you tried.',
  category: 'easter',
  mode: 'inline',
  onCommand: () => 'you couldn\'t if you tried.',
};
export default prog;
