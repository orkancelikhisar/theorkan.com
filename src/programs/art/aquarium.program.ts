import './aquarium.css';
import type { Program } from '../../kernel/program';
import { SCENES, DEFAULT_SCENE, type Scene, type SceneContext } from './aquarium-scenes';

const WIDTH = 480;
const HEIGHT = 200;

interface Active {
  panelId: string;
  canvas: HTMLCanvasElement;
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

function openScene(
  panelSpawn: (opts: { title: string; contentEl: HTMLElement; position: 'bottom-left'; width: number; height: number; onClose: () => void }) => string,
  panelClose: (id: string) => void,
  panelFocus: (id: string) => void,
  sceneKey: string,
): { result: string; ok: boolean } {
  const scene = SCENES[sceneKey];
  if (!scene) {
    const list = Object.keys(SCENES).join(', ');
    return { result: `aquarium: unknown scene "${sceneKey}". try: ${list}`, ok: false };
  }
  if (active) {
    // Switch scene without re-opening the panel
    active.scene = scene;
    active.sceneState = scene.init(active.sceneCtx);
    panelFocus(active.panelId);
    return { result: `aquarium: switched to ${scene.name} — ${scene.description}.`, ok: true };
  }
  const canvas = document.createElement('canvas');
  canvas.className = 'aquarium-canvas';
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const cctx = canvas.getContext('2d');
  if (!cctx) return { result: 'aquarium: canvas not supported.', ok: false };

  const sceneCtx: SceneContext = { ctx: cctx, width: WIDTH, height: HEIGHT };
  const sceneState = scene.init(sceneCtx);

  const panelId = panelSpawn({
    title: `aquarium — ${scene.name}`,
    contentEl: canvas,
    position: 'bottom-left',
    width: WIDTH + 22,
    height: HEIGHT + 56,
    onClose: () => { close(); },
  });

  active = {
    panelId, canvas, scene, sceneState, sceneCtx,
    rafId: 0, lastFrameMs: performance.now(),
  };
  active.rafId = requestAnimationFrame(tick);
  void panelClose;  // not used here
  return { result: `aquarium: opened ${scene.name} — ${scene.description}. \`aquarium off\` to close.`, ok: true };
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
    const { result } = openScene(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (opts) => ctx.panel.spawn(opts as any),
      (id) => ctx.panel.close(id),
      (id) => ctx.panel.focus(id),
      sceneKey,
    );
    return result;
  },
};

export default prog;
