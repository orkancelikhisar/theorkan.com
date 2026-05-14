import type { Program } from '../../kernel/program';
import bio from '../../content/bio.json';

const prog: Program = {
  name: 'about',
  manpage: 'about — print a longer narrative bio.',
  category: 'info',
  mode: 'inline',
  onCommand: () => bio.narrative.join('\n'),
};

export default prog;
