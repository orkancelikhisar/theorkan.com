import './aquarium.css';
import type { Program } from '../../kernel/program';

interface Entity {
  kind: 'boat' | 'gull' | 'drift';
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
}

const WIDTH = 480;
const HEIGHT = 160;

interface Active {
  panelId: string;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  entities: Entity[];
  rafId: number;
}

let active: Active | null = null;

function spawnEntity(): Entity {
  const r = Math.random();
  if (r < 0.5) {
    const facing: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    return {
      kind: 'boat',
      x: facing === 1 ? -20 : WIDTH + 20,
      y: HEIGHT * 0.55 + Math.random() * 20,
      vx: facing * (0.15 + Math.random() * 0.2),
      vy: 0,
      facing,
    };
  } else if (r < 0.85) {
    const facing: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    return {
      kind: 'gull',
      x: facing === 1 ? -10 : WIDTH + 10,
      y: 10 + Math.random() * 50,
      vx: facing * (0.4 + Math.random() * 0.3),
      vy: 0,
      facing,
    };
  } else {
    return {
      kind: 'drift',
      x: -10,
      y: HEIGHT * 0.65 + Math.random() * 30,
      vx: 0.06 + Math.random() * 0.08,
      vy: 0,
      facing: 1,
    };
  }
}

function frame(): void {
  if (!active) return;
  const { ctx, entities } = active;

  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // sea line texture
  ctx.fillStyle = '#3a3935';
  for (let x = 0; x < WIDTH; x += 6) {
    const y = HEIGHT * 0.6 + Math.sin((x + Date.now() * 0.001) * 0.05) * 2;
    ctx.fillRect(x, y, 2, 1);
  }

  ctx.fillStyle = '#e8e6df';
  ctx.font = '12px monospace';
  ctx.textBaseline = 'middle';

  for (const e of entities) {
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
    e.y += e.vy;
  }

  active.entities = entities.filter((e) =>
    e.x > -30 && e.x < WIDTH + 30 && e.y > -20 && e.y < HEIGHT + 20,
  );

  if (Math.random() < 0.02 && active.entities.length < 14) {
    active.entities.push(spawnEntity());
  }

  active.rafId = requestAnimationFrame(frame);
}

function close(): void {
  if (!active) return;
  cancelAnimationFrame(active.rafId);
  active = null;
}

const prog: Program = {
  name: 'aquarium',
  manpage: 'aquarium — boats, gulls, driftwood. drifts in a panel. `aquarium off` to close.',
  category: 'art',
  mode: 'inline',
  onCommand: (ctx, argv) => {
    if (argv[1] === 'off') {
      if (!active) return 'aquarium: nothing open.';
      ctx.panel.close(active.panelId);
      close();
      return 'aquarium: closed.';
    }
    if (active) {
      ctx.panel.focus(active.panelId);
      return 'aquarium: already open.';
    }
    const canvas = document.createElement('canvas');
    canvas.className = 'aquarium-canvas';
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const cctx = canvas.getContext('2d');
    if (!cctx) return 'aquarium: canvas not supported.';

    const panelId = ctx.panel.spawn({
      title: 'aquarium',
      contentEl: canvas,
      position: 'bottom-left',
      width: WIDTH + 22,
      height: HEIGHT + 50,
      onClose: () => close(),
    });

    active = { panelId, canvas, ctx: cctx, entities: [], rafId: 0 };
    for (let i = 0; i < 6; i++) active.entities.push(spawnEntity());
    active.rafId = requestAnimationFrame(frame);

    return 'aquarium: opened. `aquarium off` to close.';
  },
};

export default prog;
