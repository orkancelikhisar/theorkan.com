import type { Scene } from './types';

interface Entity {
  kind: 'boat' | 'gull' | 'drift';
  x: number;
  y: number;
  vx: number;
  facing: 1 | -1;
}

interface State {
  entities: Entity[];
}

function spawnEntity(width: number, height: number): Entity {
  const r = Math.random();
  if (r < 0.5) {
    const facing: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    return {
      kind: 'boat',
      x: facing === 1 ? -20 : width + 20,
      y: height * 0.55 + Math.random() * 20,
      vx: facing * (0.15 + Math.random() * 0.2),
      facing,
    };
  } else if (r < 0.85) {
    const facing: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    return {
      kind: 'gull',
      x: facing === 1 ? -10 : width + 10,
      y: 10 + Math.random() * 50,
      vx: facing * (0.4 + Math.random() * 0.3),
      facing,
    };
  } else {
    return {
      kind: 'drift',
      x: -10,
      y: height * 0.65 + Math.random() * 30,
      vx: 0.06 + Math.random() * 0.08,
      facing: 1,
    };
  }
}

export const boatsScene: Scene<State> = {
  name: 'boats',
  description: 'sailing boats, gulls, driftwood',
  init: ({ width, height }) => {
    const entities: Entity[] = [];
    for (let i = 0; i < 6; i++) entities.push(spawnEntity(width, height));
    return { entities };
  },
  frame(state, { ctx, width, height }) {
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#3a3935';
    for (let x = 0; x < width; x += 6) {
      const y = height * 0.6 + Math.sin((x + Date.now() * 0.001) * 0.05) * 2;
      ctx.fillRect(x, y, 2, 1);
    }

    ctx.fillStyle = '#e8e6df';
    ctx.font = '12px monospace';
    ctx.textBaseline = 'middle';

    for (const e of state.entities) {
      if (e.kind === 'gull') {
        ctx.fillText('^', e.x, e.y);
      } else if (e.kind === 'drift') {
        ctx.fillText('—', e.x, e.y);
      } else {
        const sign = e.facing;
        ctx.beginPath();
        ctx.moveTo(e.x - 6 * sign, e.y);
        ctx.lineTo(e.x + 6 * sign, e.y);
        ctx.lineTo(e.x + 2 * sign, e.y - 5);
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(e.x - 1, e.y - 9, 2, 4);
      }
      e.x += e.vx;
    }

    state.entities = state.entities.filter((e) =>
      e.x > -30 && e.x < width + 30 && e.y > -20 && e.y < height + 20,
    );

    if (Math.random() < 0.02 && state.entities.length < 14) {
      state.entities.push(spawnEntity(width, height));
    }
  },
};
