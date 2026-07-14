import { PLACES } from './walk-places';
import { ROOM_DECORATIONS } from './walk-decorations';

export const OW_W = 64;
export const OW_H = 44;

export interface Pos { col: number; row: number; }

export interface CrossoverTile {
  at: Pos;
  command: string;
  argv?: string[];
}

export type TileKind =
  | 'water' | 'grass' | 'path' | 'shore' | 'salt'
  | 'pier' | 'boat' | 'floor' | 'wall' | 'door'
  | 'tree' | 'rock' | 'portal' | 'decor';

export interface BuildingSpec {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  accent: 'warm' | 'cool' | 'rust' | 'void';
}

export const BOAT_SPEC = {
  left: 10,
  right: 14,
  top: 2,
  bottom: 5,
  mastCol: 12.5,
  mastRow: 4.15,
} as const;

const WALKABLE = new Set(['.', ':', 's', 'f', 'l', '=', 'b', 'i', '+', 'G', 'M', 'd', 'C', 'U', 'I']);

export function isWalkable(ch: string): boolean {
  return WALKABLE.has(ch);
}

export function tileKindOf(ch: string): TileKind {
  if (ch === '~') return 'water';
  if (ch === '.') return 'grass';
  if (ch === ':') return 'path';
  if (ch === 's' || ch === 'l') return 'shore';
  if (ch === 'f') return 'salt';
  if (ch === '=') return 'pier';
  if (ch === 'b') return 'boat';
  if (ch === 'i') return 'floor';
  if (ch === 'x') return 'decor';
  if (ch === '#') return 'wall';
  if (ch === '+') return 'door';
  if (ch === 'T') return 'tree';
  if (ch === 'R') return 'rock';
  if ('GMdCUIH'.includes(ch)) return 'portal';
  return 'grass';
}

// Kept for shell integrations that still inspect the old intensity model.
export type Tier = 'bright' | 'normal' | 'dim' | 'faint' | 'water';
export function tierOf(ch: string): Tier {
  const kind = tileKindOf(ch);
  if (kind === 'water') return 'water';
  if (kind === 'portal' || kind === 'door' || kind === 'boat') return 'bright';
  if (kind === 'wall' || kind === 'pier' || kind === 'tree') return 'normal';
  if (kind === 'path' || kind === 'shore' || kind === 'rock') return 'dim';
  return 'faint';
}

function blank(): string[][] {
  return Array.from({ length: OW_H }, () => Array<string>(OW_W).fill('.'));
}

function fillRect(grid: string[][], x: number, y: number, w: number, h: number, tile: string): void {
  for (let row = y; row < y + h; row++) {
    for (let col = x; col < x + w; col++) {
      if (row >= 0 && row < OW_H && col >= 0 && col < OW_W) grid[row][col] = tile;
    }
  }
}

function pathH(grid: string[][], x1: number, x2: number, row: number, thickness = 2): void {
  fillRect(grid, Math.min(x1, x2), row, Math.abs(x2 - x1) + 1, thickness, ':');
}

function pathV(grid: string[][], col: number, y1: number, y2: number, thickness = 2): void {
  fillRect(grid, col, Math.min(y1, y2), thickness, Math.abs(y2 - y1) + 1, ':');
}

export const BUILDINGS: BuildingSpec[] = [
  { id: 'kitchen', x: 16, y: 13, w: 10, h: 8, accent: 'warm' },
  { id: 'window',  x: 30, y: 12, w: 10, h: 8, accent: 'cool' },
  { id: 'studio',  x: 45, y: 13, w: 11, h: 8, accent: 'warm' },
  { id: 'alley',   x: 17, y: 27, w: 10, h: 8, accent: 'void' },
  { id: 'radio',   x: 32, y: 27, w: 11, h: 8, accent: 'rust' },
  { id: 'empty',   x: 48, y: 26, w: 10, h: 9, accent: 'void' },
];

export const LOW_TIDE_TILES: Pos[] = [
  { col: 1, row: 17 }, { col: 3, row: 17 },
  { col: 1, row: 18 }, { col: 2, row: 18 }, { col: 3, row: 18 },
  { col: 1, row: 19 }, { col: 2, row: 19 }, { col: 3, row: 19 },
  { col: 4, row: 18 }, { col: 5, row: 18 }, { col: 6, row: 18 },
  { col: 7, row: 18 }, { col: 8, row: 18 },
];

function buildRoom(grid: string[][], building: BuildingSpec): void {
  fillRect(grid, building.x, building.y, building.w, building.h, '#');
  fillRect(grid, building.x + 1, building.y + 1, building.w - 2, building.h - 2, 'i');
  const doorCol = building.x + Math.floor(building.w / 2);
  grid[building.y + building.h - 1][doorCol] = '+';
  // A small threshold outside each building makes entrances legible.
  if (building.y + building.h < OW_H) grid[building.y + building.h][doorCol] = ':';
}

