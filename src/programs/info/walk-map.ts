// Geography. ONE static map; the player walks across it. Buildings are
// walkable rooms; their interiors define the zone (kitchen / studio / etc.).
// Crossover tiles inside specific buildings dispatch other programs.
//
// The map is sized to fit the modal on a single screen — no scrolling
// viewport. We render the whole grid every frame.

import { PLACES } from './walk-places';

export const OW_W = 78;
export const OW_H = 26;

// ── tile semantics ────────────────────────────────────────────────────────

const WALKABLE = new Set<string>([
  ' ',                              // open ground
  '═', '╩', '|',                    // pier, gangplank junction, gangplank
  'B',                              // boat deck
  'D',                              // doorway (just a labelled walkable tile now)
  'S', 'F',                         // shore, field
  'G', 'M', 'd', 'C', 'U',          // crossover trigger tiles
]);

export function isWalkable(ch: string): boolean {
  return WALKABLE.has(ch);
}

// Tile intensity tier — for per-cell CSS styling. doryen-style: brighter
// = more important / closer to foreground; faint = background ambience.
export type Tier = 'bright' | 'normal' | 'dim' | 'faint' | 'water';
export function tierOf(ch: string): Tier {
  if (ch === '~') return 'water';
  if (ch === '^' || ch === '/' || ch === '\\' || ch === '_') return 'dim';     // boat decoration
  if (ch === 'B') return 'bright';
  if (ch === '|' || ch === '╩') return 'normal';
  if (ch === '═') return 'dim';
  if (ch === ' ') return 'faint';
  if (ch === 'S' || ch === 'F') return 'dim';
  if (ch === 'D') return 'bright';
  if (ch === 'G' || ch === 'M' || ch === 'd' || ch === 'C' || ch === 'U') return 'bright';
  // box drawing chars (building walls)
  if ('┌─┐│└─┘├┤┬┴┼'.includes(ch)) return 'normal';
  // letters of building labels embedded in walls
  if (/[A-Z]/.test(ch)) return 'normal';
  return 'normal';
}

export interface Pos { col: number; row: number; }

export interface CrossoverTile {
  at: Pos;
  command: string;
  argv?: string[];
}

// ── map construction ──────────────────────────────────────────────────────

function blank(w: number, h: number, fill = ' '): string[][] {
  return Array.from({ length: h }, () => Array<string>(w).fill(fill));
}

function stamp(g: string[][], x: number, y: number, art: string[]): void {
  for (let dy = 0; dy < art.length; dy++) {
    for (let dx = 0; dx < art[dy].length; dx++) {
      const row = g[y + dy];
      if (!row) continue;
      if (x + dx < 0 || x + dx >= row.length) continue;
      row[x + dx] = art[dy][dx];
    }
  }
}

// Build a building with an embedded label in the top wall, walkable
// interior, and a doorway at the middle of the bottom wall.
function buildBuilding(g: string[][], x: number, y: number, w: number, h: number, label: string): void {
  const innerW = w - 2;
  const labelLen = label.length;
  const leftDashes = Math.floor((innerW - labelLen) / 2);
  const rightDashes = innerW - labelLen - leftDashes;
  const top = '┌' + '─'.repeat(leftDashes) + label + '─'.repeat(rightDashes) + '┐';
  stamp(g, x, y, [top]);
  for (let i = 1; i < h - 1; i++) {
    stamp(g, x, y + i, ['│']);
    stamp(g, x + w - 1, y + i, ['│']);
  }
  // Bottom wall, with D in the middle
  const doorAt = Math.floor(w / 2);
  const bottomChars: string[] = ['└'];
  for (let cx = 1; cx < w - 1; cx++) {
    bottomChars.push(cx === doorAt ? 'D' : '─');
  }
  bottomChars.push('┘');
  stamp(g, x, y + h - 1, [bottomChars.join('')]);
}

interface BuildingSpec { id: string; x: number; y: number; w: number; h: number; label: string; }

const BUILDINGS: BuildingSpec[] = [
  { id: 'kitchen', x: 8,  y: 8,  w: 13, h: 5, label: 'KITCHEN' },
  { id: 'window',  x: 24, y: 8,  w: 13, h: 5, label: 'WINDOW'  },
  { id: 'studio',  x: 8,  y: 14, w: 13, h: 5, label: 'STUDIO'  },
  { id: 'alley',   x: 24, y: 14, w: 13, h: 5, label: 'ALLEY'   },
  { id: 'radio',   x: 8,  y: 20, w: 13, h: 5, label: 'RADIO'   },
  { id: 'empty',   x: 24, y: 20, w: 13, h: 5, label: 'EMPTY'   },
];

