export interface Vec2 { x: number; y: number; }

export const HULL_CAP_KT = 7;

export function deg2rad(d: number): number { return (d * Math.PI) / 180; }
export function rad2deg(r: number): number { return (r * 180) / Math.PI; }

export function signedAngleDeg(deg: number): number {
  let a = deg % 360;
  if (a > 180) a -= 360;
  if (a < -180) a += 360;
  return a;
}

// vec from heading + magnitude. heading=0 is +y (north), heading=90 is +x (east).
export function vec(headingDeg: number, magnitude: number): Vec2 {
  const r = deg2rad(headingDeg);
  return { x: Math.sin(r) * magnitude, y: -Math.cos(r) * magnitude };
}

export function magnitude(v: Vec2): number {
  return Math.hypot(v.x, v.y);
}

// Heading angle (deg) of a vector (0 = north, clockwise positive)
export function headingOf(v: Vec2): number {
  return rad2deg(Math.atan2(v.x, -v.y));
}

export function apparentWind(trueWind: Vec2, boatVelocity: Vec2): Vec2 {
  return { x: trueWind.x - boatVelocity.x, y: trueWind.y - boatVelocity.y };
}

// Point-of-sail efficiency curve from spec §7.2
export function pointOfSailEfficiency(apparentAngleDeg: number): number {
  const a = Math.abs(apparentAngleDeg);
  if (a < 30)      return 0;
  if (a < 45)      return ((a - 30) / 15) * 0.7;
  if (a < 60)      return 0.7 + ((a - 45) / 15) * 0.2;
  if (a < 90)      return 0.9 + ((a - 60) / 30) * 0.1;
  if (a < 110)     return 1.0;
  if (a < 150)     return 1.0 - ((a - 110) / 40) * 0.15;
  return 0.85 - ((a - 150) / 30) * 0.25;
}

// Optimal sail angle for a given apparent angle (deg). Clamped 10..85.
export function optimalSailAngle(apparentAngleDeg: number): number {
  const half = Math.abs(apparentAngleDeg) / 2;
  return Math.max(10, Math.min(85, half));
}

// Returns trim efficiency [0..1]. Loose-sail luff returns 0.2.
export function trimEfficiency(
  _heel: number, apparentAngleDeg: number, sailAngleDeg: number,
): number {
  const optimal = optimalSailAngle(apparentAngleDeg);
  const error = Math.abs(sailAngleDeg - optimal);
  if (sailAngleDeg > optimal && error > 25) return 0.2;
  return Math.max(0, 1 - error / 30);
}

export function targetSpeed(
  windKnots: number, apparentAngleDeg: number, sailAngleDeg: number,
): number {
  const pe = pointOfSailEfficiency(apparentAngleDeg);
  const te = trimEfficiency(0, apparentAngleDeg, sailAngleDeg);
  return Math.min(windKnots * 0.85, HULL_CAP_KT) * pe * te;
}

// Asymmetric acceleration: boats accelerate faster than they decelerate.
export function nextSpeed(currentKt: number, target: number, dtMs: number): number {
  const dt = dtMs / 1000;
  let delta = (target - currentKt) * 1.2 * dt;
  if (delta < 0) delta *= 0.5;
  return Math.max(0, currentKt + delta);
}

// Rudder needs flow to work. turnRate = rudderAngleDeg * speed * k (deg/s)
export function rudderTurnRate(rudderDeg: number, speedKt: number): number {
  return rudderDeg * speedKt * 2.4;
}

// Leeway: small sideways slip into the wind on close-hauled headings.
export function leewayKnots(apparentAngleDeg: number, windKnots: number): number {
  const a = Math.abs(apparentAngleDeg);
  if (a > 90) return 0;
  const factor = 1 - a / 90;
  return factor * 0.05 * windKnots;
}

// Visual heel only — signed degrees, clamped.
export function heelDeg(apparentAngleDeg: number, windKnots: number, trim: number): number {
  const a = Math.abs(apparentAngleDeg);
  if (a > 120) return 0;
  const sign = apparentAngleDeg > 0 ? 1 : -1;
  return sign * Math.min(15, windKnots * 0.3 * Math.cos(deg2rad(a)) * trim);
}
