import type { FS } from './fs';
import type { Program } from './program';
import { tokenize, expandGlobs } from './parser';
import type { FSNode } from './fs-types';

export interface ShellState {
  cwd: string;
  previousCwd: string;
  aliases: Record<string, string>;
  vibeLevel: 'off' | 'low' | 'medium' | 'high';
}

export type BuiltinHandler = (
  argv: string[],
  state: ShellState,
  fs: FS,
  out: (line: string) => void,
) => void | { newCwd?: string };

export const BUILTIN_NAMES = [
  'cd', 'pwd', 'ls', 'cat', 'echo', 'clear', 'history', 'alias',
  'find', 'grep', 'touch', 'rm', 'mv', 'cp',
  'tree', 'which', 'whatis', 'reset', 'vibe', 'mute', 'unmute',
];

interface AudioCtl {
  setVibe(level: ShellState['vibeLevel']): void;
  mute(): void;
  unmute(): void;
  isMuted(): boolean;
  getVibe(): string;
}

export function createBuiltins(
  fs: FS,
  state: ShellState,
  registry: Map<string, Program>,
  _discoveredCmds: Set<string>,
  audio: AudioCtl,
  termClear: () => void,
  historyAll: () => string[],
): Record<string, BuiltinHandler> {
  function formatPerms(perms: string | undefined, type: string): string {
    if (perms) return perms;
    if (type === 'dir') return 'drwxr-xr-x';
    if (type === 'device') return 'crw-r--r--';
    return '-rw-r--r--';
  }
  function fmtSize(n: number | undefined): string {
    if (n == null) return '    -';
    return String(n).padStart(5);
  }
  function fmtDate(ms: number | undefined): string {
    const d = new Date(ms || Date.now());
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2)} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  return {
    cd: (argv, _s, _fs, out) => {
      let target = argv[1] || '~';
      // `cd -` (and `cd --`) jumps to the previous directory, bash-style.
      if (target === '-' || target === '--') {
        if (!state.previousCwd) { out('cd: OLDPWD not set'); return; }
        target = state.previousCwd;
      }
      // Friendly fallback: bare names like `cd dev` should also find /dev
      // when there's no `./dev` in the current directory.
      let resolved = fs.resolve(target, state.cwd);
      if (!fs.exists(resolved) && !target.startsWith('/') && !target.startsWith('~') && !target.startsWith('.')) {
        const abs = fs.resolve('/' + target);
        if (fs.exists(abs)) resolved = abs;
      }
      if (!fs.exists(resolved)) { out(`cd: ${argv[1]}: no such file or directory`); return; }
      const node = fs.getNode(resolved);
      if (!node || node.type !== 'dir') { out(`cd: ${argv[1]}: not a directory`); return; }
      state.previousCwd = state.cwd;
      return { newCwd: resolved };
    },
    pwd: (_argv, _s, _fs, out) => out(state.cwd),
    ls: (argv, _s, _fs, out) => {
      const flags = argv.filter((a) => a.startsWith('-')).join('');
      const path = argv.find((a, i) => i > 0 && !a.startsWith('-')) || state.cwd;
      const resolved = fs.resolve(path, state.cwd);
      try {
        if (flags.includes('l') || flags.includes('a')) {
          const items = fs.listDetailed(resolved);
          const showHidden = flags.includes('a');
          for (const it of items) {
            if (!showHidden && it.name.startsWith('.')) continue;
            const node = it.node as FSNode;
            const type = node.type || 'file';
            const perms = formatPerms(node.meta?.perms, type);
            out(`${perms}  orkan orkan ${fmtSize(node.meta?.size)}  ${fmtDate(node.meta?.mtime)} ${it.name}${type === 'dir' ? '/' : ''}`);
          }
        } else {
          const names = fs.list(resolved);
          out(names.filter((n) => !n.startsWith('.')).join('  '));
        }
      } catch (e) { out((e as Error).message); }
    },
    cat: (argv, _s, _fs, out) => {
      const paths = argv.slice(1);
      if (paths.length === 0) return;
      for (const p of paths) {
        try {
          out(fs.read(fs.resolve(p, state.cwd)));
        } catch (e) { out((e as Error).message); }
      }
    },
    echo: (argv, _s, _fs, out) => out(argv.slice(1).join(' ')),
    clear: () => { termClear(); },
    history: (_argv, _s, _fs, out) => {
      const all = historyAll();
      all.forEach((cmd, i) => out(`${String(i + 1).padStart(4)}  ${cmd}`));
    },
    alias: (_argv, _s, _fs, out) => {
      for (const [k, v] of Object.entries(state.aliases)) out(`alias ${k}='${v}'`);
    },
    find: (argv, _s, _fs, out) => {
      // Easter egg: find love
      if (argv.length >= 2 && argv.slice(1).join(' ').trim() === 'love') {
        out('search returned 0 results. (try /usr/share/poems/)');
        return;
      }
      const startArg = argv.find((a, i) => i > 0 && !a.startsWith('-') && argv[i-1] !== '-name');
      const nameIdx = argv.indexOf('-name');
      const pattern = nameIdx >= 0 ? argv[nameIdx + 1] : '*';
      const start = fs.resolve(startArg || state.cwd, state.cwd);
      const results: string[] = [];
      function walk(path: string): void {
        const node = fs.getNode(path);
        if (!node) return;
        if (node.type === 'dir' && node.children) {
          for (const [name, child] of Object.entries(node.children)) {
            const full = (path === '/' ? '' : path) + '/' + name;
            const re = new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
            if (re.test(name)) results.push(full + (child.type === 'dir' ? '/' : ''));
            if (child.type === 'dir') walk(full);
          }
        }
      }
      walk(start);
      results.forEach(out);
    },
    grep: (argv, _s, _fs, out) => {
      const flags = argv.filter((a) => a.startsWith('-')).join('');
      const rest = argv.filter((a) => !a.startsWith('-')).slice(1);
      const [pattern, ...paths] = rest;
      if (!pattern) { out('grep: missing pattern'); return; }
      const re = new RegExp(pattern, flags.includes('i') ? 'i' : '');
      const recursive = flags.includes('r') || flags.includes('R');
      function search(path: string): void {
        const node = fs.getNode(path);
        if (!node) return;
        if (node.type === 'file' && node.content) {
          node.content.split('\n').forEach((line, i) => {
            if (re.test(line)) out(`${path}:${i+1}: ${line}`);
          });
        } else if (node.type === 'dir' && recursive && node.children) {
          for (const [name] of Object.entries(node.children)) {
            search((path === '/' ? '' : path) + '/' + name);
          }
        }
      }
      for (const p of (paths.length ? paths : [state.cwd])) {
        search(fs.resolve(p, state.cwd));
      }
    },
    touch: (argv, _s, _fs, out) => {
      if (!argv[1]) return;
      try { fs.write(fs.resolve(argv[1], state.cwd), ''); }
      catch (e) { out((e as Error).message); }
    },
    rm: (argv, _s, _fs, out) => {
      if (!argv[1]) return;
      try { fs.remove(fs.resolve(argv[1], state.cwd)); }
      catch (e) { out((e as Error).message); }
    },
    mv: (argv, _s, _fs, out) => {
      const [, src, dst] = argv;
      try {
        const content = fs.read(fs.resolve(src, state.cwd));
        fs.write(fs.resolve(dst, state.cwd), content);
        fs.remove(fs.resolve(src, state.cwd));
      } catch (e) { out((e as Error).message); }
    },
    cp: (argv, _s, _fs, out) => {
      const [, src, dst] = argv;
      try {
        const content = fs.read(fs.resolve(src, state.cwd));
        fs.write(fs.resolve(dst, state.cwd), content);
      } catch (e) { out((e as Error).message); }
    },
    tree: (argv, _s, _fs, out) => {
      const start = fs.resolve(argv[1] || state.cwd, state.cwd);
      function walk(path: string, prefix: string): void {
        const node = fs.getNode(path);
        if (!node || node.type !== 'dir' || !node.children) return;
        const names = Object.keys(node.children);
        names.forEach((name, i) => {
          const last = i === names.length - 1;
          out(prefix + (last ? '└── ' : '├── ') + name);
          const child = node.children![name];
          if (child.type === 'dir') walk((path === '/' ? '' : path) + '/' + name, prefix + (last ? '    ' : '│   '));
        });
      }
      out(start);
      walk(start, '');
    },
    which: (argv, _s, _fs, out) => {
      const name = argv[1];
      if (!name) return;
      if (BUILTIN_NAMES.includes(name)) { out(`${name}: shell built-in`); return; }
      const prog = registry.get(name);
      if (prog) out(`${name}: program (category: ${prog.category})`);
      else out(`${name}: not found`);
    },
    whatis: (argv, _s, _fs, out) => {
      const name = argv[1];
      if (!name) return;
      const prog = registry.get(name);
      if (prog) out(`${name} — ${prog.manpage.split('\n')[0]}`);
      else if (BUILTIN_NAMES.includes(name)) out(`${name} — shell built-in command`);
      else out(`${name}: nothing appropriate.`);
    },
    reset: (_argv, _s, _fs, out) => {
      out('this will forget your ledger, your history, your discoveries.');
      out('resetting now.');
      fs.reset();
      localStorage.removeItem('theorkan.shell.history');
      localStorage.removeItem('theorkan.discoveries');
      out('done.');
    },
    vibe: (argv, _s, _fs, out) => {
      const lvl = argv[1] as ShellState['vibeLevel'] | undefined;
      if (!lvl) {
        out(`current: ${audio.getVibe()}`);
        out('  off     no reactions, no sounds');
        out('  low     reactions only, no whispers, no drift');
        out('  medium  default');
        out('  high    more whispers, ambient on');
        return;
      }
      if (!['off','low','medium','high'].includes(lvl)) {
        out(`vibe: unknown level "${lvl}"`); return;
      }
      audio.setVibe(lvl);
      state.vibeLevel = lvl;
      out(`vibe set to ${lvl}.`);
    },
    mute: () => audio.mute(),
    unmute: () => audio.unmute(),
  };
}

export { tokenize, expandGlobs };
