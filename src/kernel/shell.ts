import { tokenize } from './parser';
import type { FS } from './fs';
import { createBuiltins, BUILTIN_NAMES, type ShellState } from './builtins';
import type { Program, ProgramContext } from './program';

const DISCOVERED_KEY = 'theorkan.discoveries';
export const BASELINE_DISCOVERED = new Set([
  'help', 'hints', 'secrets', 'motd', 'man', 'ls', 'cd', 'cat', 'echo',
  'pwd', 'clear', 'history', 'alias', 'find', 'grep', 'tree', 'which',
  'whatis', 'reset', 'vibe', 'mute', 'unmute',
  'whoami', 'about', 'projects', 'contact', 'cv', 'man-orkan', 'eyes',
  'cowsay', 'fortune', 'ping', 'top', 'ps', 'date', 'uname', 'uptime', 'figlet',
  'weather', 'say', 'bbs',
  'snake', '2048', 'regatta', 'life', 'aquarium', 'undertow',
]);

export { BUILTIN_NAMES };

interface AudioCtl {
  setVibe(level: ShellState['vibeLevel']): void;
  mute(): void;
  unmute(): void;
  isMuted(): boolean;
  getVibe(): ShellState['vibeLevel'];
  play(sample: string, category?: string): void;
}

export interface ShellAPI {
  state: ShellState;
  run(input: string): Promise<void>;
  discovered(): string[];
  markDiscovered(name: string): void;
  allCommands(): string[];
  registerModal(prog: Program | null): void;
  isModalActive(): boolean;
}

export function createShell(
  fs: FS,
  registry: Map<string, Program>,
  ctxFactory: (args: string[]) => ProgramContext,
  audio: AudioCtl,
  termOut: (line: string) => void,
  termClear: () => void,
  historyAll: () => string[],
): ShellAPI {
  const state: ShellState = {
    cwd: '/home/orkan',
    previousCwd: '/home/orkan',
    aliases: {},
    vibeLevel: audio.getVibe(),
  };
  let discovered = new Set<string>();
  let modalProg: Program | null = null;
  try { discovered = new Set(JSON.parse(localStorage.getItem(DISCOVERED_KEY) || '[]')); } catch { /* */ }

  const builtins = createBuiltins(fs, state, registry, discovered, audio, termClear, historyAll);

  function markDiscovered(name: string): void {
    if (discovered.has(name)) return;
    discovered.add(name);
    try { localStorage.setItem(DISCOVERED_KEY, JSON.stringify([...discovered])); } catch { /* */ }
  }

  async function run(input: string): Promise<void> {
    const trimmed = input.trim();
    if (!trimmed) return;

    // Catastrophe intercept
    if (/^(sudo\s+)?rm\s+-rf\s+\/$/.test(trimmed)) {
      const chars = '█▓▒░ ';
      let buf = '';
      for (let i = 0; i < 60; i++) buf += chars[Math.floor(Math.random() * chars.length)];
      termOut('DELETING /');
      termOut(buf);
      termOut('DELETING everything');
      termOut(buf);
      await new Promise((r) => setTimeout(r, 600));
      termOut('JUST KIDDING. nothing here is real anyway.');
      return;
    }

    // sudo passthrough
    let line = trimmed;
    if (/^sudo\s+/.test(line)) {
      line = line.replace(/^sudo\s+/, '');
      const sudoArgv = tokenize(line);
      if (sudoArgv[0] === 'make' && sudoArgv.slice(1).join(' ') === 'me a sandwich') {
        termOut('*** SUDO MAKE ME A SANDWICH ***');
        termOut('okay.');
        return;
      }
      termOut('with great power comes great electricity bills.');
      // fall through to run inner command anyway
    }

    const argv = tokenize(line);
    if (argv.length === 0) return;
    const cmd = argv[0];

    if (BUILTIN_NAMES.includes(cmd)) {
      const result = builtins[cmd](argv, state, fs, termOut);
      if (result && result.newCwd) state.cwd = result.newCwd;
      markDiscovered(cmd);
      return;
    }

    const prog = registry.get(cmd);
    if (prog) {
      markDiscovered(cmd);
      const ctx = ctxFactory(argv);
      if (prog.mode === 'inline' && prog.onCommand) {
        const result = prog.onCommand(ctx, argv);
        if (typeof result === 'string') termOut(result);
      } else if (prog.mode === 'panel' && prog.init) {
        await prog.init(ctx);
      } else if (prog.mode === 'modal' && prog.init) {
        modalProg = prog;
        await prog.init(ctx);
      }
      return;
    }

    termOut(`orkan@theorkan: ${cmd}: command not found. try \`hints\`.`);
    audio.play('shell.error', 'shell');
  }

  return {
    state,
    run,
    discovered() { return [...discovered]; },
    markDiscovered,
    allCommands() {
      return [...BUILTIN_NAMES, ...registry.keys()];
    },
    registerModal(prog) { modalProg = prog; },
    isModalActive() { return modalProg !== null; },
  };
}
