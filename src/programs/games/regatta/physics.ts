export interface Vec2 { x: number; y: number; }

// Tuning constants (all original; tweak to taste)
export const HULL_DRAG = 0.5;          // linear drag, per second
export const SAIL_FORCE_COEFF = 0.18;
export const SAIL_DAMPING = 0.86;       // per-step damping on sail rotation
export const SAIL_RESTORE = 6;          // torque pulling sail toward wind alignment

export function deg2rad(d: number): number { return (d * Math.PI) / 180; }
export function rad2deg(r: number): number { return (r * 180) / Math.PI; }

export function signedAngleDeg(deg: number): number {
  let a = deg % 360;
  if (a > 180) a -= 360;
  if (a < -180) a += 360;
  return a;
}

// vec from heading + magnitude. heading=0 is +y (north), heading=90 is +x (east)
export function vec(headingDeg: number, m: number): Vec2 {
  const r = deg2rad(headingDeg);
  return { x: Math.sin(r) * m, y: -Math.cos(r) * m };
}

export function magnitude(v: Vec2): number { return Math.hypot(v.x, v.y); }

export function headingOf(v: Vec2): number {
  return rad2deg(Math.atan2(v.x, -v.y));
}

export function apparentWind(trueWind: Vec2, boatVelocity: Vec2): Vec2 {
  return { x: trueWind.x - boatVelocity.x, y: trueWind.y - boatVelocity.y };
}

// Rotate v by deg. Our screen convention: +y is up; positive rotation is counterclockwise.
export function rotate(v: Vec2, deg: number): Vec2 {
  const r = deg2rad(deg);
  const cs = Math.cos(r), sn = Math.sin(r);
  return { x: v.x * cs - v.y * sn, y: v.x * sn + v.y * cs };
}

// World ↔ boat frame conversions. In boat frame, +y points forward (bow), +x to starboard.
export function toBoatFrame(world: Vec2, headingDeg: number): Vec2 {
  return rotate(world, -headingDeg);
}
export function toWorldFrame(boat: Vec2, headingDeg: number): Vec2 {
  return rotate(boat, headingDeg);
}

// Rudder needs flow to work. Returns deg/sec at the given rudder angle + speed.
export function rudderTurnRate(rudderDeg: number, speedKt: number): number {
  return rudderDeg * Math.min(speedKt, 4) * 2.4;
}

// Visual heel (degrees). Drives a small rotation on the boat sprite. Sign follows
// the lateral force in the boat frame: starboard push → port heel.
export function heelDegFromForce(lateralForce: number): number {
  return -Math.max(-15, Math.min(15, lateralForce * 14));
}

// ---- sail dynamics (force-based) ----

export interface SailStep {
  sailAngleDeg: number;      // new sail angle (signed, -90..+90)
  sailVelDeg: number;        // new angular velocity (deg/s)
  forceBoatFrame: Vec2;      // force on the boat, in boat frame
  ropeTaut: boolean;
  luffing: boolean;
}

/**
 * Force-based sail dynamics step.
 *
 * Model:
 *  - The sail rotates freely on its mast within [−sailMaxDeg, +sailMaxDeg].
 *  - Wind torque pulls the sail toward the apparent-wind direction (alignment
 *    with chord → zero angle of attack → no force).
 *  - When the sail hits the mainsheet-imposed limit, the rope is taut and
 *    transmits a force to the boat. That force is the component of apparent
 *    wind perpendicular to the sail face, applied along the sail normal.
 *  - When the sail is free (not at the limit), it just flaps. No force.
 *
 * Coordinates:
 *  - sailAngleDeg / sailVelDeg in the boat frame; positive = boom to starboard.
 *  - sailMaxDeg is the player-set mainsheet limit (≥ 0).
 *  - apparentBoat is apparent wind in the boat frame (units: m/s).
 */
export function stepSail(
  sailAngleDeg: number,
  sailVelDeg: number,
  sailMaxDeg: number,
  apparentBoat: Vec2,
  dtMs: number,
): SailStep {
  const dt = dtMs / 1000;

  // Target sail angle: align with apparent wind direction (heading of the
  // apparent wind vector). Clamp to the sail's mechanical range [-90, +90]
  // (boom can't physically swing past 90° to either side).
  const windDir = headingOf(apparentBoat);
  const target = Math.max(-90, Math.min(90, signedAngleDeg(windDir)));

  // Restoring torque toward target with damping.
  const torque = (target - sailAngleDeg) * SAIL_RESTORE;
  let newVel = sailVelDeg + torque * dt;
  newVel *= SAIL_DAMPING;
  let newAngle = sailAngleDeg + newVel * dt;

  // Clamp to rope-imposed maximum.
  let ropeTaut = false;
  if (newAngle > sailMaxDeg)  { newAngle =  sailMaxDeg; newVel = 0; ropeTaut = true; }
  if (newAngle < -sailMaxDeg) { newAngle = -sailMaxDeg; newVel = 0; ropeTaut = true; }

  // Force from sail: only when rope is taut.
  // Chord direction in boat frame: (sin(angle), -cos(angle)) — points along sail
  // from mast (gooseneck) to clew (boom tip).
  // Normal perpendicular to chord (90° CCW): (cos(angle), sin(angle)).
  // The normal points to leeward (away from the wind face). Wind's component
  // perpendicular to the sail pushes the boat in that same direction.
  // Force = (wind · normal) × normal × coefficient.
  let forceBoatFrame: Vec2 = { x: 0, y: 0 };
  let luffing = false;
  if (ropeTaut) {
    const a = deg2rad(newAngle);
    const nx = Math.cos(a), ny = Math.sin(a);
    const wDotN = apparentBoat.x * nx + apparentBoat.y * ny;
    forceBoatFrame = {
      x: wDotN * nx * SAIL_FORCE_COEFF,
      y: wDotN * ny * SAIL_FORCE_COEFF,
    };
  } else {
    luffing = magnitude(apparentBoat) > 0.5;
  }

  return { sailAngleDeg: newAngle, sailVelDeg: newVel, forceBoatFrame, ropeTaut, luffing };
}
