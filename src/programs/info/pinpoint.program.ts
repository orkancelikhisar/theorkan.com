import type { Program, ProgramContext } from '../../kernel/program';
import { fingerprint, POPULATION_ONLINE, type Signature } from '../../stowaway/fingerprint';

// pinpoint — the stowaway runs a local scan against the visitor and prints
// what their own browser freely tells. No network. No third parties.

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function fmtInt(n: number): string {
  return n.toLocaleString('en-US');
}

function padRight(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

const COMPONENT_ORDER: (keyof Signature)[] = [
  'user_agent', 'language', 'timezone', 'screen', 'pixel_ratio',
  'canvas_hash', 'audio_hash', 'webgl_renderer', 'platform',
  'cpu_cores', 'ram', 'touch_points', 'connection',
];

const COMPONENT_LABEL: Record<keyof Signature, string> = {
  user_agent:     'user_agent',
  platform:       'platform',
  cpu_cores:      'cpu_cores',
  ram:            'ram',
  language:       'language',
  timezone:       'timezone',
  screen:         'screen',
  pixel_ratio:    'pixel_ratio',
  touch_points:   'touch_points',
  webgl_renderer: 'webgl_renderer',
  canvas_hash:    'canvas_hash',
  audio_hash:     'audio_hash',
  connection:     'connection',
};

async function run(ctx: ProgramContext): Promise<void> {
  ctx.println('');
  ctx.println('  scanning your device...');
  ctx.println('');

  // Progressive checkmarks. The actual collection has already started in the
  // background; we just stagger the visible feedback so it feels like work.
  const work = fingerprint();
  const tick = ['user_agent', 'canvas_hash', 'language', 'audio_hash',
                'timezone', 'webgl_renderer', 'screen', 'hardware',
                'pixel_ratio', 'connection'];
  for (let i = 0; i < tick.length; i += 2) {
    await delay(110);
    const left = tick[i] ?? '';
    const right = tick[i + 1] ?? '';
    ctx.println(`  ✓ ${padRight(left, 18)}${right ? '✓ ' + right : ''}`);
  }
  await delay(220);

  const result = await work;
  const { sig, bits, similar, bitsToFullyPinpoint } = result;
  const uniqueness = Math.max(1, Math.floor(POPULATION_ONLINE / Math.max(1, similar)));

  ctx.println('');
  ctx.println('  ──── your signature ────');
  for (const key of COMPONENT_ORDER) {
    const label = padRight(COMPONENT_LABEL[key], 18);
    let value = sig[key];
    // Truncate over-long values (some user-agents are 200+ chars).
    if (value.length > 56) value = value.slice(0, 53) + '...';
    ctx.println(`  ${label}${value}`);
  }
  ctx.println('');
  ctx.println('  ──── what this means ────');
  ctx.println(`  people online right now           ${fmtInt(POPULATION_ONLINE)}`);
  ctx.println(`  people who look like you          ~${fmtInt(similar)}`);
  ctx.println('');
  ctx.println(`  >  you are 1 in ~${fmtInt(uniqueness)}.`);
  ctx.println(`  >  i need ~${bitsToFullyPinpoint} more bits to pinpoint you.`);
  const moreFacts = Math.max(1, Math.round(bitsToFullyPinpoint / 4));
  ctx.println(`  >  about ${moreFacts === 1 ? 'one' : moreFacts <= 5 ? ['two','three','four','five'][moreFacts - 2] : moreFacts} more fact${moreFacts === 1 ? '' : 's'}. just ${moreFacts === 1 ? 'one' : moreFacts <= 5 ? ['two','three','four','five'][moreFacts - 2] : moreFacts}.`);
  ctx.println('');
  ctx.println('  this is a normal browser. it gives this freely.');
  ctx.println(`  (estimated entropy: ${bits} bits)`);
  ctx.println('');
}

const prog: Program = {
  name: 'pinpoint',
  manpage: 'pinpoint — the stowaway scans you. local only, no network.',
  category: 'util',
  mode: 'inline',
  onCommand: (ctx) => { void run(ctx); },
};

export default prog;
