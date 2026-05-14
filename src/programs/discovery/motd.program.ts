import type { Program } from '../../kernel/program';
import motdLines from '../../content/boot-motd.json';

let cached: string | null = null;
function todayMotd(): string {
  if (cached) return cached;
  const day = Math.floor(Date.now() / (24 * 3_600_000));
  cached = motdLines[day % motdLines.length];
  return cached;
}

const prog: Program = {
  name: 'motd',
  manpage: 'motd — message of the day. rotates daily.',
  category: 'discovery',
  mode: 'inline',
  onCommand: () => `motd: ${todayMotd()}`,
};

export default prog;