function buildOverworld(): { grid: string[][]; crossovers: CrossoverTile[] } {
  const g = blank(OW_W, OW_H, ' ');

  // Water rows 0-4
  for (let r = 0; r <= 4; r++) for (let c = 0; c < OW_W; c++) g[r][c] = '~';

  // Boat: sail tip + mast + hull + gangplank at col 38
  stamp(g, 38, 1, ['^']);
  stamp(g, 37, 2, ['/|\\']);
  stamp(g, 36, 3, ['/_B_\\']);
  stamp(g, 38, 4, ['|']);

  // Pier — full width with T-junction at gangplank
  for (let c = 0; c < OW_W; c++) g[5][c] = '═';
  g[5][38] = '╩';

  // Buildings
  for (const b of BUILDINGS) buildBuilding(g, b.x, b.y, b.w, b.h, b.label);

  // Crossover tiles: in the middle of the inside of each building
  const crossovers: CrossoverTile[] = [];
  function addCross(buildingId: string, ch: string, command: string, argv?: string[]): void {
    const b = BUILDINGS.find((x) => x.id === buildingId)!;
    const col = b.x + Math.floor(b.w / 2);
    const row = b.y + Math.floor(b.h / 2);
    g[row][col] = ch;
    crossovers.push({ at: { col, row }, command, argv });
  }
  addCross('studio', 'G', 'gallery');
  addCross('alley',  'd', 'dilenci', ['wake']);
  addCross('radio',  'M', 'music');
  addCross('empty',  'C', 'whois',   ['stowaway']);

  // Shore — solid sloped band along the east edge of the harbor open area.
  // Drawn as a filled trapezoid: every cell inside the bounds becomes 'S'.
  for (let r = 8; r <= 18; r++) {
    // left edge slants inward; right edge fixed
    const left  = 40 + Math.max(0, 14 - r);
    const right = 48 + Math.max(0, r - 12);
    for (let c = left; c <= right && c < OW_W; c++) {
      if (g[r][c] === ' ') g[r][c] = 'S';
    }
  }

  // Field — solid block further east, extending south of the shore.
  for (let r = 10; r <= 24; r++) {
    const left  = 50 + Math.max(0, 14 - r);
    const right = 73;
    for (let c = left; c <= right && c < OW_W; c++) {
      if (g[r][c] === ' ') g[r][c] = 'F';
    }
  }

  // A current running against the visible shore. Unlike the building
  // crossovers, this one is found in open terrain.
  g[13][47] = 'U';
  crossovers.push({ at: { col: 47, row: 13 }, command: 'undertow' });

  return { grid: g, crossovers };
}

const overworld = buildOverworld();
export const OVERWORLD_GRID: string[] = overworld.grid.map((r) => r.join(''));
export const OVERWORLD_CROSSOVERS = overworld.crossovers;

// Player start: just south of the pier, mid-screen
export const START_POS: Pos = { col: 40, row: 7 };

// ── zone resolution ───────────────────────────────────────────────────────

// Each building's interior tiles map to that building's place id.
function isInsideBuilding(b: BuildingSpec, p: Pos): boolean {
  return p.col > b.x && p.col < b.x + b.w - 1 && p.row > b.y && p.row < b.y + b.h - 1;
}

// The doorway tile (D) is part of the building's bottom wall; treat
// "standing on D" as still being in that building's zone.
function isOnDoorway(b: BuildingSpec, p: Pos): boolean {
  return p.row === b.y + b.h - 1 && p.col === b.x + Math.floor(b.w / 2);
}

export function zoneAt(p: Pos): string | null {
  const tile = OVERWORLD_GRID[p.row]?.[p.col];
  if (!tile || tile === '~') return null;

  // Building zones first
  for (const b of BUILDINGS) {
    if (isInsideBuilding(b, p) || isOnDoorway(b, p)) return b.id;
  }

  // Terrain zones
  if (tile === 'S' || tile === 'U') return 'shore';
  if (tile === 'F') return 'field';
  if (tile === 'B' || tile === '|') return 'boat';

  // Default walkable → harbor
  if (isWalkable(tile)) return 'harbor';
  return null;
}

// Validate that every walkable tile maps to a real place.
for (let r = 0; r < OW_H; r++) {
  for (let c = 0; c < OW_W; c++) {
    const ch = OVERWORLD_GRID[r][c];
    if (!isWalkable(ch)) continue;
    const z = zoneAt({ col: c, row: r });
    if (z && !PLACES[z]) throw new Error(`walk-map: tile (${c},${r})='${ch}' → zone '${z}' has no PLACE`);
  }
}
