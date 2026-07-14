import {
  OVERWORLD_GRID, OVERWORLD_CROSSOVERS, OW_W, OW_H,
  START_POS, isWalkable, zoneAt,
  type Pos, type CrossoverTile,
} from './walk-map';
import { decorationAt, type RoomDecoration } from './walk-decorations';

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface WalkState {
  pos: Pos;
  facing: Direction;
  visits: Record<string, number>;
  inspections: Record<string, number>;
  totalSteps: number;
  currentZone: string | null;
}

export interface MoveResult {
  state: WalkState;
  bumped?: boolean;
  enteredZone?: string;
}

export function freshState(): WalkState {
  const pos = { ...START_POS };
  const currentZone = zoneAt(pos);
  const visits: Record<string, number> = {};
  if (currentZone) visits[currentZone] = 1;
  return { pos, facing: 'down', visits, inspections: {}, totalSteps: 0, currentZone };
}

export function offset(pos: Pos, direction: Direction): Pos {
  const next = { ...pos };
  if (direction === 'up') next.row -= 1;
  if (direction === 'down') next.row += 1;
  if (direction === 'left') next.col -= 1;
  if (direction === 'right') next.col += 1;
  return next;
}

export function step(
  state: WalkState,
  direction: Direction,
  dynamicallyBlocked?: (pos: Pos) => boolean,
): MoveResult {
  const next = offset(state.pos, direction);
  const turned = state.facing !== direction ? { ...state, facing: direction } : state;
  if (next.row < 0 || next.row >= OW_H || next.col < 0 || next.col >= OW_W) {
    return { state: turned, bumped: true };
  }
  if (!isWalkable(OVERWORLD_GRID[next.row][next.col]) || dynamicallyBlocked?.(next)) {
    return { state: turned, bumped: true };
  }

  const currentZone = zoneAt(next);
  const visits = { ...state.visits };
  let enteredZone: string | undefined;
  if (currentZone && currentZone !== state.currentZone) {
    visits[currentZone] = (visits[currentZone] ?? 0) + 1;
    enteredZone = currentZone;
  }
  return {
    state: {
      ...state,
      pos: next,
      facing: direction,
      visits,
      totalSteps: state.totalSteps + 1,
      currentZone,
    },
    enteredZone,
  };
}

export function crossoverAt(state: WalkState): CrossoverTile | null {
  return OVERWORLD_CROSSOVERS.find(
    (crossover) => crossover.at.col === state.pos.col && crossover.at.row === state.pos.row,
  ) ?? null;
}

// Pokémon-like interaction: the current tile wins, then the tile the player
// is facing. Visitors no longer need pixel-perfect placement on a trigger.
export function crossoverInReach(state: WalkState): CrossoverTile | null {
  const current = crossoverAt(state);
  if (current) return current;
  const ahead = offset(state.pos, state.facing);
  return OVERWORLD_CROSSOVERS.find(
    (crossover) => crossover.at.col === ahead.col && crossover.at.row === ahead.row,
  ) ?? null;
}

export function decorationInReach(state: WalkState): RoomDecoration | null {
  const ahead = offset(state.pos, state.facing);
  return decorationAt(ahead.col, ahead.row);
}

export function inspectDecoration(
  state: WalkState,
  decoration: RoomDecoration,
): { state: WalkState; text: string } {
  const count = (state.inspections[decoration.id] ?? 0) + 1;
  return {
    state: {
      ...state,
      inspections: { ...state.inspections, [decoration.id]: count },
    },
    text: decoration.observations[(count - 1) % decoration.observations.length],
  };
}

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

export function restoreState(value: unknown): WalkState {
  if (!value || typeof value !== 'object') return freshState();
  const candidate = value as Partial<WalkState>;
  const pos = candidate.pos;
  const facing = candidate.facing;
  if (!pos || !Number.isInteger(pos.col) || !Number.isInteger(pos.row)) return freshState();
  if (pos.col < 0 || pos.col >= OW_W || pos.row < 0 || pos.row >= OW_H) return freshState();
  if (!isWalkable(OVERWORLD_GRID[pos.row][pos.col])) return freshState();
  if (!['up', 'down', 'left', 'right'].includes(facing ?? '')) return freshState();
  const visits: Record<string, number> = {};
  if (candidate.visits && typeof candidate.visits === 'object') {
    for (const [key, amount] of Object.entries(candidate.visits)) {
      if (Number.isFinite(amount) && amount > 0) visits[key] = Math.floor(amount);
    }
  }
  const inspections: Record<string, number> = {};
  if (candidate.inspections && typeof candidate.inspections === 'object') {
    for (const [key, amount] of Object.entries(candidate.inspections)) {
      if (Number.isFinite(amount) && amount > 0) inspections[key] = Math.floor(amount);
    }
  }
  const currentZone = zoneAt(pos);
  if (currentZone && !visits[currentZone]) visits[currentZone] = 1;
  return {
    pos: { col: pos.col, row: pos.row },
    facing: facing as Direction,
    visits,
    inspections,
    totalSteps: Number.isFinite(candidate.totalSteps) ? Math.max(0, Math.floor(candidate.totalSteps ?? 0)) : 0,
    currentZone,
  };
}
