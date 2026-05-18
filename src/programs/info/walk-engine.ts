// State machine for the wanderer. One scene; we track player position,
// per-zone visit counts, and the current zone. Pure logic — no DOM.

import {
  OVERWORLD_GRID, OVERWORLD_CROSSOVERS, OW_W, OW_H,
  START_POS, isWalkable, zoneAt,
  type Pos, type CrossoverTile,
} from './walk-map';

export interface WalkState {
  pos: Pos;
  visits: Record<string, number>;
  totalSteps: number;
  currentZone: string | null;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

export function freshState(): WalkState {
  const pos = { ...START_POS };
  const zone = zoneAt(pos);
  const visits: Record<string, number> = {};
  if (zone) visits[zone] = 1;
  return { pos, visits, totalSteps: 0, currentZone: zone };
}

export interface MoveResult {
  state: WalkState;
  bumped?: boolean;
}

export function step(state: WalkState, dir: Direction): MoveResult {
  const next = { ...state.pos };
  if (dir === 'up')    next.row -= 1;
  if (dir === 'down')  next.row += 1;
  if (dir === 'left')  next.col -= 1;
  if (dir === 'right') next.col += 1;

  if (next.row < 0 || next.row >= OW_H || next.col < 0 || next.col >= OW_W) {
    return { state, bumped: true };
  }
  const tile = OVERWORLD_GRID[next.row][next.col];
  if (!isWalkable(tile)) {
    return { state, bumped: true };
  }

  const newZone = zoneAt(next);
  const visits = { ...state.visits };
  if (newZone && newZone !== state.currentZone) {
    visits[newZone] = (visits[newZone] ?? 0) + 1;
  }

  return {
    state: {
      ...state,
      pos: next,
      totalSteps: state.totalSteps + 1,
      visits,
      currentZone: newZone,
    },
  };
}

export function crossoverAt(state: WalkState): CrossoverTile | null {
  return OVERWORLD_CROSSOVERS.find(
    (c) => c.at.col === state.pos.col && c.at.row === state.pos.row,
  ) ?? null;
}

// Re-roll the vignette at the current zone.
export function linger(state: WalkState): WalkState {
  if (!state.currentZone) return state;
  return {
    ...state,
    visits: {
      ...state.visits,
      [state.currentZone]: (state.visits[state.currentZone] ?? 0) + 1,
    },
  };
}
