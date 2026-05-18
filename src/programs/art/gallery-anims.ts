// Procedural animations for hand-authored gallery pieces. Each generator
// takes a monotonically-increasing frame index and returns a complete ASCII
// frame. The gallery program calls them at 30fps.
//
// Generators are kept lightweight — math + small string ops, no allocation
// pressure. Each piece is self-contained.

// Deterministic pseudo-random per cell. Lets us "twinkle" specific cells
// over time without storing per-cell state.
function noise(x: number, y: number, t: number): number {
  let h = x * 374761393 + y * 668265263 + t * 1274126177;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function shiftLeft(s: string, n: number): string {
  const len = s.length;
  if (len === 0) return s;
  const off = ((n % len) + len) % len;
  return s.slice(off) + s.slice(0, off);
}

// ─── Harbor at 4am ────────────────────────────────────────────────────────
// A boat silhouette over moving water. Water rows scroll at different speeds
// for a parallax feel; boat sits still.
export function harborAt4am(frame: number): string {
  const lines: string[] = [];
  // boat (right of center)
  lines.push(' '.repeat(54) + '.');
  lines.push(' '.repeat(54) + '|');
  lines.push(' '.repeat(53) + '/|');
  lines.push(' '.repeat(52) + '/ |');
  lines.push(' '.repeat(51) + '/  |');
  lines.push(' '.repeat(50) + '/   |');
  lines.push(' '.repeat(49) + '___/____|___');
  lines.push(' '.repeat(48) + '/            \\');
  lines.push(' '.repeat(47) + '/              \\');
  lines.push('');
  // 4 water rows scrolling left at different rates
  const water = [
    '~  ~~   ~  ~~  ~~~  ~ ~  ~~  ~~  ~~  ~  ~~ ~~ ~~ ~~ ~ ~~ ~~~ ~ ~~  ~~  ~~  ~ ~~ ~~~  ~~ ~~~  ~~ ~~',
    ' ~~~ ~ ~~ ~~~ ~~ ~  ~~~  ~~  ~ ~~~ ~~ ~~~  ~ ~~  ~~  ~~ ~~~ ~~~  ~~~ ~~ ~  ~~ ~  ~~ ~~~ ~~  ~~ ~~~ ',
    '~~~  ~~  ~~  ~~~ ~~ ~~~~  ~  ~~ ~~~  ~~ ~  ~~~ ~~ ~~~ ~~~  ~~ ~~  ~~~  ~~~~ ~~  ~~~ ~~ ~~  ~~ ~~~',
    '~~ ~~~ ~~~ ~~~  ~~  ~~ ~~~ ~~~ ~~  ~~~ ~~~  ~~ ~ ~~ ~~~ ~~  ~~~ ~~ ~~~ ~  ~~ ~~~  ~~ ~~  ~~~ ~ ~~',
  ];
  for (let i = 0; i < water.length; i++) {
    lines.push(shiftLeft(water[i], frame * (i + 1)));
  }
  return lines.join('\n');
}

// ─── Three Sails ──────────────────────────────────────────────────────────
// Three sailboats at different heights. Sails sway by 0/1 chars; water
// scrolls underneath.
export function threeSails(frame: number): string {
  const lines: string[] = [];
  const sway = Math.sin(frame * 0.04) > 0 ? 0 : 1;       // 0 or 1
  const sway2 = Math.cos(frame * 0.05) > 0 ? 0 : 1;
  const pad = (n: number) => ' '.repeat(Math.max(0, n));
  // Row 0
  lines.push(pad(28 + sway) + '.' + pad(43) + '.');
  lines.push(pad(27 + sway) + '/|' + pad(42) + '/|');
  lines.push(pad(26 + sway) + '/ |' + pad(10 + sway2) + '.' + pad(31) + '/ |');
  lines.push(pad(25 + sway) + '/  |' + pad(8 + sway2) + '/|' + pad(31) + '/  |');
  lines.push(pad(24 + sway) + '/___|' + pad(7 + sway2) + '/ |' + pad(30) + '/___|');
  lines.push(' '.repeat(34) + ('/  |'));
  lines.push(' '.repeat(34) + ('/___|'));
  lines.push('');
  // water
  const water = '~ ~~ ~~~ ~~ ~~~ ~ ~~ ~~ ~~~ ~ ~~ ~~~ ~~ ~ ~~ ~~~ ~~ ~ ~~ ~~~ ~~ ~~ ~ ~~ ~~ ~~~ ~ ~~ ~~  ~ ~~  ~';
  for (let i = 0; i < 3; i++) {
    lines.push(shiftLeft(water, frame * (i + 1) + i * 7));
  }
  return lines.join('\n');
}

// ─── Rope, Knotted ────────────────────────────────────────────────────────
// Bowline knot at the top; rope hanging below with a traveling sine wave.
export function ropeKnotted(frame: number): string {
  const lines: string[] = [];
  const knot = [
    '                  ____',
    '                 /    \\',
    '                /      \\',
    '               |    ____|____',
    '               |   /    .    \\',
    '                \\_/    /|\\    \\',
    '                  \\   / | \\   /',
    '                   \\_/  |  \\_/',
  ];
  lines.push(...knot);
  // Rope tail — wavy vertical, length 8 rows + a horizontal run at the bottom
  const tailRows = 7;
  for (let i = 0; i < tailRows; i++) {
    const phase = (frame * 0.18) - i * 0.6;
    const wave = Math.round(Math.sin(phase) * 1.4);     // -1..1
    const col = 24 + wave;
    lines.push(' '.repeat(col) + '|');
  }
  // Bottom run
  lines.push('                        |' + '_'.repeat(38));
  return lines.join('\n');
}

// ─── The Stowaway ─────────────────────────────────────────────────────────
// A small figure in the lower right. Above: a constellation of dots that
// flicker on and off — deterministic noise, so the pattern is repeatable.
export function theStowaway(frame: number): string {
  const W = 70;
  const H = 22;
  // Figure: stays still, anchored bottom-right
  const figure: Record<string, string> = {
    '20,55': '/.\\',
    '21,54': '/  \\',
    '22,53': '/    \\',
    '23,52': "'______'",
  };
  // Dots: 14 specific (x,y) positions that flicker
  const dotPositions: Array<[number, number]> = [
    [0, 4], [2, 60], [3, 50], [5, 65],
    [6, 56], [8, 62], [9, 30], [11, 58],
    [12, 70], [13, 25], [14, 40], [15, 55],
    [16, 48], [17, 38],
  ];
  const lines: string[] = [];
  for (let y = 0; y < H; y++) {
    const row: string[] = new Array(W).fill(' ');
    // Dots for this row
    for (const [py, px] of dotPositions) {
      if (py !== y) continue;
      // Twinkle: visible when noise > 0.4 — shifts on slow frame interval
      const phase = Math.floor(frame / 6) + py + px;
      if (noise(px, py, phase) > 0.42) row[px] = '.';
    }
    // Figure characters
    for (const key of Object.keys(figure)) {
      const [fy, fx] = key.split(',').map(Number);
      if (fy === y) {
        const text = figure[key];
        for (let i = 0; i < text.length && fx + i < W; i++) row[fx + i] = text[i];
      }
    }
    lines.push(row.join('').replace(/\s+$/g, ''));
  }
  return lines.join('\n');
}

// ─── Salt Field ───────────────────────────────────────────────────────────
// Sparse grid of dots that twinkle. Like a salt field at low tide.
export function saltField(frame: number): string {
  const W = 70;
  const H = 13;
  const lines: string[] = [];
  for (let y = 0; y < H; y++) {
    let line = '   ';
    const offset = y % 2 === 0 ? 0 : 2;
    for (let c = 0; c < W; c++) {
      const col = c + offset;
      if (col % 4 === 0) {
        const phase = Math.floor(frame / 10) + Math.floor(c / 8);
        const on = noise(c, y, phase) > 0.18;
        line += on ? '.' : ' ';
      } else {
        line += ' ';
      }
    }
    lines.push(line.trimEnd());
  }
  return lines.join('\n');
}

// ─── Letter, Unsent — to Sarı (a dog) ─────────────────────────────────────
// Typewriter effect: characters appear one at a time, then hold, then
// restart. About 12 seconds end-to-end.
const SARI_LETTER = [
  '   _______________________________________________________________',
  '   |                                                             |',
  '   |   dear sarı,                                                |',
  '   |                                                             |',
  '   |   the kitchen still expects you. so does the back door.    |',
  '   |   tuesday too. somebody has to chase the cars now and      |',
  '   |   i don\'t have the legs for it.                            |',
  '   |                                                             |',
  '   |   if you read this you will know it was for you. if you    |',
  '   |   do not read this it is still for you. so. either way.    |',
  '   |                                                             |',
  '   |                                          ─ ___________      |',
  '   |_____________________________________________________________|',
].join('\n');

export function letterToSari(frame: number): string {
  const TYPE_PER_FRAME = 4;          // chars per frame
  const HOLD_FRAMES = 120;           // ~4s pause when fully typed
  const total = SARI_LETTER.length;
  const typingDuration = Math.ceil(total / TYPE_PER_FRAME);
  const cycleLen = typingDuration + HOLD_FRAMES;
  const localFrame = frame % cycleLen;
  if (localFrame >= typingDuration) return SARI_LETTER;
  const visible = Math.min(total, localFrame * TYPE_PER_FRAME);
  // Preserve structure — only show first N characters of the source.
  let out = SARI_LETTER.slice(0, visible);
  // Cursor at the end when typing
  out += localFrame % 8 < 4 ? '▍' : ' ';
  return out;
}

// ─── Artificial Gallery — floor plan with a moving visitor ────────────────
// Three rooms. A "◦" walks a path through them on a slow loop. Other
// figures (gallery-goers, sketched as a dot) appear briefly.
export function artificialGallery(frame: number): string {
  // Path the visitor walks (col, row) coordinates relative to the floor plan.
  const path: Array<[number, number]> = [
    [55, 18], [50, 18], [45, 18], [40, 18], [35, 18], [30, 18], [25, 18],   // bottom of room III
    [20, 18], [15, 18], [10, 18], [8, 17], [8, 15], [8, 13],                  // up left side
    [12, 13], [16, 13], [20, 13], [24, 13],                                    // along room I bottom
    [24, 11], [24, 9], [24, 7],                                                // up
    [30, 7], [40, 7], [50, 7], [56, 7],                                        // along top into room II
    [56, 10], [56, 13], [62, 13], [68, 13],                                    // down + right in room II
    [68, 15], [68, 17],                                                        // descend back
    [60, 17],
  ];
  const pos = path[frame % path.length];
  const grid: string[][] = [
    '   ┌──────────────────────────┬──────────────────────────────────┐',
    '   │                          │                                  │',
    '   │    ROOM I                │    ROOM II                       │',
    '   │    "harbor works"        │    "salt works"                  │',
    '   │                          │                                  │',
    '   │      ▓     ▓     ▓       │       ▓        ▓                 │',
    '   │                          │                                  │',
    '   │                          │       ▓        ▓                 │',
    '   │      ▓     ▓     ▓       │                                  │',
    '   │                          │                                  │',
    '   ├──────────────────────────┴──────────┐                       │',
    '   │                                     │                       │',
    '   │   ROOM III  "latent walk"           │                       │',
    '   │                                     │                       │',
    '   │   ▓   ▓   ▓   ▓   ▓   ▓             │       ▓        ▓      │',
    '   │                                     │                       │',
    '   │   ▓   ▓   ▓   ▓   ▓   ▓             │                       │',
    '   │                                     │                       │',
    '   └─────────────────────────────────────┴───────────────────────┘',
    '                                              (visitor)',
  ].map((row) => row.split(''));
  // Stamp the visitor
  const [px, py] = pos;
  if (grid[py] && grid[py][px] === ' ') grid[py][px] = '◦';
  return grid.map((r) => r.join('').replace(/\s+$/, '')).join('\n');
}
