import './styles/root.css';
import './terminal/terminal.css';
import { createEventBus } from './kernel/events';
import { createFS } from './kernel/fs';
import { SNAPSHOT } from './kernel/fs-snapshot';
import { getRegistry } from './kernel/registry';
import { createShell, BUILTIN_NAMES, BASELINE_DISCOVERED } from './kernel/shell';
import { createTerminal } from './terminal/terminal';
import { createHistory } from './terminal/history';
import { complete } from './terminal/completion';
import { createBoot } from './boot/boot';
import { createVoid } from './void/void';
import { startWhisperEngine } from './void/whisper-engine';
import { createAudio } from './audio/audio';
import { startIdleTracker } from './kernel/idle';
import { installInterceptors } from './stowaway/interceptor';
import { installConsoleBanner } from './stowaway/console-banner';
import { registerAllDevices } from './kernel/devices';
import { installKonami } from './programs/easter/konami';
import { createPanelManager } from './kernel/panels';
import './kernel/panels.css';
import { requestEyesCamera } from './eyes/camera';
import { createDilenci, type DilenciAPI } from './dilenci/dilenci';
import { createLlmAdapter } from './dilenci/llm';
import type { Program, ProgramContext, KeyEvent } from './kernel/program';

async function main(): Promise<void> {
  installConsoleBanner();
  installInterceptors();

  sessionStorage.setItem('theorkan.session.start', String(Date.now()));

  const events = createEventBus();
  const audio = createAudio();
  const fs = createFS(SNAPSHOT);
  const panels = createPanelManager(document.body);
  registerAllDevices(fs, panels);

  const root = document.getElementById('root')!;

  // Boot
  const boot = createBoot(audio);
  // Audio context wakes on first keypress during boot
  document.addEventListener('keydown', () => audio.init(), { once: true });
  await boot.run(root);
  boot.markSeen();

  // Terminal
  const terminal = createTerminal(root);

  // Void layer
  const voidApi = createVoid(events, audio);
  voidApi.mount(document.body);
  startWhisperEngine(voidApi);
  startIdleTracker(events);

  // History
  const history = createHistory();

  // Registry + program context factory
  const registry = getRegistry();

  // Modal program tracking
  let modalProgram: Program | null = null;
  function setModal(p: Program | null): void { modalProgram = p; }

  // Forward-declare shell for ctxFactory to read cwd lazily.
  // eslint-disable-next-line prefer-const -- assigned after ctxFactory captures it
  let shell: ReturnType<typeof createShell>;

  const ctxFactory = (args: string[]): ProgramContext => ({
    args,
    get cwd() { return shell?.state.cwd ?? '/home/orkan'; },
    print: (t) => terminal.print(t),
    println: (t) => terminal.println(t),
    panel: {
      spawn: (opts) => panels.spawn(opts),
      close: (id) => panels.close(id),
      update: (id, content) => panels.update(id, content),
      focus: (id) => panels.focus(id),
    },
    fs: {
      read: (p) => fs.read(p),
      write: (p, d) => fs.write(p, d),
      list: (p) => fs.list(p),
      exists: (p) => fs.exists(p),
    },
    void: voidApi,
    audio: {
      play: (s) => audio.play(s, 'program'),
      stop: () => {},
      volume: () => {},
    },
    dilenci: { notify: (n, p) => dilenci?.notify(n, p) },
    events: {
      on: (n, cb) => events.on(n, cb),
      emit: (n, p) => events.emit(n, p),
    },
    storage: {
      get: (k) => { try { return JSON.parse(localStorage.getItem(`prog.${k}`) || 'null'); } catch { return null; } },
      set: (k, v) => { try { localStorage.setItem(`prog.${k}`, JSON.stringify(v)); } catch { /* */ } },
    },
    random: Math.random,
  });

  shell = createShell(
    fs, registry, ctxFactory,
    {
      setVibe: (l) => audio.setVibe(l),
      mute: () => audio.mute(),
      unmute: () => audio.unmute(),
      isMuted: () => audio.isMuted(),
      getVibe: () => audio.getVibe(),
      play: (s, cat) => audio.play(s, (cat as 'shell' | undefined) || 'shell'),
    },
    (line) => terminal.println(line),
    () => terminal.clear(),
    () => history.all(),
  );

  // Listen for shell:program-modal to capture modal program reference for key routing.
  // Since shell.run() invokes program.init() which spawns the modal overlay, but we
  // also need to route keys to it — intercept by checking registry mode on submit.

  // Dilenci — the abandoned alter-ego. Lazy-loaded LLM; falls back to seeds.
  // The daemon is instantiated immediately so it can subscribe to events, but
  // the LLM worker is created in the background and the daemon happily runs in
  // seed-only mode if it never resolves.
  let dilenci: DilenciAPI | null = null;
  window.setTimeout(() => {
    const llm = createLlmAdapter();
    dilenci = createDilenci({
      events, fs, voidApi, audio, terminal,
      container: document.body,
      llm: llm ?? undefined,
    });
    llm?.onReady(() => terminal.println('postmodern_dilenci awoke quietly.', { dim: true }));
    llm?.onFailed(() => { /* silent failure per §8.3 */ });
    // Expose for the dilenci shell command without dragging dilenci into ctx.
    (globalThis as unknown as { __dilenci?: DilenciAPI }).__dilenci = dilenci;
  }, 2_000);

  // Konami fireworks
  installKonami(events);
  events.on('konami:triggered', () => {
    voidApi.shine();
    setTimeout(() => voidApi.shine(), 200);
    setTimeout(() => voidApi.shine(), 400);
    audio.play('easter.fireworks', 'program');
    terminal.println('* * * fireworks. you unlocked nothing in particular. * * *');
  });

  // Eyes: open camera in response to `eyes` program emission
  events.on('eyes:open', () => {
    void requestEyesCamera(panels).then((status) => {
      if (status === 'denied')      terminal.println('eyes: permission denied. you are blind in here.');
      else if (status === 'unsupported') terminal.println('eyes: this browser has no eye.');
    });
  });

  // Prompt cwd display
  function shortenCwd(p: string): string {
    if (p === '/home/orkan') return '~';
    if (p.startsWith('/home/orkan/')) return '~' + p.slice('/home/orkan'.length);
    return p;
  }
  function refreshPrompt(): void {
    // The terminal prompt must always match the actual input mode — otherwise
    // the visitor sees `orkan@theorkan:~$` and types thinking it's a shell
    // command, when in fact they're still in dilenci's offer mode.
    if (dilenci?.isInOfferMode()) {
      terminal.setPrompt('tell him: ');
    } else {
      terminal.setPrompt(`orkan@theorkan:${shortenCwd(shell.state.cwd)}$ `);
    }
  }
  refreshPrompt();
  // Sync the prompt whenever dilenci enters or leaves offer mode.
  events.on('dilenci:offer-opened', refreshPrompt);
  events.on('dilenci:offer-closed', refreshPrompt);

  // Submit handler
  terminal.onSubmit(async (line) => {
    history.add(line);
    audio.play('shell.enter', 'shell');
    voidApi.shine();

    // Dilenci offer mode intercepts the submit before the shell sees it.
    if (dilenci?.isInOfferMode()) {
      dilenci.feedFromOfferLine(line);
      refreshPrompt();
      return;
    }

    // Detect modal launch
    const cmd = line.trim().split(/\s+/)[0];
    const prog = registry.get(cmd);
    if (prog?.mode === 'modal') {
      setModal(prog);
    }

    events.emit('shell:command', { line });
    await shell.run(line);
    refreshPrompt();
    events.emit('shell:active', null);
  });

  // Keydown handler
  terminal.onKey((e) => {
    // If a modal is active and overlay still in DOM, route keys to it
    if (modalProgram) {
      const overlayClass = modalProgram.name === 'snake' ? '.snake-overlay'
        : modalProgram.name === '2048' ? '.t2048-overlay'
        : modalProgram.name === 'life' ? '.life-overlay'
        : modalProgram.name === 'regatta' ? '.regatta-overlay'
        : modalProgram.name === 'gallery' ? '.gallery-overlay'
        : null;
      const overlayPresent = overlayClass ? document.querySelector(overlayClass) : null;
      if (overlayPresent) {
        modalProgram.onKey?.(ctxFactory([]), {
          key: e.key, ctrlKey: e.ctrlKey, altKey: e.altKey, shiftKey: e.shiftKey, metaKey: e.metaKey,
        } as KeyEvent);
        e.preventDefault();
        // After processing, check if overlay still there
        if (!document.querySelector(overlayClass!)) setModal(null);
        return;
      } else {
        setModal(null);
      }
    }

    // Esc while Dilenci is asking for an offer → graceful refusal.
    if (e.key === 'Escape' && dilenci?.isInOfferMode()) {
      e.preventDefault();
      dilenci.escapeOffer();
      terminal.setInputValue('');
      refreshPrompt();
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = history.prev(terminal.getInputValue());
      if (prev != null) terminal.setInputValue(prev);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = history.next();
      if (next != null) terminal.setInputValue(next);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const buf = terminal.getInputValue();
      const all = shell.allCommands();
      const result = complete(buf, all, {
        discoveredOnly: true,
        baseline: [...BASELINE_DISCOVERED, ...BUILTIN_NAMES],
        discovered: shell.discovered(),
      });
      if (result.candidates.length === 1) terminal.setInputValue(result.candidates[0] + ' ');
      else if (result.candidates.length > 1 && result.commonPrefix.length > buf.length) {
        terminal.setInputValue(result.commonPrefix);
      } else if (result.candidates.length > 1) {
        terminal.println(result.candidates.join('  '), { dim: true });
      }
    } else if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) {
      e.preventDefault();
      terminal.clear();
    } else if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) {
      e.preventDefault();
      terminal.setInputValue('');
    } else if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault();
      terminal.setInputValue('');
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      audio.play('shell.keypress', 'shell');
    }
  });
}

main();