function deterministicScatter(grid: string[][]): void {
  for (let row = 10; row < OW_H - 2; row++) {
    for (let col = 10; col < OW_W - 2; col++) {
      if (grid[row][col] !== '.') continue;
      const n = (col * 73 + row * 151 + col * row * 17) % 211;
      if (n === 7 || n === 31) grid[row][col] = 'T';
      else if (n === 83) grid[row][col] = 'R';
    }
  }
}

function buildOverworld(): { grid: string[][]; crossovers: CrossoverTile[] } {
  const grid = blank();

  // Northern sea and a curved western coastline.
  fillRect(grid, 0, 0, OW_W, 8, '~');
  for (let row = 8; row < OW_H; row++) {
    const coast = 7 + Math.round(Math.sin(row * 0.37) * 1.5) + (row > 31 ? Math.floor((row - 31) / 4) : 0);
    for (let col = 0; col < coast; col++) grid[row][col] = '~';
    for (let col = coast; col < Math.min(OW_W, coast + 3); col++) grid[row][col] = 's';
  }
  for (const tile of LOW_TIDE_TILES) grid[tile.row][tile.col] = 'l';
  grid[17][2] = 'H';

  // A north-facing boat: pointed bow, broad walkable deck, narrow gangway.
  grid[2][12] = 'b';
  fillRect(grid, 11, 3, 3, 1, 'b');
  fillRect(grid, 10, 4, 5, 2, 'b');
  fillRect(grid, 13, 6, 12, 3, '=');
  fillRect(grid, 22, 8, 3, 4, '=');

  // Village paths form a readable loop with smaller branches to each door.
  pathH(grid, 12, 59, 10, 2);
  pathH(grid, 12, 59, 23, 2);
  pathH(grid, 13, 58, 37, 2);
  pathV(grid, 12, 10, 38, 2);
  pathV(grid, 28, 10, 38, 2);
  pathV(grid, 43, 10, 38, 2);
  pathV(grid, 59, 10, 38, 2);

  for (const building of BUILDINGS) buildRoom(grid, building);

  // Furniture occupies real collision tiles and is inspected from an
  // adjacent tile, like objects in classic top-down adventure games.
  for (const decoration of ROOM_DECORATIONS) {
    fillRect(grid, decoration.x, decoration.y, decoration.w, decoration.h, 'x');
  }

  const crossovers: CrossoverTile[] = [];
  const addCrossover = (id: string, tile: string, command: string, argv?: string[]): void => {
    const building = BUILDINGS.find((item) => item.id === id);
    if (!building) throw new Error(`walk-map: missing building ${id}`);
    const at = {
      col: building.x + Math.floor(building.w / 2),
      row: building.y + 3,
    };
    grid[at.row][at.col] = tile;
    crossovers.push({ at, command, argv });
  };
  addCrossover('studio', 'G', 'gallery');
  addCrossover('alley', 'd', 'dilenci', ['wake']);
  addCrossover('radio', 'M', 'music');
  addCrossover('empty', 'C', 'whois', ['stowaway']);

  // A door/window that disagrees with the dimensions of its building.
  grid[16][33] = 'I';

  // Salt field in the southeast and the wrong-way current on the western shore.
  for (let row = 36; row < OW_H; row++) {
    for (let col = 31; col < OW_W; col++) if (grid[row][col] === '.') grid[row][col] = 'f';
  }
  const undertow = { col: 9, row: 22 };
  grid[undertow.row][undertow.col] = 'U';
  crossovers.push({ at: undertow, command: 'undertow' });

  deterministicScatter(grid);
  return { grid, crossovers };
}

const overworld = buildOverworld();
export const OVERWORLD_GRID = overworld.grid.map((row) => row.join(''));
export const OVERWORLD_CROSSOVERS = overworld.crossovers;
export const START_POS: Pos = { col: 24, row: 10 };

function inside(building: BuildingSpec, pos: Pos): boolean {
  return pos.col > building.x
    && pos.col < building.x + building.w - 1
    && pos.row > building.y
    && pos.row < building.y + building.h - 1;
}

function doorway(building: BuildingSpec, pos: Pos): boolean {
  return pos.row === building.y + building.h - 1
    && pos.col === building.x + Math.floor(building.w / 2);
}

export function zoneAt(pos: Pos): string | null {
  const tile = OVERWORLD_GRID[pos.row]?.[pos.col];
  if (!tile || !isWalkable(tile)) return null;
  for (const building of BUILDINGS) {
    if (inside(building, pos) || doorway(building, pos)) return building.id;
  }
  if (tile === 's' || tile === 'l' || tile === 'U') return 'shore';
  if (tile === 'f') return 'field';
  if (tile === 'b') return 'boat';
  return 'harbor';
}

for (let row = 0; row < OW_H; row++) {
  for (let col = 0; col < OW_W; col++) {
    const tile = OVERWORLD_GRID[row][col];
    if (!isWalkable(tile)) continue;
    const zone = zoneAt({ col, row });
    if (!zone || !PLACES[zone]) {
      throw new Error(`walk-map: walkable tile (${col},${row})='${tile}' has no place`);
    }
  }
}
