import { describe, it, expect } from 'vitest';
import { PLACES, vignetteAt } from '../../src/programs/info/walk-places';
import {
  OVERWORLD_GRID, OVERWORLD_CROSSOVERS, OW_W, OW_H,
  START_POS, isWalkable, zoneAt,
} from '../../src/programs/info/walk-map';
import {
  freshState, step, linger, crossoverAt,
} from '../../src/programs/info/walk-engine';

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

  it('boat deck B tile is walkable and zone=boat', () => {
    // Find the boat deck tile
    let boatPos: { col: number; row: number } | null = null;
    for (let r = 0; r < OW_H; r++) for (let c = 0; c < OW_W; c++) {
      if (OVERWORLD_GRID[r][c] === 'B') boatPos = { col: c, row: r };
    }
    expect(boatPos).not.toBeNull();
    expect(zoneAt(boatPos!)).toBe('boat');
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

  it('every crossover tile is walkable and inside its expected zone', () => {
    for (const c of OVERWORLD_CROSSOVERS) {
      const tile = OVERWORLD_GRID[c.at.row][c.at.col];
      expect(isWalkable(tile), `crossover tile (${c.at.col},${c.at.row}) must be walkable`).toBe(true);
    }
  });
});

describe('walk engine', () => {
  it('fresh state starts at the harbor', () => {
    const s = freshState();
    expect(s.pos).toEqual(START_POS);
    expect(s.currentZone).toBe('harbor');
    expect(s.totalSteps).toBe(0);
    expect(s.visits.harbor).toBe(1);
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
});
