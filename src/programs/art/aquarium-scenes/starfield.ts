import type { Scene } from './types';

// Classic 3D-projected starfield. Each star has a position in (x, y, z) and
// moves toward the camera (z decreases). When z drops below the near plane we
// respawn it far away.

interface Star { x: number; y: number; z: number; }

interface State {
  stars: Star[];
}

const STAR_COUNT = 90;
const NEAR_Z = 0.05;
const FAR_Z = 1.0;
const SPEED = 0.00018; // z-units per ms

function spawn(): Star {
  return {
    x: (Math.random() - 0.5) * 2,
    y: (Math.random() - 0.5) * 2,
    z: NEAR_Z + Math.random() * (FAR_Z - NEAR_Z),
  };
}

export const starfieldScene: Scene<State> = {
  name: 'starfield',
  description: 'a slow drift through stars',
  init() {
    const stars: Star[] = [];
    for (let i = 0; i < STAR_COUNT; i++) stars.push(spawn());
    return { stars };
  },
  frame(state, { ctx, width, height }, dtMs) {
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;

    for (const s of state.stars) {
      s.z -= SPEED * dtMs;
      if (s.z < NEAR_Z) Object.assign(s, spawn(), { z: FAR_Z });
      const px = cx + (s.x / s.z) * cx * 0.7;
      const py = cy + (s.y / s.z) * cy * 0.7;
      if (px < 0 || px >= width || py < 0 || py >= height) continue;
      const brightness = Math.min(1, 1 - (s.z - NEAR_Z) / (FAR_Z - NEAR_Z));
      const size = brightness < 0.4 ? 1 : 2;
      const shade = Math.floor(brightness * 232);
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      ctx.fillRect(px, py, size, size);
    }
  },
};
