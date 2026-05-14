import type { Program } from '../../kernel/program';

const prog: Program = {
  name: 'secrets',
  manpage: 'secrets — list things you have personally found.',
  category: 'discovery',
  mode: 'inline',
  onCommand: () => {
    let found: string[] = [];
    try { found = JSON.parse(localStorage.getItem('theorkan.discoveries') || '[]'); } catch { /* */ }
    if (found.length === 0) {
      return 'your discoveries: none yet. wander.';
    }
    const sorted = [...found].sort();
    return ['', `your discoveries (${sorted.length}):`, '', ...sorted.map((c) => `  - ${c}`), ''].join('\n');
  },
};

export default prog;
