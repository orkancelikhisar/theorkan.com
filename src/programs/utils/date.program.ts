import type { Program } from '../../kernel/program';

const prog: Program = {
  name: 'date',
  manpage: 'date — local date/time.',
  category: 'util',
  mode: 'inline',
  onCommand: () => {
    const d = new Date();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return `${d.toDateString()} ${d.toTimeString().split(' ')[0]} (${tz})`;
  },
};

export default prog;
