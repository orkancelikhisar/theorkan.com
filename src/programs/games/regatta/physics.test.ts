import { describe, it, expect } from 'vitest';
import {
  signedAngleDeg,
  apparentWind,
  toBoatFrame,
  toWorldFrame,
  rotate,
  rudderTurnRate,
  stepSail,
  headingOf,
  type Vec2,
} from './physics';

describe('regatta physics — primitives', () => {
  it('signedAngleDeg wraps to [-180, 180]', () => {
    expect(signedAngleDeg(190)).toBeCloseTo(-170, 0);
    expect(signedAngleDeg(-190)).toBeCloseTo(170, 0);
    expect(signedAngleDeg(45)).toBeCloseTo(45, 0);
  });

  it('apparentWind subtracts boat velocity from true wind', () => {
    const wind: Vec2 = { x: 5, y: 0 };
    const boatVel: Vec2 = { x: 3, y: 0 };
    const ap = apparentWind(wind, boatVel);
    expect(ap.x).toBeCloseTo(2, 5);
    expect(ap.y).toBeCloseTo(0, 5);
  });

  it('rotate by 0 is identity', () => {
    const r = rotate({ x: 1, y: 2 }, 0);
    expect(r.x).toBeCloseTo(1, 5);
    expect(r.y).toBeCloseTo(2, 5);
  });

  it('toBoatFrame + toWorldFrame are inverse', () => {
    const w: Vec2 = { x: 3, y: 4 };
    const back = toWorldFrame(toBoatFrame(w, 45), 45);
    expect(back.x).toBeCloseTo(3, 5);
    expect(back.y).toBeCloseTo(4, 5);
  });

  it('rudder produces no turn at zero speed', () => {
    expect(rudderTurnRate(30, 0)).toBeCloseTo(0, 5);
  });

  it('rudder produces turn proportional to speed (capped)', () => {
    expect(rudderTurnRate(10, 2)).toBeGreaterThan(rudderTurnRate(10, 1));
    expect(rudderTurnRate(10, 10)).toBeCloseTo(rudderTurnRate(10, 4), 5);
  });
});

describe('regatta physics — sail dynamics', () => {
  it('produces zero force when the rope is not taut', () => {
    // Apparent wind directly behind the boat, sail max wide open (sail will
    // freely align with wind, rope not taut).
    const apparent: Vec2 = { x: 0, y: 5 };
    const r = stepSail(0, 0, 89, apparent, 16);
    expect(r.forceBoatFrame.x).toBeCloseTo(0, 1);
    expect(r.forceBoatFrame.y).toBeCloseTo(0, 1);
  });

  it('produces force in the leeward direction when rope is taut', () => {
    // Wind from port: apparent.x > 0 means wind blowing toward starboard,
    // which means it's coming FROM port. Sail swings to leeward (starboard).
    // Rope clamps at +20°. Force on boat is to starboard (leeward = +x).
    const apparent: Vec2 = { x: 4, y: 0 };
    let angle = 0, vel = 0;
    for (let i = 0; i < 60; i++) {
      const r = stepSail(angle, vel, 20, apparent, 16);
      angle = r.sailAngleDeg; vel = r.sailVelDeg;
    }
    const finalStep = stepSail(angle, vel, 20, apparent, 16);
    expect(finalStep.ropeTaut).toBe(true);
    expect(finalStep.sailAngleDeg).toBeGreaterThan(0);
    expect(finalStep.forceBoatFrame.x).toBeGreaterThan(0);
  });

  it('luffs when the wind has magnitude but the rope is not taut', () => {
    const apparent: Vec2 = { x: 0, y: 5 };
    const r = stepSail(0, 0, 89, apparent, 16);
    expect(r.luffing).toBe(true);
  });

  it('rotates the sail toward the wind direction over time', () => {
    // Wind from port (apparent.x > 0 = wind blowing to starboard). Sail
    // starts at 0 and rotates to the leeward (starboard) side. After ~1.5s
    // of simulated time the sail should be well past 30° and approaching
    // the target of +90°.
    const apparent: Vec2 = { x: 5, y: 0 };
    let angle = 0, vel = 0;
    for (let i = 0; i < 100; i++) {
      const r = stepSail(angle, vel, 89, apparent, 16);
      angle = r.sailAngleDeg; vel = r.sailVelDeg;
    }
    expect(angle).toBeGreaterThan(30);
    expect(angle).toBeLessThan(90);
  });

  it('clamps sail angle to mainsheet limit', () => {
    // Strong wind from port — sail wants +90°, rope limits to +15°.
    const apparent: Vec2 = { x: 10, y: 0 };
    let angle = 0, vel = 0;
    for (let i = 0; i < 60; i++) {
      const r = stepSail(angle, vel, 15, apparent, 16);
      angle = r.sailAngleDeg; vel = r.sailVelDeg;
    }
    expect(angle).toBeLessThanOrEqual(15.001);
    expect(angle).toBeGreaterThan(14.5);
  });

  it('headingOf agrees with vec / signedAngleDeg round-trip', () => {
    const directions = [0, 45, 90, 135, 180, -45, -90];
    for (const d of directions) {
      const v = { x: Math.sin(d * Math.PI / 180), y: -Math.cos(d * Math.PI / 180) };
      expect(signedAngleDeg(headingOf(v) - d)).toBeCloseTo(0, 3);
    }
  });
});
