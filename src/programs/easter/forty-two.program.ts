import type { Program } from '../../kernel/program';
const prog: Program = {
  name: '42',
  manpage: '42 — the question is harder.',
  category: 'easter',
  mode: 'inline',
  onCommand: () => 'the question is harder.',
};
export default prog;
