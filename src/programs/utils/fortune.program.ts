import type { Program } from '../../kernel/program';
import fortunes from '../../content/fortunes.json';

const prog: Program = {
  name: 'fortune',
  manpage: 'fortune — a small fragment.',
  category: 'util',
  mode: 'inline',
  onCommand: () => fortunes[Math.floor(Math.random() * fortunes.length)],
};

export default prog;
