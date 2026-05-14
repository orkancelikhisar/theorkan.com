import './boot.css';
import motdLines from '../content/boot-motd.json';
import warnLines from '../content/boot-warn.json';
import curiosityLines from '../content/boot-curiosity.json';
import dilenciLines from '../content/boot-dilenci.json';
import type { AudioAPI } from '../audio/audio';

const VISIT_KEY = 'theorkan.boot.lastVisit';
const SESSION_COUNT = 'theorkan.boot.sessions';

type BootLineKind = 'ok' | 'warn' | 'defer' | 'curious' | 'motd' | 'plain' | 'prompt';

interface BootLine { kind: BootLineKind; text: string; }

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function now(): string {
  const d = new Date();
  const z = (n: number) => String(n).padStart(2, '0');
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const tzParts = Intl.DateTimeFormat().resolvedOptions().timeZone.split('/');
  const tz = tzParts[tzParts.length - 1] || 'UTC';
  return `${days[d.getDay()]} ${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())} (${tz})`;
}

function lastSeenPhrase(): string | null {
  const last = parseInt(localStorage.getItem(VISIT_KEY) || '0', 10);
  if (!last) return null;
  const diff = Date.now() - last;
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return 'a few minutes ago';
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function readLedgerHas(): boolean {
  try {
    const diff = JSON.parse(localStorage.getItem('theorkan.fs.diff') || '{}');
    const ledger = diff['/home/orkan/.dilenci/ledger.txt']?.content;
    return !!(ledger && ledger.trim().length > 0);
  } catch { return false; }
}

export function buildBootScript(): BootLine[] {
  const lines: BootLine[] = [];
  const lastSeen = lastSeenPhrase();
  const hasLedger = readLedgerHas();

  lines.push({ kind: 'plain', text: `theOrkan.OS v0.1.0 — booted ${now()}` });
  if (lastSeen) {
    lines.push({ kind: 'plain', text: `welcome back. last seen ${lastSeen}.` });
  } else {
    lines.push({ kind: 'plain', text: 'copyright (c) orkan, mostly' });
  }
  lines.push({ kind: 'plain', text: '' });

  lines.push({ kind: 'ok', text: '[ OK ] memcheck                  1024 KB / 1024 KB' });
  lines.push({ kind: 'ok', text: '[ OK ] cpu: 1 core (yours)' });
  lines.push({ kind: 'ok', text: '[ OK ] mounting /                ext-fake' });
  lines.push({ kind: 'ok', text: '[ OK ] mounting /var/log' });
  lines.push({ kind: 'ok', text: '[ OK ] mounting /var/regret      62 entries' });
  lines.push({ kind: 'ok', text: '[ OK ] mounting /dev             heart, wind, harbor, salt, regret' });
  lines.push({ kind: 'ok', text: '[ OK ] mounting /usr/share/poems 23 fragments' });
  lines.push({ kind: 'ok', text: '[ OK ] driver: keyboard' });
  lines.push({ kind: 'ok', text: '[ OK ] driver: void              drift, whisper, shine' });
  lines.push({ kind: 'ok', text: '[ OK ] driver: ascii             release 1979' });
  lines.push({ kind: 'warn', text: `[ WARN ] ${pick(warnLines)}` });
  lines.push({ kind: 'ok', text: '[ OK ] init: shell               ready' });
  lines.push({ kind: 'ok', text: '[ OK ] init: filesystem          47 files indexed' });
  lines.push({ kind: 'ok', text: '[ OK ] init: motd                rotated' });

  if (hasLedger) {
    lines.push({ kind: 'defer', text: `[ .. ] locating postmodern_dilenci ............... ${pick(dilenciLines)}` });
  } else {
    lines.push({ kind: 'defer', text: '[ .. ] locating postmodern_dilenci ............... deferred (he sleeps)' });
  }

  lines.push({ kind: 'ok', text: '[ OK ] init: void daemon         drift enabled' });
  lines.push({ kind: 'ok', text: '[ OK ] init: stowaway daemon     caught one' });
  if (Math.random() < 0.7) {
    lines.push({ kind: 'curious', text: `[ ?? ] ${pick(curiosityLines)}` });
  }

  lines.push({ kind: 'plain', text: '' });
  lines.push({ kind: 'motd', text: `motd: ${pick(motdLines)}` });
  lines.push({ kind: 'motd', text: '      try `hints` if you are lost.' });
  lines.push({ kind: 'plain', text: '' });

  if (lastSeen) {
    lines.push({ kind: 'prompt', text: 'orkan@theorkan:~$ ' });
  } else {
    lines.push({ kind: 'prompt', text: '> press enter to wake up_' });
  }

  return lines;
}

export interface BootAPI {
  run(target: HTMLElement): Promise<void>;
  markSeen(): void;
}

export function createBoot(audio: AudioAPI): BootAPI {
  return {
    async run(target) {
      const box = document.createElement('div');
      box.className = 'boot';
      target.appendChild(box);
      const script = buildBootScript();

      for (const line of script) {
        const el = document.createElement('div');
        el.className = `boot__line boot__line--${line.kind}`;
        el.textContent = line.text;
        box.appendChild(el);
        if (line.kind === 'ok')      audio.play('boot.ok', 'void');
        else if (line.kind === 'warn') audio.play('boot.warn', 'void');
        else if (line.kind === 'prompt') audio.play('boot.complete', 'void');
        await new Promise((r) => setTimeout(r, 90 + Math.random() * 60));
      }

      // wait for first keypress to wake up
      await new Promise<void>((resolve) => {
        const handler = (e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            window.removeEventListener('keydown', handler);
            resolve();
          }
        };
        window.addEventListener('keydown', handler);
      });

      box.remove();
    },
    markSeen() {
      localStorage.setItem(VISIT_KEY, String(Date.now()));
      const n = parseInt(localStorage.getItem(SESSION_COUNT) || '0', 10);
      localStorage.setItem(SESSION_COUNT, String(n + 1));
    },
  };
}
