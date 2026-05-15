import {
  deg2rad, signedAngleDeg, headingOf, apparentWind, vec, magnitude,
} from './physics';
import type { RegattaState } from './state';

const VIEW_W = 800;
const VIEW_H = 480;
const PX_PER_M = 2.2;
const KT_TO_MS = 0.5144;

// Water grid: a brick-pattern of `~` characters that scrolls 1:1 with the
// boat's world position. The boat stays centered; the water moves underneath.
const TILE_W = 36;
const TILE_H = 24;

export class RegattaRenderer {
  ctx: CanvasRenderingContext2D;

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

  draw(state: RegattaState, _dtMs: number): void {
    const c = this.ctx;

    // 1. Black background.
    c.fillStyle = '#0a0a0a';
    c.fillRect(0, 0, VIEW_W, VIEW_H);

    // 2. Water grid — brick-laid `~` tiles, scrolling 1:1 with boat position.
    //    Boat moves +y (north) → tiles move down on screen (water flows aft).
    //    Boat moves +x (east) → tiles move left on screen.
    const sx = ((-state.position.x * PX_PER_M) % TILE_W + TILE_W) % TILE_W;
    const sy = (( state.position.y * PX_PER_M) % TILE_H + TILE_H) % TILE_H;
    c.font = '14px monospace';
    c.textBaseline = 'middle';
    c.textAlign = 'center';
    c.fillStyle = '#6a6860';
    for (let yi = -1; yi <= VIEW_H / TILE_H + 1; yi++) {
      const rowOffset = (((yi % 2) + 2) % 2) === 0 ? 0 : TILE_W / 2;
      for (let xi = -1; xi <= VIEW_W / TILE_W + 1; xi++) {
        const px = xi * TILE_W + rowOffset + sx;
        const py = yi * TILE_H + sy;
        c.fillText('~', px, py);
      }
    }

    // 3. Buoys.
    c.fillStyle = '#e8e6df';
    c.font = '18px monospace';
    state.buoys.forEach((b, i) => {
      const [bx, by] = this.worldToScreen(state, b.pos.x, b.pos.y);
      if (b.rounded) c.globalAlpha = 0.4;
      c.fillText('◇', bx, by);
      if (i === state.nextBuoy && !b.rounded) {
        c.font = '11px monospace';
        c.fillText(
          `next ${Math.round(Math.hypot(b.pos.x - state.position.x, b.pos.y - state.position.y))}m`,
          bx, by + 20,
        );
        c.font = '18px monospace';
      }
      c.globalAlpha = 1;
    });

    // 4. Boat — hollow triangle hull + boom inside, centered on the canvas.
    c.save();
    c.translate(VIEW_W / 2, VIEW_H / 2);
    c.rotate(deg2rad(state.heading) + deg2rad(state.heel) * 0.05);
    c.strokeStyle = '#e8e6df';
    c.fillStyle = '#e8e6df';
    c.lineWidth = 1.5;

    // hollow triangle (bow at -y in local space)
    c.beginPath();
    c.moveTo(0, -12);
    c.lineTo(6, 7);
    c.lineTo(-6, 7);
    c.closePath();
    c.stroke();

    // boom rotating around the centroid with the actual sail angle
    const a = deg2rad(state.sailAngleDeg);
    const boomLen = 11;
    const boomEndX = Math.sin(a) * boomLen;
    const boomEndY = Math.cos(a) * boomLen;
    c.beginPath();
    c.moveTo(0, 1);
    if (state.luffing) {
      const j = (Math.random() - 0.5) * 1.4;
      c.lineTo(boomEndX + j, boomEndY + j);
    } else {
      c.lineTo(boomEndX, boomEndY);
    }
    c.stroke();

    // mainsheet limit indicator — faint ticks where the rope clamps the sail
    c.globalAlpha = 0.35;
    const aMax = deg2rad(state.sailMaxDeg);
    for (const sign of [-1, 1]) {
      const lx = Math.sin(aMax * sign) * 14;
      const ly = Math.cos(aMax * sign) * 14;
      c.beginPath();
      c.moveTo(lx, ly);
      c.lineTo(lx * 1.18, ly * 1.18);
      c.stroke();
    }
    c.globalAlpha = 1;
    c.restore();

    // 5. HUD.
    c.fillStyle = '#e8e6df';
    c.font = '12px monospace';
    c.textAlign = 'left'; c.textBaseline = 'top';
    const speedKt = magnitude(state.velocity) / KT_TO_MS;
    const trueVec = vec(state.trueWindDeg, state.trueWindKt * KT_TO_MS);
    const ap = apparentWind(trueVec, state.velocity);
    const apSigned = signedAngleDeg(headingOf(ap) - state.heading);
    const apAbs = Math.abs(apSigned);
    const sailLabel = state.luffing ? 'LUFF' : 'POWERED';
    const pointName =
      apAbs < 30 ? 'in irons' :
      apAbs < 50 ? 'close hauled' :
      apAbs < 80 ? 'close reach' :
      apAbs < 110 ? 'beam reach' :
      apAbs < 150 ? 'broad reach' : 'running';
    const lines = [
      `WIND ${formatDeg(state.trueWindDeg)} ${state.trueWindKt.toFixed(1)}kt   APPARENT ${formatDeg(((headingOf(ap) % 360) + 360) % 360)}   ${pointName}`,
      ``,
      `HDG ${formatDeg(state.heading)}   SPD ${speedKt.toFixed(1)}kt   SAIL ${Math.round(state.sailAngleDeg)}°  SHEET max ${Math.round(state.sailMaxDeg)}° (${sailLabel})   ELAPSED ${formatTime(state.elapsedMs)}`,
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
