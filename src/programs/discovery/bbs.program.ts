import type { Program } from '../../kernel/program';
import bbs from '../../content/bbs.json';

const prog: Program = {
  name: 'bbs',
  aliases: ['noticeboard'],
  manpage: 'bbs — the noticeboard. old messages.',
  category: 'discovery',
  mode: 'inline',
  onCommand: () => {
    const sorted = [...bbs].sort((a, b) => b.date.localeCompare(a.date));
    return ['', '— noticeboard —', '', ...sorted.map((m) => `${m.date}  ${m.from.padEnd(10)}  ${m.msg}`), ''].join('\n');
  },
};

export default prog;
