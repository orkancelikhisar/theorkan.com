import './void.css';
import type { EventBus } from '../kernel/events';
import type { AudioAPI } from '../audio/audio';

export interface VoidAPI {
  shine(intensity?: number): void;
  crackle(): void;
  whisper(word: string): void;
  drift(): void;
  themed(name: string, opts?: Record<string, unknown>): void;
  mount(container: HTMLElement): void;
}

export function createVoid(events: EventBus, audio: AudioAPI): VoidAPI {
  const layer = document.createElement('div');
  layer.className = 'void';

  const shineEl = document.createElement('div');
  shineEl.className = 'void__shine';
  layer.appendChild(shineEl);

  const crackleEl = document.createElement('div');
  crackleEl.className = 'void__crackle';
  layer.appendChild(crackleEl);

  let driftParticles: HTMLElement[] = [];

  function clearDrift(): void {
    for (const p of driftParticles) p.remove();
    driftParticles = [];
  }

  function spawnDrift(): void {
    const p = document.createElement('div');
    p.className = 'void__particle';
    p.style.left = `${Math.random() < 0.5 ? 5 : 95}%`;
    p.style.top = `${10 + Math.random() * 80}%`;
    layer.appendChild(p);
    driftParticles.push(p);

    let x = parseFloat(p.style.left);
    let y = parseFloat(p.style.top);
    const dx = (Math.random() - 0.5) * 0.1;
    const dy = (Math.random() - 0.5) * 0.1;
    let frames = 0;
    const id = window.setInterval(() => {
      x += dx; y += dy;
      p.style.left = `${x}%`;
      p.style.top = `${y}%`;
      frames += 1;
      if (frames > 200 || x < 0 || x > 100 || y < 0 || y > 100) {
        window.clearInterval(id);
        p.remove();
        driftParticles = driftParticles.filter((q) => q !== p);
      }
    }, 80);
  }

  events.on('shell:idle', (payload: unknown) => {
    const ms = (payload as { ms: number }).ms;
    if (ms >= 30_000 && driftParticles.length < 3) {
      while (driftParticles.length < 3) spawnDrift();
    } else if (ms >= 15_000 && driftParticles.length < 1) {
      spawnDrift();
    }
  });
  events.on('shell:active', () => clearDrift());

  return {
    mount(container) { container.appendChild(layer); },
    shine(_intensity) {
      shineEl.classList.add('active');
      audio.play('void.shine', 'void');
      window.setTimeout(() => shineEl.classList.remove('active'), 280);
    },
    crackle() {
      crackleEl.classList.add('active');
      audio.play('void.crackle', 'void');
      window.setTimeout(() => crackleEl.classList.remove('active'), 100);
    },
    whisper(word) {
      const el = document.createElement('div');
      el.className = 'void__whisper';
      el.textContent = word;
      const sides = ['left', 'right', 'top', 'bottom'];
      const side = sides[Math.floor(Math.random() * sides.length)];
      const pos = 20 + Math.random() * 60;
      switch (side) {
        case 'left':   el.style.left = '2%';   el.style.top = `${pos}%`; break;
        case 'right':  el.style.right = '2%';  el.style.top = `${pos}%`; break;
        case 'top':    el.style.top = '4%';    el.style.left = `${pos}%`; break;
        case 'bottom': el.style.bottom = '4%'; el.style.left = `${pos}%`; break;
      }
      layer.appendChild(el);
      requestAnimationFrame(() => el.classList.add('active'));
      window.setTimeout(() => {
        el.classList.remove('active');
        window.setTimeout(() => el.remove(), 3500);
      }, 5000);
    },
    drift() { spawnDrift(); },
    themed(_name, _opts) { /* hook for v0.2+ */ },
  };
}
