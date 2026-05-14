import type { Vec2 } from './physics';

export interface Buoy {
  pos: Vec2;
  rounded: boolean;
}

export interface RegattaState {
  // boat
  position: Vec2;
  velocity: Vec2;
  heading: number;
  speedKt: number;
  rudderDeg: number;
  sailAngleDeg: number;
  heel: number;

  // wind
  trueWindDeg: number;
  trueWindKt: number;
  windTargetDeg: number;
  windTargetKt: number;
  nextShiftAt: number;
  gustUntil: number;

  // race
  buoys: Buoy[];
  nextBuoy: number;
  startMs: number;
  elapsedMs: number;
  finished: boolean;

  // input intents
  rudderIntent: -1 | 0 | 1;
  sailIntent: -1 | 0 | 1;

  // tutorial / coach
  showTutorial: boolean;
  coach: string | null;
  coachUntil: number;

  // luff state for rendering
  luffing: boolean;
}

export function initialState(now: number): RegattaState {
  const startDeg = 45;
  return {
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    heading: 0,
    speedKt: 0,
    rudderDeg: 0,
    sailAngleDeg: 45,
    heel: 0,

    trueWindDeg: startDeg,
    trueWindKt: 6,
    windTargetDeg: startDeg,
    windTargetKt: 6,
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
    sailIntent: 0,

    showTutorial: true,
    coach: null,
    coachUntil: 0,

    luffing: false,
  };
}
