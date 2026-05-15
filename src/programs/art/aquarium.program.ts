import './aquarium.css';
import type { Program } from '../../kernel/program';
import { SCENES, DEFAULT_SCENE, type Scene, type SceneContext } from './aquarium-scenes';

const WIDTH = 300;
const HEIGHT = 130;

interface Active {
  panelId: string;
  canvas: HTMLCanvasElement;
  wrapper: HTMLElement;
  buttons: Map<string, HTMLButtonElement>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  scene: Scene<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sceneState: any;
  sceneCtx: SceneContext;
  rafId: number;
  lastFrameMs: number;
}

let active: Active | null = null;

function tick(now: number): void {
  if (!active) return;
  const dt = Math.min(50, now - active.lastFrameMs);
  active.lastFrameMs = now;
  active.scene.frame(active.sceneState, active.sceneCtx, dt);
  active.rafId = requestAnimationFrame(tick);
}

function close(): void {
  if (!active) return;
  cancelAnimationFrame(active.rafId);
  active = null;
}

function switchScene(key: string): void {
  if (!active) return;
  const next = SCENES[key];
  if (!next) return;
  active.scene = next;
  active.sceneState = next.init(active.sceneCtx);
  for (const [k, btn] of active.buttons) {
    btn.classList.toggle('aquarium-btn--active', k === key);
  }
}

function buildWrapper(initialScene: string): {
  wrapper: HTMLElement; canvas: HTMLCanvasElement; buttons: Map<string, HTMLButtonElement>;
} {
  const wrapper = document.createElement('div');
  wrapper.className = 'aquarium-wrapper';

  const controls = document.createElement('div');
  controls.className = 'aquarium-controls';
  const buttons = new Map<string, HTMLButtonElement>();
  for (const [key, scene] of Object.entries(SCENES)) {
    const btn = document.createElement('button');
    btn.className = 'aquarium-btn' + (key === initialScene ? ' aquarium-btn--active' : '');
    btn.textContent = scene.name;
    btn.title = scene.description;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      switchScene(key);
    });
    buttons.set(key, btn);
    controls.appendChild(btn);
  }
  wrapper.appendChild(controls);

  const canvas = document.createElement('canvas');
  canvas.className = 'aquarium-canvas';
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  wrapper.appendChild(canvas);

  return { wrapper, canvas, buttons };
}

const prog: Program = {
  name: 'aquarium',
  manpage: 'aquarium [scene|list|off] — animated scenes in a panel. drifts. monochrome.',
  category: 'art',
  mode: 'inline',
  onCommand: (ctx, argv) => {
    const sub = argv[1];

    if (sub === 'off') {
      if (!active) return 'aquarium: nothing open.';
      ctx.panel.close(active.panelId);
      close();
      return 'aquarium: closed.';
    }

    if (sub === 'list') {
      const lines = ['', 'aquarium scenes:', ''];
      for (const [key, scene] of Object.entries(SCENES)) {
        lines.push(`  ${key.padEnd(12)} ${scene.description}`);
      }
      lines.push('', `usage: aquarium [${Object.keys(SCENES).join('|')}]`, '');
      return lines.join('\n');
    }

    const sceneKey = sub ?? DEFAULT_SCENE;
    const scene = SCENES[sceneKey];
    if (!scene) {
      const list = Object.keys(SCENES).join(', ');
      return `aquarium: unknown scene "${sceneKey}". try: ${list}`;
    }

    if (active) {
      switchScene(sceneKey);
      ctx.panel.focus(active.panelId);
      return `aquarium: switched to ${scene.name}.`;
    }

    const { wrapper, canvas, buttons } = buildWrapper(sceneKey);
    const cctx = canvas.getContext('2d');
    if (!cctx) return 'aquarium: canvas not supported.';

    const sceneCtx: SceneContext = { ctx: cctx, width: WIDTH, height: HEIGHT };
    const sceneState = scene.init(sceneCtx);

    const panelId = ctx.panel.spawn({
      title: 'aquarium',
      contentEl: wrapper,
      position: 'top-right',
      width: WIDTH + 22,
      height: HEIGHT + 80,
      onClose: () => { close(); },
    });

    active = {
      panelId, canvas, wrapper, buttons,
      scene, sceneState, sceneCtx,
      rafId: 0, lastFrameMs: performance.now(),
    };
    active.rafId = requestAnimationFrame(tick);

    return `aquarium: opened ${scene.name}. \`aquarium off\` to close.`;
  },
};

export default prog;
