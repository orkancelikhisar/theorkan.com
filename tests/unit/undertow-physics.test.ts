import { describe, expect, it } from 'vitest';
import {
  addVortex,
  attachFishingTether,
  attachTether,
  createGlyphBody,
  createWorld,
  disturbSurface,
  moveTether,
  moveFishingTether,
  releaseTether,
  releaseFishingTether,
  removeBody,
  sampleFlow,
  sampleStreamFlow,
  sampleSurface,
  stepWorld,
  worldIsFinite,
} from '../../src/programs/art/undertow/physics';

describe('undertow physics', () => {
  it('is deterministic for a given seed', () => {
    const a = createWorld({ seed: 47 });
    const b = createWorld({ seed: 47 });
    createGlyphBody(a, { text: 'salt remembers', x: 0.5, y: 0.2 });
    createGlyphBody(b, { text: 'salt remembers', x: 0.5, y: 0.2 });
    for (let i = 0; i < 180; i++) { stepWorld(a, 1 / 60); stepWorld(b, 1 / 60); }
    expect(a.bodies[0].particles.map((p) => [p.x, p.y]))
      .toEqual(b.bodies[0].particles.map((p) => [p.x, p.y]));
  });

  it('propagates a surface disturbance', () => {
    const world = createWorld({ seed: 1 });
    const before = sampleSurface(world, 0.5);
    disturbSurface(world, 0.5, 0.18);
    for (let i = 0; i < 12; i++) stepWorld(world, 1 / 60);
    expect(Math.abs(sampleSurface(world, 0.5) - before)).toBeGreaterThan(0.0001);
    expect(Math.abs(sampleSurface(world, 0.47) - before)).toBeGreaterThan(0.000001);
  });

  it('keeps a busy sea finite and contained', () => {
    const world = createWorld({ seed: 22 });
    for (let i = 0; i < 8; i++) {
      createGlyphBody(world, {
        text: `sentence ${i} remained below`,
        x: 0.15 + i * 0.1,
        y: 0.2 + (i % 3) * 0.17,
        velocityX: (i - 4) * 0.003,
        buoyancy: 0.2 + i * 0.09,
      });
    }
    addVortex(world, 0.5, 0.55, 0.2, 0.25, 4);
    for (let i = 0; i < 900; i++) stepWorld(world, 1 / 60);
    expect(worldIsFinite(world)).toBe(true);
    for (const body of world.bodies) for (const p of body.particles) {
      expect(p.x).toBeGreaterThanOrEqual(0.012);
      expect(p.x).toBeLessThanOrEqual(0.988);
      expect(p.y).toBeGreaterThanOrEqual(0.04);
      expect(p.y).toBeLessThanOrEqual(0.97);
    }
  });

  it('breaks an overstretched sentence at a weak joint', () => {
    const world = createWorld({ seed: 5 });
    const body = createGlyphBody(world, { text: 'stay, please', x: 0.5, y: 0.5, age: 20 });
    const last = body.particles.at(-1)!;
    last.pinned = true;
    last.x = 0.98;
    stepWorld(world, 1 / 60);
    expect(world.fractures).toBeGreaterThan(0);
    expect(body.constraints.some((c) => c.broken)).toBe(true);
  });

  it('releases hidden bend links when a sentence fractures', () => {
    const world = createWorld({ seed: 7 });
    const body = createGlyphBody(world, { text: 'one two three', x: 0.5, y: 0.5, age: 20 });
    const spine = body.constraints.find((c) => c.kind === 'spine' && c.a === 4)!;
    spine.broken = true;
    stepWorld(world, 1 / 60);
    const crossingBends = body.constraints.filter((c) => c.kind === 'bend' && c.a <= 4 && c.b >= 5);
    expect(crossingBends.length).toBeGreaterThan(0);
    expect(crossingBends.every((c) => c.broken)).toBe(true);
  });

  it('caps transient vortices under dense pointer input', () => {
    const world = createWorld({ seed: 13 });
    for (let i = 0; i < 100; i++) addVortex(world, i / 100, 0.6);
    expect(world.vortices).toHaveLength(24);
  });

  it('gives remembered and repeated language physical density', () => {
    const world = createWorld({ seed: 17 });
    const first = createGlyphBody(world, { text: 'salt waits', x: 0.4, y: 0.5 });
    const second = createGlyphBody(world, { text: 'salt and time', x: 0.6, y: 0.6 });
    expect(second.particles[0].mass).toBeGreaterThan(first.particles[0].mass);

    const tendon = second.constraints.find((c) => c.kind === 'spine' && c.a === 4)!;
    expect(tendon.stiffness).toBeLessThan(0.5);
    expect(tendon.breakRatio).toBeGreaterThan(2.7);
  });

  it('keeps ordinary words intact while giving endings extra ballast', () => {
    const world = createWorld({ seed: 19 });
    const body = createGlyphBody(world, { text: 'one two', x: 0.5, y: 0.5 });
    const internalWordLink = body.constraints.find((c) => c.kind === 'spine' && c.a === 0)!;
    expect(internalWordLink.breakRatio).toBe(Number.POSITIVE_INFINITY);
    expect(body.particles[4].buoyancy).toBeLessThan(body.particles[0].buoyancy);
  });

  it('runs opposing surface and deep currents', () => {
    const world = createWorld({ seed: 9 });
    const surface = sampleSurface(world, 0.2);
    expect(sampleFlow(world, 0.2, surface + 0.03).x).toBeGreaterThan(0);
    expect(sampleFlow(world, 0.2, 0.92).x).toBeLessThan(0);
  });

  it('carries streamed language east at every depth and tide polarity', () => {
    const world = createWorld({ seed: 23 });
    world.flowDirection = -1;
    for (const y of [0.36, 0.5, 0.7, 0.92]) {
      expect(sampleStreamFlow(world, 0.4, y).x).toBeGreaterThan(0);
    }
  });

  it('lets streamed sentences leave the viewport without sinking into a corner', () => {
    const world = createWorld({ seed: 29 });
    const body = createGlyphBody(world, {
      text: 'the current keeps moving',
      x: 0.82,
      y: 0.62,
      stream: { laneY: 0.62, targetY: 0.62, speed: 0.06 },
    });
    for (let i = 0; i < 720; i++) stepWorld(world, 1 / 60);
    expect(Math.max(...body.particles.map((particle) => particle.x))).toBeGreaterThan(1);
    const meanY = body.particles.reduce((sum, particle) => sum + particle.y, 0) / body.particles.length;
    expect(meanY).toBeGreaterThan(0.48);
    expect(meanY).toBeLessThan(0.76);
  });

  it('drops a newly offered punctuated line through the surface before carrying it east', () => {
    const world = createWorld({ seed: 30 });
    const body = createGlyphBody(world, {
      text: 'wait—did you hear that?',
      x: 0.5,
      y: world.surfaceY - 0.075,
      velocityX: 0.046 * 0.22,
      velocityY: 0.018,
      stream: { laneY: 0.68, targetY: 0.68, speed: 0.046 },
    });
    const startX = body.particles[0].x;
    for (let i = 0; i < 90; i++) stepWorld(world, 1 / 60);
    const meanY = body.particles.reduce((sum, particle) => sum + particle.y, 0) / body.particles.length;
    expect(meanY).toBeGreaterThan(world.surfaceY + 0.04);
    expect(body.particles[0].x).toBeGreaterThan(startX);
    expect(world.impacts.some((impact) => impact.kind === 'surface')).toBe(true);
  });

  it('pulls one unpinned letter through a soft physical tether', () => {
    const world = createWorld({ seed: 31 });
    const controlWorld = createWorld({ seed: 31 });
    const body = createGlyphBody(world, { text: 'alive', x: 0.25, y: 0.5 });
    const controlBody = createGlyphBody(controlWorld, { text: 'alive', x: 0.25, y: 0.5 });
    const held = body.particles[2];
    attachTether(world, held.id, 0.85, 0.35);
    stepWorld(world, 1 / 60);
    stepWorld(controlWorld, 1 / 60);
    expect(held.pinned).toBe(false);
    expect(held.x).toBeGreaterThan(0.24);
    expect(held.x).toBeLessThan(0.35);
    for (let i = 0; i < 24; i++) {
      stepWorld(world, 1 / 60);
      stepWorld(controlWorld, 1 / 60);
    }
    expect(body.particles[1].x).toBeGreaterThan(controlBody.particles[1].x + 0.01);
    expect(Math.abs(held.x - 0.85)).toBeGreaterThan(0.001);
    expect(held.x).toBeLessThan(0.92);
  });

  it('preserves tether momentum on release and clears it with its body', () => {
    const world = createWorld({ seed: 37 });
    const body = createGlyphBody(world, { text: 'x', x: 0.25, y: 0.4 });
    const held = body.particles[0];
    attachTether(world, held.id, 0.7, 0.4);
    for (let i = 0; i < 8; i++) stepWorld(world, 1 / 60);
    const beforeRelease = held.x;
    const historyBeforeRelease = [held.previousX, held.previousY];
    releaseTether(world);
    expect([held.previousX, held.previousY]).toEqual(historyBeforeRelease);
    stepWorld(world, 1 / 60);
    expect(held.x).toBeGreaterThan(beforeRelease);
    attachTether(world, held.id, 0.8, 0.4);
    removeBody(world, body);
    expect(world.tether).toBeNull();
  });

  it('lets Dilenci pull a word with a taut one-way fishing cable', () => {
    const world = createWorld({ seed: 38 });
    const control = createWorld({ seed: 38 });
    const body = createGlyphBody(world, { text: 'a word passing', x: 0.35, y: 0.62 });
    const controlBody = createGlyphBody(control, { text: 'a word passing', x: 0.35, y: 0.62 });
    const hooked = body.particles[3];
    const start = { x: hooked.x, y: hooked.y };
    attachFishingTether(world, hooked.id, hooked.x, hooked.y, 0.008);
    moveFishingTether(world, 0.62, 0.4, 0.004);
    stepWorld(world, 1 / 60);
    stepWorld(control, 1 / 60);
    expect(hooked.pinned).toBe(false);
    expect(Math.hypot(hooked.x - start.x, hooked.y - start.y)).toBeLessThan(0.02);
    for (let i = 0; i < 35; i++) {
      stepWorld(world, 1 / 60);
      stepWorld(control, 1 / 60);
    }
    expect(hooked.x).toBeGreaterThan(controlBody.particles[3].x + 0.015);
    expect(body.particles[2].x).toBeGreaterThan(controlBody.particles[2].x + 0.005);
    const historyBeforeRelease = [hooked.previousX, hooked.previousY];
    releaseFishingTether(world);
    expect([hooked.previousX, hooked.previousY]).toEqual(historyBeforeRelease);
    expect(worldIsFinite(world)).toBe(true);
  });

  it('keeps a slack fishing cable passive and yields its letter to the visitor', () => {
    const world = createWorld({ seed: 39 });
    const control = createWorld({ seed: 39 });
    const body = createGlyphBody(world, { text: 'slack', x: 0.35, y: 0.62 });
    const controlBody = createGlyphBody(control, { text: 'slack', x: 0.35, y: 0.62 });
    const hooked = body.particles[2];
    attachFishingTether(world, hooked.id, hooked.x + 0.04, hooked.y, 0.2);
    for (let i = 0; i < 20; i++) {
      stepWorld(world, 1 / 60);
      stepWorld(control, 1 / 60);
    }
    expect(body.particles.map((particle) => [particle.x, particle.y]))
      .toEqual(controlBody.particles.map((particle) => [particle.x, particle.y]));
    expect(world.fishingTether?.tension).toBe(0);

    moveFishingTether(world, 0.8, 0.3, 0.002);
    stepWorld(world, 1 / 60);
    attachTether(world, hooked.id, hooked.x, hooked.y);
    expect(world.fishingTether).toBeNull();
    releaseTether(world);
    attachFishingTether(world, hooked.id, hooked.x, hooked.y, 0.01);
    removeBody(world, body);
    expect(world.fishingTether).toBeNull();
  });

  it('can lift a light word visibly through the surface', () => {
    const world = createWorld({ seed: 40 });
    const body = createGlyphBody(world, {
      text: 'love returns home',
      x: 0.55,
      y: 0.42,
      buoyancy: 0.82,
      stream: { laneY: 0.42, targetY: 0.42, speed: 0.044 },
    });
    const hooked = body.particles[2];
    const start = { x: hooked.x, y: hooked.y };
    expect(attachFishingTether(world, hooked.id, hooked.x, hooked.y, 0.008)).toBe(true);
    let breached = false;
    let maxTension = 0;
    for (let frame = 0; frame < 276; frame++) {
      const raw = frame / 275;
      const eased = raw * raw * (3 - 2 * raw);
      const anchorX = start.x + (0.74 - start.x) * eased;
      const anchorY = start.y + (world.surfaceY - 0.042 - start.y) * eased;
      moveFishingTether(world, anchorX, anchorY, 0.008 + (0.001 - 0.008) * eased);
      stepWorld(world, 1 / 60);
      maxTension = Math.max(maxTension, world.fishingTether?.tension ?? 0);
      if (hooked.y < sampleSurface(world, hooked.x) - 0.004) breached = true;
    }
    expect(breached).toBe(true);
    expect(maxTension).toBeLessThan(0.52);
    expect(worldIsFinite(world)).toBe(true);

    releaseFishingTether(world);
    expect(attachFishingTether(world, 999_999, 0.5, 0.5)).toBe(false);
    expect(world.fishingTether).toBeNull();
  });

  it('can still fracture a weak joint while one letter is tethered', () => {
    const world = createWorld({ seed: 41 });
    const body = createGlyphBody(world, { text: 'stay, please', x: 0.4, y: 0.5, age: 20 });
    const held = body.particles.at(-1)!;
    attachTether(world, held.id, 0.96, 0.25);
    for (let i = 0; i < 120; i++) {
      if (i % 6 === 0) moveTether(world, i % 12 === 0 ? 0.96 : 0.04, i % 12 === 0 ? 0.25 : 0.8);
      stepWorld(world, 1 / 60);
    }
    expect(world.fractures).toBeGreaterThan(0);
    expect(worldIsFinite(world)).toBe(true);
  });
});
