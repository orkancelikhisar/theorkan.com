import {
  apparentWind, vec, magnitude, headingOf,
  signedAngleDeg, targetSpeed, nextSpeed,
  rudderTurnRate, leewayKnots, heelDeg, trimEfficiency,
} from './physics';
import type { RegattaState } from './state';

const RUDDER_MAX = 35;
const RUDDER_RATE_PER_S = 90;
const RUDDER_CENTER_PER_S = 60;
const SAIL_RATE_PER_S = 60;
const SAIL_MIN = 0;
const SAIL_MAX = 90;

export function updateRegatta(state: RegattaState, now: number, dtMs: number): void {
  if (state.finished) return;
  const dt = dtMs / 1000;
  state.elapsedMs = now - state.startMs;

  // --- wind dynamics ---
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
  if (state.rudderIntent !== 0) {
    state.rudderDeg += state.rudderIntent * RUDDER_RATE_PER_S * dt;
  } else {
    const dir = state.rudderDeg > 0 ? -1 : state.rudderDeg < 0 ? 1 : 0;
    state.rudderDeg += dir * RUDDER_CENTER_PER_S * dt;
    if ((dir > 0 && state.rudderDeg > 0) || (dir < 0 && state.rudderDeg < 0)) state.rudderDeg = 0;
  }
  state.rudderDeg = Math.max(-RUDDER_MAX, Math.min(RUDDER_MAX, state.rudderDeg));

  // up arrow = +1 (haul in, smaller angle). down = -1 (ease out).
  if (state.sailIntent !== 0) {
    state.sailAngleDeg -= state.sailIntent * SAIL_RATE_PER_S * dt;
    state.sailAngleDeg = Math.max(SAIL_MIN, Math.min(SAIL_MAX, state.sailAngleDeg));
  }

  // --- velocity (m/s, 1 kt ≈ 0.514 m/s) ---
  const speedMs = state.speedKt * 0.514;
  state.velocity = vec(state.heading, speedMs);

  // --- apparent wind ---
  const trueWindVec = vec(state.trueWindDeg, windKt * 0.514);
  const apparent = apparentWind(trueWindVec, state.velocity);
  const apMag = magnitude(apparent) / 0.514;
  const apHeading = headingOf(apparent);
  const apAngleSigned = signedAngleDeg(apHeading - state.heading);
  const apAngleAbs = Math.abs(apAngleSigned);

  // --- target + new speed ---
  const target = targetSpeed(apMag, apAngleAbs, state.sailAngleDeg);
  state.speedKt = nextSpeed(state.speedKt, target, dtMs);

  // luff state for rendering
  const trim = trimEfficiency(0, apAngleAbs, state.sailAngleDeg);
  state.luffing = trim <= 0.25 || apAngleAbs < 30;

  // --- heading: rudder turns boat (needs flow) ---
  state.heading += rudderTurnRate(state.rudderDeg, state.speedKt) * dt;
  state.heading = ((state.heading % 360) + 360) % 360;

  // --- position: speed along heading + leeway perpendicular ---
  const headingVec = vec(state.heading, speedMs);
  const leeMs = leewayKnots(apAngleAbs, apMag) * 0.514;
  const leeSign = apAngleSigned >= 0 ? 1 : -1;
  const perp = vec(state.heading + 90 * leeSign, leeMs);
  state.position.x += (headingVec.x + perp.x) * dt;
  state.position.y += (headingVec.y + perp.y) * dt;

  // --- heel (cosmetic) ---
  state.heel = heelDeg(apAngleSigned, apMag, trim);

  // --- coach prompts ---
  if (!state.coach && apAngleAbs < 30 && state.elapsedMs > 5_000) {
    state.coach = 'bear off — pull the rudder, ease the sail.';
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
