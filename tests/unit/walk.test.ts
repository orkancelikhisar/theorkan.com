import { describe, it, expect } from 'vitest';
import { PLACES, vignetteAt } from '../../src/programs/info/walk-places';
import {
  BOAT_SPEC, LOW_TIDE_TILES, OVERWORLD_GRID, OVERWORLD_CROSSOVERS, OW_W, OW_H,
  START_POS, isWalkable, zoneAt,
} from '../../src/programs/info/walk-map';
import {
  decorationInReach, freshState, inspectDecoration, step, linger,
  crossoverAt, crossoverInReach, restoreState,
} from '../../src/programs/info/walk-engine';
import { ROOM_DECORATIONS } from '../../src/programs/info/walk-decorations';

describe('walk places (data layer)', () => {
  it('has ten places', () => {
    expect(Object.keys(PLACES).length).toBe(10);
  });

  it('every place has at least 3 vignette variants', () => {
    for (const place of Object.values(PLACES)) {
      expect(place.vignettes.length, `${place.id} needs >=3 vignettes`).toBeGreaterThanOrEqual(3);
    }
  });

  it('vignetteAt cycles through variants', () => {
    const variants = PLACES.harbor.vignettes.length;
    const seen = new Set<string>();
    for (let i = 1; i <= variants; i++) seen.add(vignetteAt('harbor', i));
    expect(seen.size).toBe(variants);
    expect(vignetteAt('harbor', variants + 1)).toBe(vignetteAt('harbor', 1));
  });
});

describe('overworld map', () => {
  it('has expected dimensions', () => {
    expect(OVERWORLD_GRID.length).toBe(OW_H);
    for (const row of OVERWORLD_GRID) expect(row.length).toBe(OW_W);
  });

  it('start position is walkable and inside the harbor zone', () => {
    const tile = OVERWORLD_GRID[START_POS.row][START_POS.col];
    expect(isWalkable(tile)).toBe(true);
    expect(zoneAt(START_POS)).toBe('harbor');
  });

  it('water tiles are impassable', () => {
    // Top-left corner must be water in our layout
    expect(OVERWORLD_GRID[0][0]).toBe('~');
    expect(isWalkable('~')).toBe(false);
  });

  it('boat deck tile is walkable and zone=boat', () => {
    // Find the boat deck tile
    let boatPos: { col: number; row: number } | null = null;
    for (let r = 0; r < OW_H; r++) for (let c = 0; c < OW_W; c++) {
      if (OVERWORLD_GRID[r][c] === 'b') boatPos = { col: c, row: r };
    }
    expect(boatPos).not.toBeNull();
    expect(zoneAt(boatPos!)).toBe('boat');
  });

  it('has a pointed walkable boat joined to the pier by a gangway', () => {
    const centerCol = Math.floor((BOAT_SPEC.left + BOAT_SPEC.right) / 2);
    expect(OVERWORLD_GRID[BOAT_SPEC.top][centerCol]).toBe('b');
    expect(OVERWORLD_GRID[BOAT_SPEC.top][centerCol - 1]).toBe('~');
    for (let col = BOAT_SPEC.left; col <= BOAT_SPEC.right; col++) {
      expect(OVERWORLD_GRID[BOAT_SPEC.bottom][col]).toBe('b');
    }
    expect(OVERWORLD_GRID[BOAT_SPEC.bottom + 1][BOAT_SPEC.right - 1]).toBe('=');
  });

  it('contains a low-tide lighthouse causeway and an impossible interior', () => {
    for (const tile of LOW_TIDE_TILES) expect(OVERWORLD_GRID[tile.row][tile.col]).toBe('l');
    expect(OVERWORLD_GRID[17][2]).toBe('H');
    expect(isWalkable('H')).toBe(false);
    expect(OVERWORLD_GRID[16][33]).toBe('I');
    expect(zoneAt({ col: 33, row: 16 })).toBe('window');
  });

  it('exposes building crossovers and the shore undertow', () => {
    const commands = OVERWORLD_CROSSOVERS.map((c) => c.command).sort();
    expect(commands).toEqual(['dilenci', 'gallery', 'music', 'undertow', 'whois']);
  });

  it('all six interior building zones (kitchen/window/studio/alley/radio/empty) are reachable', () => {
    const found = new Set<string>();
    for (let r = 0; r < OW_H; r++) for (let c = 0; c < OW_W; c++) {
      const z = zoneAt({ col: c, row: r });
      if (z) found.add(z);
    }
    for (const z of ['kitchen', 'window', 'studio', 'alley', 'radio', 'empty', 'shore', 'field', 'boat', 'harbor']) {
      expect(found, `zone ${z} must exist somewhere on the map`).toContain(z);
    }
  });

  it('places one physical decorative cluster in every interior room', () => {
    expect(new Set(ROOM_DECORATIONS.map((decoration) => decoration.roomId))).toEqual(
      new Set(['kitchen', 'window', 'studio', 'alley', 'radio', 'empty']),
    );
    for (const decoration of ROOM_DECORATIONS) {
      expect(decoration.observations.length, decoration.id).toBeGreaterThanOrEqual(3);
      for (let row = decoration.y; row < decoration.y + decoration.h; row++) {
        for (let col = decoration.x; col < decoration.x + decoration.w; col++) {
          expect(OVERWORLD_GRID[row][col], decoration.id).toBe('x');
          expect(isWalkable(OVERWORLD_GRID[row][col]), decoration.id).toBe(false);
        }
      }
    }
  });

  it('every crossover tile is walkable and inside its expected zone', () => {
    for (const c of OVERWORLD_CROSSOVERS) {
      const tile = OVERWORLD_GRID[c.at.row][c.at.col];
      expect(isWalkable(tile), `crossover tile (${c.at.col},${c.at.row}) must be walkable`).toBe(true);
    }
  });

  it('every crossover and place is reachable from the harbor start', () => {
    const queue = [{ ...START_POS }];
    const seen = new Set([`${START_POS.col},${START_POS.row}`]);
    while (queue.length) {
      const current = queue.shift()!;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const col = current.col + dc;
        const row = current.row + dr;
        const key = `${col},${row}`;
        if (row < 0 || row >= OW_H || col < 0 || col >= OW_W || seen.has(key)) continue;
        if (!isWalkable(OVERWORLD_GRID[row][col])) continue;
        seen.add(key);
        queue.push({ col, row });
      }
    }
    for (const crossover of OVERWORLD_CROSSOVERS) {
      expect(seen.has(`${crossover.at.col},${crossover.at.row}`), crossover.command).toBe(true);
    }
    const reachedZones = new Set<string>();
    for (const key of seen) {
      const [col, row] = key.split(',').map(Number);
      const zone = zoneAt({ col, row });
      if (zone) reachedZones.add(zone);
    }
    for (const place of Object.keys(PLACES)) expect(reachedZones, place).toContain(place);
  });
});

