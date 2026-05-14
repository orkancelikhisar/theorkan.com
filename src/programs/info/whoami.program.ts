import type { Program } from '../../kernel/program';
import bio from '../../content/bio.json';

const prog: Program = {
  name: 'whoami',
  manpage: 'whoami — return a short bio fragment for orkan.',
  category: 'info',
  mode: 'inline',
  onCommand: () => bio.fragments[Math.floor(Math.random() * bio.fragments.length)],
};

export default prog;
