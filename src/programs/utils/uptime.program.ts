import type { Program } from '../../kernel/program';

const BOOT_TIME_KEY = 'theorkan.session.start';

const prog: Program = {
  name: 'uptime',
  manpage: 'uptime — session uptime.',
  category: 'util',
  mode: 'inline',
  onCommand: () => {
    const start = parseInt(sessionStorage.getItem(BOOT_TIME_KEY) || String(Date.now()), 10);
    const secs = Math.floor((Date.now() - start) / 1000);
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return ` up ${h}h ${m}m ${s}s, 1 user, load average: not really.`;
  },
};

export default prog;
