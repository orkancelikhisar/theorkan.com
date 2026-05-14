import type { PanelManager } from '../kernel/panels';

const PANEL_WIDTH = 160;
const PANEL_HEIGHT = 120;
const INTERNAL_W = 64;
const INTERNAL_H = 48;
const QUANT_STEPS = 5;
const IDLE_MS = 90_000;

interface CameraSession {
  panelId: string;
  stream: MediaStream;
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  rafId: number;
  idleTimer: number;
}

let active: CameraSession | null = null;

export function quantizeLuminance(lum: number, steps: number): number {
  const clamped = Math.max(0, Math.min(255, lum));
  return Math.min(steps - 1, Math.floor((clamped / 256) * steps));
}

export async function requestEyesCamera(panel: PanelManager): Promise<'granted' | 'denied' | 'unsupported'> {
  if (active) {
    panel.focus(active.panelId);
    return 'granted';
  }
  if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  } catch {
    return 'denied';
  }

  const canvas = document.createElement('canvas');
  canvas.width = INTERNAL_W;
  canvas.height = INTERNAL_H;
  canvas.style.width = `${PANEL_WIDTH}px`;
  canvas.style.height = `${PANEL_HEIGHT}px`;
  (canvas.style as CSSStyleDeclaration & { imageRendering: string }).imageRendering = 'pixelated';

  const video = document.createElement('video');
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play().catch(() => {});

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    stream.getTracks().forEach((t) => t.stop());
    return 'unsupported';
  }

  const panelId = panel.spawn({
    title: 'eyes — local only',
    contentEl: canvas,
    position: 'right',
    width: PANEL_WIDTH + 24,
    height: PANEL_HEIGHT + 48,
    onClose: () => { stopActive(); },
  });

  let lastActivity = Date.now();
  function onActivity(): void { lastActivity = Date.now(); }
  window.addEventListener('keydown', onActivity);
  window.addEventListener('mousemove', onActivity);

  function frame(): void {
    if (!active) return;
    ctx!.drawImage(video, 0, 0, INTERNAL_W, INTERNAL_H);
    const img = ctx!.getImageData(0, 0, INTERNAL_W, INTERNAL_H);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const step = quantizeLuminance(lum, QUANT_STEPS);
      const v = Math.floor((step / (QUANT_STEPS - 1)) * 232);
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx!.putImageData(img, 0, 0);
    active.rafId = requestAnimationFrame(frame);
  }

  function checkIdle(): void {
    if (!active) return;
    if (Date.now() - lastActivity > IDLE_MS) {
      stopActive();
    }
  }

  const idleTimer = window.setInterval(checkIdle, 5000);

  active = { panelId, stream, video, canvas, rafId: 0, idleTimer };
  active.rafId = requestAnimationFrame(frame);

  return 'granted';
}

export function stopActive(): void {
  if (!active) return;
  cancelAnimationFrame(active.rafId);
  window.clearInterval(active.idleTimer);
  active.stream.getTracks().forEach((t) => t.stop());
  active.video.srcObject = null;
  active = null;
}

export function isEyesActive(): boolean { return active !== null; }
export function closeEyes(): void { stopActive(); }
