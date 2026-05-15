import type { Program, ProgramContext } from '../../kernel/program';

// The dilenci command — control surface for the daemon. Without args it prints
// his current tone; subcommands let the visitor wake him, silence him, or feed
// him a line directly without waiting for a stir.

interface DilenciAPI {
  wake(): void;
  silence(toggle: boolean): void;
  status(): { hunger: number; tone: string; silenced: boolean; llm: 'ready' | 'pending' };
  isInOfferMode(): boolean;
  feedFromOfferLine(line: string): void;
}

function ref(): DilenciAPI | null {
  return (globalThis as unknown as { __dilenci?: DilenciAPI }).__dilenci ?? null;
}

function toneLabel(tone: string): string {
  switch (tone) {
    case 'sated':    return 'he is full.';
    case 'patient':  return 'he is patient.';
    case 'restless': return 'he is restless.';
    case 'starving': return 'he is starving.';
    default:         return 'he is somewhere.';
  }
}

const prog: Program = {
  name: 'dilenci',
  manpage: 'dilenci — the abandoned alter-ego.\n  dilenci          show his current tone\n  dilenci wake     wake him; the prompt becomes `tell him: `\n  dilenci silence  hide him\n  dilenci unsilence  let him return\n  dilenci feed <line>  offer him a line directly\n\nin a conversation: type a line and press enter. `bye` or esc to leave.\nhe does not leave on his own.',
  category: 'util',
  mode: 'inline',
  onCommand: (ctx: ProgramContext, argv: string[]) => {
    const d = ref();
    if (!d) { ctx.println('dilenci: not yet loaded. wait a moment.'); return; }
    const [, sub, ...rest] = argv;

    if (!sub) {
      const s = d.status();
      ctx.println(toneLabel(s.tone));
      if (s.silenced) ctx.println('he is silenced.');
      if (s.llm === 'pending') ctx.println('(he is still loading. seeds for now.)');
      return;
    }

    if (sub === 'wake') {
      d.wake();
      ctx.println('he is listening.');
    } else if (sub === 'silence') {
      d.silence(true);
      ctx.println('the room is quiet.');
    } else if (sub === 'unsilence') {
      d.silence(false);
      ctx.println('he can return.');
    } else if (sub === 'feed') {
      const line = rest.join(' ').trim();
      if (!line) { ctx.println('dilenci feed: nothing offered.'); return; }
      d.feedFromOfferLine(line);
    } else {
      ctx.println(`dilenci: unknown subcommand "${sub}"`);
    }
  },
  onKey: () => {},
  render: () => {},
  cleanup: () => {},
};

export default prog;