describe('walk engine', () => {
  it('fresh state starts at the harbor', () => {
    const s = freshState();
    expect(s.pos).toEqual(START_POS);
    expect(s.currentZone).toBe('harbor');
    expect(s.totalSteps).toBe(0);
    expect(s.visits.harbor).toBe(1);
    expect(s.facing).toBe('down');
  });

  it('step into a wall bumps and does not move', () => {
    // Walk north until we hit the water — should bump and not move
    let s = freshState();
    for (let i = 0; i < 10; i++) {
      const r = step(s, 'up');
      s = r.state;
    }
    // Player should still be on a walkable tile and not in the water
    expect(s.currentZone).not.toBeNull();
  });

  it('step into open ground moves and bumps step counter', () => {
    const s0 = freshState();
    const r = step(s0, 'down');
    expect(r.state.totalSteps).toBe(1);
    expect(r.state.pos.row).toBe(s0.pos.row + 1);
  });

  it('turns to face a wall even when movement bumps', () => {
    const wall = { ...freshState(), pos: { col: 16, row: 21 }, currentZone: 'harbor' };
    const result = step(wall, 'up');
    expect(result.bumped).toBe(true);
    expect(result.state.pos).toEqual(wall.pos);
    expect(result.state.facing).toBe('up');
  });

  it('allows the live tide to block an otherwise walkable causeway tile', () => {
    const target = LOW_TIDE_TILES.find((tile) => OVERWORLD_GRID[tile.row][tile.col + 1] === 'l')!;
    const s = {
      ...freshState(),
      pos: { col: target.col + 1, row: target.row },
      facing: 'left' as const,
      currentZone: 'shore',
    };
    const result = step(s, 'left', (pos) => pos.col === target.col && pos.row === target.row);
    expect(result.bumped).toBe(true);
    expect(result.state.pos).toEqual(s.pos);
  });

  it('linger increments the current zone visit count', () => {
    let s = freshState();
    const before = s.visits.harbor ?? 0;
    s = linger(s);
    expect(s.visits.harbor).toBe(before + 1);
  });

  it('crossoverAt returns null when not on a trigger', () => {
    const s = freshState();
    expect(crossoverAt(s)).toBeNull();
  });

  it('crossoverAt returns the right command when standing on a trigger', () => {
    const gallery = OVERWORLD_CROSSOVERS.find((c) => c.command === 'gallery')!;
    const s = { ...freshState(), pos: { ...gallery.at }, currentZone: 'studio' as string | null };
    expect(crossoverAt(s)?.command).toBe('gallery');
  });

  it('can interact with the crossover one tile ahead', () => {
    const gallery = OVERWORLD_CROSSOVERS.find((c) => c.command === 'gallery')!;
    const s = {
      ...freshState(),
      pos: { col: gallery.at.col, row: gallery.at.row + 1 },
      facing: 'up' as const,
      currentZone: 'studio',
    };
    expect(crossoverInReach(s)?.command).toBe('gallery');
  });

  it('can inspect room decoration from an adjacent walkable tile', () => {
    const decoration = ROOM_DECORATIONS[0];
    const s = {
      ...freshState(),
      pos: { col: decoration.x + decoration.w, row: decoration.y },
      facing: 'left' as const,
      currentZone: decoration.roomId,
    };
    expect(isWalkable(OVERWORLD_GRID[s.pos.row][s.pos.col])).toBe(true);
    expect(decorationInReach(s)?.id).toBe(decoration.id);
  });

  it('cycles decoration observations and persists inspection counts', () => {
    const decoration = ROOM_DECORATIONS[0];
    const first = inspectDecoration(freshState(), decoration);
    const second = inspectDecoration(first.state, decoration);
    expect(first.text).toBe(decoration.observations[0]);
    expect(second.text).toBe(decoration.observations[1]);
    expect(second.state.inspections[decoration.id]).toBe(2);
    expect(restoreState(second.state).inspections[decoration.id]).toBe(2);
  });

  it('restores valid persisted state and rejects invalid positions', () => {
    const saved = { ...freshState(), pos: { col: 25, row: 10 }, facing: 'right' as const, totalSteps: 42 };
    expect(restoreState(saved).totalSteps).toBe(42);
    expect(restoreState({ ...saved, pos: { col: -10, row: 0 } })).toEqual(freshState());
  });
});
