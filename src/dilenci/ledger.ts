// Offering ledger (§8.11). Capped at 200 entries. Last 10 fed to LLM context.
// Also surfaces as a file at /home/orkan/.dilenci/ledger.txt — that path is
// written via the fs diff layer by the daemon when an offering lands.

const LEDGER_KEY = 'dilenci.ledger';
const CAP = 200;

export interface LedgerEntry { ts: number; text: string }

export interface LedgerAPI {
  all(): LedgerEntry[];
  append(text: string): void;
  recent(n?: number): LedgerEntry[];
  asFileContent(): string;
}

function fmtTs(ms: number): string {
  const d = new Date(ms);
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`;
}

export function createLedger(): LedgerAPI {
  function load(): LedgerEntry[] {
    try {
      const raw = localStorage.getItem(LEDGER_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw) as LedgerEntry[];
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }
  function save(arr: LedgerEntry[]): void {
    localStorage.setItem(LEDGER_KEY, JSON.stringify(arr.slice(-CAP)));
  }

  return {
    all: load,
    append(text) {
      const arr = load();
      arr.push({ ts: Date.now(), text: text.trim() });
      save(arr);
    },
    recent(n = 10) { return load().slice(-n); },
    asFileContent() {
      return load().map((e) => `[${fmtTs(e.ts)}]   ${e.text}`).join('\n');
    },
  };
}
