import {
  vec, magnitude, headingOf,
  signedAngleDeg, apparentWind,
  toBoatFrame, toWorldFrame,
  rudderTurnRate, heelDegFromForce,
  stepSail,
  HULL_DRAG,
} from './physics';
import type { RegattaState } from './state';

const RUDDER_MAX = 35;
const RUDDER_RATE_PER_S = 90;
const RUDDER_CENTER_PER_S = 60;
const SHEET_RATE_PER_S = 50;        // deg/s applied to sailMaxDeg
const SHEET_MIN = 5;
const SHEET_MAX = 90;
const KT_TO_MS = 0.5144;

export function updateRegatta(state: RegattaState, now: number, dtMs: number): void {
  if (state.finished) return;
  const dt = dtMs / 1000;
  state.elapsedMs = now - state.startMs;

  // --- wind dynamics (shifts + gusts) ---
  if (now >= state.nextShiftAt) {
    state.windTargetDeg += (Math.random() - 0.5) * 30;
    state.windTargetKt = 3 + Math.random() * 6;
    state.nextShiftAt = now + 20_000 + Math.random() * 20_000;
  }
  state.trueWindDeg += signedAngleDeg(state.windTargetDeg - state.trueWindDeg) * Math.min(1, dt / 8);
  state.trueWindKt += (state.windTargetKt - state.trueWindKt) * Math.min(1, dt / 6);
  if (now > state.gustUntil + 60_000 && Math.random() < dt * 0.02) {
    state.gustUntil = now + 4_000 + Math.random() * 4_000;
  }
  const gustMul = now < state.gustUntil ? 1.4 : 1.0;
  const windKt = state.trueWindKt * gustMul;

  // --- input → controls ---
  // Rudder: hold to turn, self-center on release.
  if (state.rudderIntent !== 0) {
    state.rudderDeg += state.rudderIntent * RUDDER_RATE_PER_S * dt;
  } else {
    const dir = state.rudderDeg > 0 ? -1 : state.rudderDeg < 0 ? 1 : 0;
    state.rudderDeg += dir * RUDDER_CENTER_PER_S * dt;
    if ((dir > 0 && state.rudderDeg > 0) || (dir < 0 && state.rudderDeg < 0)) state.rudderDeg = 0;
  }
  state.rudderDeg = Math.max(-RUDDER_MAX, Math.min(RUDDER_MAX, state.rudderDeg));

  // Mainsheet: ↑ hauls in (decreases max angle), ↓ eases out (increases).
  if (state.sheetIntent !== 0) {
    state.sailMaxDeg -= state.sheetIntent * SHEET_RATE_PER_S * dt;
    state.sailMaxDeg = Math.max(SHEET_MIN, Math.min(SHEET_MAX, state.sailMaxDeg));
  }

  // --- apparent wind in boat frame ---
  const trueWindVec = vec(state.trueWindDeg, windKt * KT_TO_MS);
  const apparentWorld = apparentWind(trueWindVec, state.velocity);
  const apparentBoat = toBoatFrame(apparentWorld, state.heading);

  // --- sail step + force ---
  const sailStep = stepSail(
    state.sailAngleDeg,
    state.sailVelDeg,
    state.sailMaxDeg,
    apparentBoat,
    dtMs,
  );
  state.sailAngleDeg = sailStep.sailAngleDeg;
  state.sailVelDeg = sailStep.sailVelDeg;
  state.luffing = sailStep.luffing;

  // --- apply force to velocity (with drag) ---
  const forceWorld = toWorldFrame(sailStep.forceBoatFrame, state.heading);
  state.velocity.x += forceWorld.x * dt;
  state.velocity.y += forceWorld.y * dt;
  // Linear hull drag.
  const decay = Math.exp(-HULL_DRAG * dt);
  state.velocity.x *= decay;
  state.velocity.y *= decay;

  // --- heading: rudder turns boat (needs flow) ---
  const speedMs = magnitude(state.velocity);
  const speedKt = speedMs / KT_TO_MS;
  state.heading += rudderTurnRate(state.rudderDeg, speedKt) * dt;
  state.heading = ((state.heading % 360) + 360) % 360;

  // --- position ---
  state.position.x += state.velocity.x * dt;
  state.position.y += state.velocity.y * dt;

  // --- heel (cosmetic) ---
  state.heel = heelDegFromForce(sailStep.forceBoatFrame.x);

  // --- coach prompts ---
  const apparentAbs = magnitude(apparentBoat) > 0.5
    ? Math.abs(signedAngleDeg(headingOf(apparentBoat)))
    : 0;
  if (!state.coach && state.luffing && state.elapsedMs > 5_000) {
    state.coach = 'sail is luffing. trim in (↑) or bear off.';
    state.coachUntil = now + 5_000;
  } else if (!state.coach && apparentAbs < 30 && state.elapsedMs > 5_000 && speedKt < 0.3) {
    state.coach = 'in irons. bear off — pull the rudder.';
    state.coachUntil = now + 5_000;
  } else if (state.coach && now > state.coachUntil) {
    state.coach = null;
  }

  // --- buoy rounding ---
  if (state.nextBuoy < state.buoys.length) {
    const b = state.buoys[state.nextBuoy];
    const dx = state.position.x - b.pos.x;
    const dy = state.position.y - b.pos.y;
    if (Math.hypot(dx, dy) < 30) {
      b.rounded = true;
      state.nextBuoy += 1;
      if (state.nextBuoy >= state.buoys.length) {
        state.finished = true;
        const best = parseInt(localStorage.getItem('theorkan.regatta.best') || '999999', 10);
        if (state.elapsedMs < best) {
          localStorage.setItem('theorkan.regatta.best', String(Math.floor(state.elapsedMs)));
        }
      }
    }
  }

  state.trueWindDeg = ((state.trueWindDeg % 360) + 360) % 360;
}
