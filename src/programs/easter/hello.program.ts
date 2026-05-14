import type { Program } from '../../kernel/program';
const prog: Program = {
  name: 'hello',
  aliases: ['hello-world'],
  manpage: 'hello — a polite reply.',
  category: 'easter',
  mode: 'inline',
  onCommand: () => 'hi.',
};
export default prog;
