import { deg2rad, signedAngleDeg, headingOf, apparentWind, vec } from './physics';
import type { RegattaState } from './state';

const VIEW_W = 800;
const VIEW_H = 480;
const PX_PER_M = 2.2;

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  age: number; life: number;
  kind: 'wake' | 'bow' | 'spray' | 'ripple';
}

export class RegattaRenderer {
  ctx: CanvasRenderingContext2D;
  particles: Particle[] = [];
  scrollOffsetMs = 0;

  constructor(public canvas: HTMLCanvasElement) {
    canvas.width = VIEW_W;
    canvas.height = VIEW_H;
    const c = canvas.getContext('2d');
    if (!c) throw new Error('no canvas context');
    this.ctx = c;
  }

  worldToScreen(state: RegattaState, wx: number, wy: number): [number, number] {
    const cx = VIEW_W / 2;
    const cy = VIEW_H / 2;
    const dx = wx - state.position.x;
    const dy = wy - state.position.y;
    return [cx + dx * PX_PER_M, cy - dy * PX_PER_M];
  }

  draw(state: RegattaState, dtMs: number): void {
    const c = this.ctx;
    c.fillStyle = '#0a0a0a';
    c.fillRect(0, 0, VIEW_W, VIEW_H);

    // --- sea texture (scrolling) ---
    this.scrollOffsetMs += dtMs;
    c.fillStyle = '#3a3935';
    const sx = (-state.position.x * PX_PER_M * 0.3 + this.scrollOffsetMs * 0.0001 * state.trueWindKt) % 18;
    const sy = (state.position.y * PX_PER_M * 0.3) % 18;
    for (let yi = -1; yi < VIEW_H / 18 + 2; yi++) {
      for (let xi = -1; xi < VIEW_W / 18 + 2; xi++) {
        const px = xi * 18 + sx;
        const py = yi * 18 + sy;
        if (Math.random() < 0.97) c.fillRect(px, py, 1, 1);
        if ((xi + yi) % 2 === 0) c.fillRect(px + 9, py + 9, 1, 1);
      }
    }

    // --- wind ripples ---
    if (Math.random() < 0.05) {
      this.particles.push({
        x: Math.random() * VIEW_W,
        y: Math.random() * VIEW_H,
        vx: Math.sin(deg2rad(state.trueWindDeg + 90)) * 0.5,
        vy: -Math.cos(deg2rad(state.trueWindDeg + 90)) * 0.5,
        age: 0, life: 3500, kind: 'ripple',
      });
    }

    // --- buoys ---
    c.fillStyle = '#e8e6df';
    c.font = '14px monospace';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    state.buoys.forEach((b, i) => {
      const [bx, by] = this.worldToScreen(state, b.pos.x, b.pos.y);
      if (b.rounded) c.globalAlpha = 0.4;
      c.fillText('◇', bx, by);
      if (i === state.nextBuoy && !b.rounded) {
        c.font = '10px monospace';
        c.fillText(
          `next ${Math.round(Math.hypot(b.pos.x - state.position.x, b.pos.y - state.position.y))}m`,
          bx, by + 16,
        );
        c.font = '14px monospace';
      }
      c.globalAlpha = 1;
    });

    // --- update + draw particles ---
    for (const p of this.particles) {
      p.age += dtMs;
      p.x += p.vx;
      p.y += p.vy;
      const a = 1 - p.age / p.life;
      if (a <= 0) continue;
      c.globalAlpha = a * (p.kind === 'ripple' ? 0.3 : 0.7);
      c.fillRect(p.x, p.y, p.kind === 'bow' ? 2 : 1, 1);
    }
    c.globalAlpha = 1;
    this.particles = this.particles.filter((p) => p.age < p.life);

    // --- spawn wake (behind boat) ---
    if (state.speedKt > 0.5) {
      const sternX = VIEW_W / 2 - Math.sin(deg2rad(state.heading)) * 6;
      const sternY = VIEW_H / 2 + Math.cos(deg2rad(state.heading)) * 6;
      this.particles.push({ x: sternX, y: sternY, vx: 0, vy: 0, age: 0, life: 2000, kind: 'wake' });
    }

    // --- spawn bow wave ---
    if (state.speedKt > 1.5) {
      const sp = Math.min(5, Math.floor(state.speedKt));
      for (let i = 0; i < sp; i++) {
        const bowX = VIEW_W / 2 + Math.sin(deg2rad(state.heading)) * 6;
        const bowY = VIEW_H / 2 - Math.cos(deg2rad(state.heading)) * 6;
        const spread = (Math.random() - 0.5) * 1.2;
        this.particles.push({
          x: bowX, y: bowY,
          vx: Math.sin(deg2rad(state.heading + 90 * (spread > 0 ? 1 : -1))) * (0.4 + Math.random() * 0.6),
          vy: -Math.cos(deg2rad(state.heading + 90 * (spread > 0 ? 1 : -1))) * (0.4 + Math.random() * 0.6),
          age: 0, life: 1200, kind: 'bow',
        });
      }
    }

    // --- spawn heel spray ---
    if (Math.abs(state.heel) > 7) {
      this.particles.push({
        x: VIEW_W / 2 + Math.sin(deg2rad(state.heading)) * 5,
        y: VIEW_H / 2 - Math.cos(deg2rad(state.heading)) * 5,
        vx: Math.sin(deg2rad(state.heading + 90 * Math.sign(state.heel))) * 1.4,
        vy: -Math.cos(deg2rad(state.heading + 90 * Math.sign(state.heel))) * 1.4 + 0.5,
        age: 0, life: 600, kind: 'spray',
      });
    }

    // --- boat: hollow triangle + boom inside ---
    c.save();
    c.translate(VIEW_W / 2, VIEW_H / 2);
    c.rotate(deg2rad(state.heading) + deg2rad(state.heel) * 0.05);
    c.strokeStyle = '#e8e6df';
    c.fillStyle = '#e8e6df';
    c.lineWidth = 1.5;

    // hollow triangle (bow at -y in local space)
    c.beginPath();
    c.moveTo(0, -10);
    c.lineTo(5, 6);
    c.lineTo(-5, 6);
    c.closePath();
    c.stroke();

    // boom: from centroid (0,1) at length 9, angle = (180 - sailAngleDeg) * leewardSign
    const trueVec = vec(state.trueWindDeg, state.trueWindKt * 0.514);
    const velVec = vec(state.heading, state.speedKt * 0.514);
    const ap = apparentWind(trueVec, velVec);
    const apSigned = signedAngleDeg(headingOf(ap) - state.heading);
    const leewardSign = apSigned >= 0 ? 1 : -1;
    const sailRad = deg2rad((180 - state.sailAngleDeg) * leewardSign);
    const boomEndX = Math.sin(sailRad) * 9;
    const boomEndY = -Math.cos(sailRad) * 9;
    c.beginPath();
    c.moveTo(0, 1);
    if (state.luffing) {
      const j = (Math.random() - 0.5) * 1.4;
      c.lineTo(boomEndX + j, boomEndY + j);
    } else {
      c.lineTo(boomEndX, boomEndY);
    }
    c.stroke();
    c.restore();

    // --- HUD ---
    c.fillStyle = '#e8e6df';
    c.font = '12px monospace';
    c.textAlign = 'left'; c.textBaseline = 'top';
    const apAbs = Math.abs(apSigned);
    const sailLabel = state.luffing ? 'LUFF' : 'TRIMMED';
    const pointName =
      apAbs < 30 ? 'in irons' :
      apAbs < 50 ? 'close hauled' :
      apAbs < 80 ? 'close reach' :
      apAbs < 110 ? 'beam reach' :
      apAbs < 150 ? 'broad reach' : 'running';
    const lines = [
      `WIND ${formatDeg(state.trueWindDeg)} ${state.trueWindKt.toFixed(1)}kt   APPARENT ${formatDeg(((headingOf(ap) % 360) + 360) % 360)}   ${pointName}`,
      ``,
      `HDG ${formatDeg(state.heading)}   SPD ${state.speedKt.toFixed(1)}kt   SAIL ${Math.round(state.sailAngleDeg)}° ${sailLabel}   ELAPSED ${formatTime(state.elapsedMs)}`,
    ];
    if (state.coach) lines.push('', `  ${state.coach}`);
    if (state.finished) {
      lines.push('', `FINISHED. ${formatTime(state.elapsedMs)}. press q to leave.`);
      const best = parseInt(localStorage.getItem('theorkan.regatta.best') || '0', 10);
      if (best) lines.push(`best: ${formatTime(best)}`);
    }
    lines.forEach((l, i) => c.fillText(l, 14, 14 + i * 16));
  }
}

function formatDeg(d: number): string {
  return `${String(Math.round(d)).padStart(3, '0')}°`;
}
function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}
