const KEY = 'theorkan.shell.history';
const MAX = 500;

export function createHistory() {
  let entries: string[] = [];
  let cursor = -1;
  let savedBuffer = '';

  try { entries = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { entries = []; }

  function persist(): void {
    try { localStorage.setItem(KEY, JSON.stringify(entries)); } catch { /* quota */ }
  }

  return {
    add(line: string): void {
      const trimmed = line.trim();
      if (!trimmed) return;
      if (entries[entries.length - 1] === trimmed) return;
      entries.push(trimmed);
      if (entries.length > MAX) entries = entries.slice(-MAX);
      cursor = -1;
      persist();
    },
    prev(currentBuffer: string): string | null {
      if (entries.length === 0) return null;
      if (cursor === -1) savedBuffer = currentBuffer;
      cursor = Math.min(cursor + 1, entries.length - 1);
      return entries[entries.length - 1 - cursor];
    },
    next(): string | null {
      if (cursor <= 0) {
        cursor = -1;
        return savedBuffer;
      }
      cursor -= 1;
      return entries[entries.length - 1 - cursor];
    },
    resetCursor(): void { cursor = -1; savedBuffer = ''; },
    all(): string[] { return [...entries]; },
    clear(): void { entries = []; cursor = -1; persist(); },
  };
}
