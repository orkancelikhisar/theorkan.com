import type { FSSnapshot, FSNode } from './fs-types';

const DIFF_KEY = 'theorkan.fs.diff';
const WRITABLE_PREFIXES = ['/home/orkan/notes', '/home/orkan/scratch', '/home/orkan/.dilenci'];

interface DiffEntry { path: string; content: string; mtime: number; deleted?: boolean; }
type Diff = Record<string, DiffEntry>;

function loadDiff(): Diff {
  try { return JSON.parse(localStorage.getItem(DIFF_KEY) || '{}'); }
  catch { return {}; }
}
function saveDiff(diff: Diff): void {
  try { localStorage.setItem(DIFF_KEY, JSON.stringify(diff)); } catch { /* quota */ }
}

function normalize(path: string, cwd = '/home/orkan'): string {
  let p = path;
  if (p.startsWith('~')) p = '/home/orkan' + p.slice(1);
  if (!p.startsWith('/')) p = (cwd === '/' ? '' : cwd) + '/' + p;
  const parts = p.split('/').filter(Boolean);
  const out: string[] = [];
  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return '/' + out.join('/');
}

function getNode(snapshot: FSSnapshot, path: string): FSNode | null {
  if (path === '/' || path === '') return snapshot;
  const parts = path.split('/').filter(Boolean);
  let n: FSNode = snapshot;
  for (const p of parts) {
    if (!n.children || !n.children[p]) return null;
    n = n.children[p];
  }
  return n;
}

export function createFS(snapshot: FSSnapshot) {
  let diff = loadDiff();

  function isWritable(path: string): boolean {
    return WRITABLE_PREFIXES.some((p) => path.startsWith(p));
  }

  return {
    resolve(path: string, cwd = '/home/orkan'): string {
      return normalize(path, cwd);
    },
    exists(path: string): boolean {
      const norm = normalize(path);
      if (diff[norm]) return !diff[norm].deleted;
      return getNode(snapshot, norm) !== null;
    },
    read(path: string): string {
      const norm = normalize(path);
      const d = diff[norm];
      if (d && !d.deleted) return d.content;
      if (d && d.deleted) throw new Error(`cat: ${path}: no such file or directory`);
      const node = getNode(snapshot, norm);
      if (!node) throw new Error(`cat: ${path}: no such file or directory`);
      if (node.type === 'device' && node.reader) return node.reader();
      if (node.type !== 'file' || node.content == null) {
        throw new Error(`cat: ${path}: is not a regular file`);
      }
      return node.content;
    },
    list(path: string): string[] {
      const norm = normalize(path);
      const node = getNode(snapshot, norm);
      if (!node || node.type !== 'dir' || !node.children) {
        throw new Error(`ls: ${path}: no such directory`);
      }
      const names = new Set(Object.keys(node.children));
      for (const [diffPath, entry] of Object.entries(diff)) {
        if (entry.deleted) continue;
        const dirPath = diffPath.slice(0, diffPath.lastIndexOf('/'));
        const name = diffPath.slice(diffPath.lastIndexOf('/') + 1);
        if (dirPath === (norm === '/' ? '' : norm)) names.add(name);
      }
      // Remove names marked as deleted in diff
      for (const [diffPath, entry] of Object.entries(diff)) {
        if (!entry.deleted) continue;
        const dirPath = diffPath.slice(0, diffPath.lastIndexOf('/'));
        const name = diffPath.slice(diffPath.lastIndexOf('/') + 1);
        if (dirPath === (norm === '/' ? '' : norm)) names.delete(name);
      }
      return [...names].sort();
    },
    listDetailed(path: string): Array<{ name: string; node: FSNode | DiffEntry }> {
      const norm = normalize(path);
      const node = getNode(snapshot, norm);
      const out: Array<{ name: string; node: FSNode | DiffEntry }> = [];
      if (node && node.type === 'dir' && node.children) {
        for (const [name, child] of Object.entries(node.children)) {
          const full = (norm === '/' ? '' : norm) + '/' + name;
          if (diff[full]?.deleted) continue;
          out.push({ name, node: child });
        }
      }
      for (const [diffPath, entry] of Object.entries(diff)) {
        if (entry.deleted) continue;
        const dirPath = diffPath.slice(0, diffPath.lastIndexOf('/'));
        if (dirPath === (norm === '/' ? '' : norm)) {
          const name = diffPath.slice(diffPath.lastIndexOf('/') + 1);
          if (!out.find((o) => o.name === name)) out.push({ name, node: entry });
        }
      }
      return out.sort((a, b) => a.name.localeCompare(b.name));
    },
    write(path: string, content: string): void {
      const norm = normalize(path);
      if (!isWritable(norm)) {
        throw new Error(`read-only filesystem (this is a memory, not a notebook).`);
      }
      diff[norm] = { path: norm, content, mtime: Date.now() };
      // Cap at 50KB total
      const total = Object.values(diff).reduce((s, e) => s + (e.content?.length || 0), 0);
      if (total > 50_000) {
        const sorted = Object.entries(diff).sort((a, b) => a[1].mtime - b[1].mtime);
        let running = total;
        while (sorted.length > 0 && running > 50_000) {
          const [k, v] = sorted.shift()!;
          running -= v.content?.length || 0;
          delete diff[k];
        }
      }
      saveDiff(diff);
    },
    remove(path: string): void {
      const norm = normalize(path);
      if (!isWritable(norm)) {
        throw new Error(`read-only filesystem (this is a memory, not a notebook).`);
      }
      diff[norm] = { path: norm, content: '', mtime: Date.now(), deleted: true };
      saveDiff(diff);
    },
    reset(): void {
      diff = {};
      localStorage.removeItem(DIFF_KEY);
    },
    getNode(path: string): FSNode | null {
      return getNode(snapshot, normalize(path));
    },
    registerDevice(name: string, reader: () => string): void {
      const dev = snapshot.children?.dev;
      if (!dev || !dev.children) return;
      dev.children[name] = { type: 'device', reader, meta: { owner: 'orkan', group: 'orkan', perms: 'crw-r--r--' } };
    },
  };
}

export type FS = ReturnType<typeof createFS>;
