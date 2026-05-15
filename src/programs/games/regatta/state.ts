import type { Vec2 } from './physics';

export interface Buoy {
  pos: Vec2;
  rounded: boolean;
}

export interface RegattaState {
  // Boat
  position: Vec2;            // world frame, meters
  velocity: Vec2;            // world frame, m/s
  heading: number;           // degrees
  rudderDeg: number;         // -35..35

  // Sail (force-based)
  sailAngleDeg: number;      // current sail angle, signed (-90..+90, 0 = centerline aft)
  sailVelDeg: number;        // sail angular velocity, deg/s
  sailMaxDeg: number;        // mainsheet limit (player-controlled, 5..90)

  // Cosmetic
  heel: number;              // degrees, signed (visual)
  luffing: boolean;

  // Wind
  trueWindDeg: number;
  trueWindKt: number;
  windTargetDeg: number;
  windTargetKt: number;
  nextShiftAt: number;
  gustUntil: number;

  // Race
  buoys: Buoy[];
  nextBuoy: number;
  startMs: number;
  elapsedMs: number;
  finished: boolean;

  // Input intents (set on keydown, cleared on keyup)
  rudderIntent: -1 | 0 | 1;
  sheetIntent: -1 | 0 | 1;   // +1 = haul in (decrease max), -1 = ease out (increase max)

  // Tutorial / coach
  showTutorial: boolean;
  coach: string | null;
  coachUntil: number;
}

export function initialState(now: number): RegattaState {
  const startDeg = 45;
  return {
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    heading: 0,
    rudderDeg: 0,

    sailAngleDeg: 0,
    sailVelDeg: 0,
    sailMaxDeg: 60,

    heel: 0,
    luffing: false,

    trueWindDeg: startDeg,
    trueWindKt: 15,
    windTargetDeg: startDeg,
    windTargetKt: 15,
    nextShiftAt: now + 25_000,
    gustUntil: 0,

    buoys: [
      { pos: { x: 0,    y: 250 }, rounded: false },
      { pos: { x: -120, y: -150 }, rounded: false },
      { pos: { x: 0,    y: 0   }, rounded: false },
    ],
    nextBuoy: 0,
    startMs: now,
    elapsedMs: 0,
    finished: false,

    rudderIntent: 0,
    sheetIntent: 0,

    showTutorial: true,
    coach: null,
    coachUntil: 0,
  };
}
