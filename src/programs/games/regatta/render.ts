import {
  deg2rad, signedAngleDeg, headingOf, apparentWind, vec, magnitude,
} from './physics';
import type { RegattaState } from './state';

const VIEW_W = 800;
const VIEW_H = 480;
const PX_PER_M = 4;
const KT_TO_MS = 0.5144;

// Water grid anchored to world coordinates. The camera has a dead-zone so the
// boat visibly moves within the centre of the canvas; only when it pushes the
// boundary does the camera track to keep the boat in view.
const TILE_W_WORLD = 9;
const TILE_H_WORLD = 6;

const DEAD_X_M = VIEW_W / (2 * PX_PER_M) * 0.5;   // 50 m
const DEAD_Y_M = VIEW_H / (2 * PX_PER_M) * 0.5;   // 30 m

// Once the boat is sufficiently far from the course (origin), we smoothly
// "engulf" it in a circular halo of water and let it roam freely around the
// canvas, wrapping at the edges Pac-Man style. The main grid fades out as
// roam factor goes to 1.
const ROAM_START_M = 100;
const ROAM_FULL_M = 140;
const HALO_RADIUS_PX = 110;
const HALO_FEATHER_PX = 28;

export class RegattaRenderer {
  ctx: CanvasRenderingContext2D;
  cameraX = 0;
  cameraY = 0;
  // Roam-mode state: independent canvas position for the boat that wraps.
  roamX = VIEW_W / 2;
  roamY = VIEW_H / 2;
  roamInitialised = false;
  lastFrameMs = 0;

  constructor(public canvas: HTMLCanvasElement) {
    canvas.width = VIEW_W;
    canvas.height = VIEW_H;
    const c = canvas.getContext('2d');
    if (!c) throw new Error('no canvas context');
    this.ctx = c;
  }

  worldToScreen(wx: number, wy: number): [number, number] {
    return [
      VIEW_W / 2 + (wx - this.cameraX) * PX_PER_M,
      VIEW_H / 2 - (wy - this.cameraY) * PX_PER_M,
    ];
  }

  updateCamera(state: RegattaState): void {
    const dx = state.position.x - this.cameraX;
    const dy = state.position.y - this.cameraY;
    if (dx >  DEAD_X_M) this.cameraX = state.position.x - DEAD_X_M;
    if (dx < -DEAD_X_M) this.cameraX = state.position.x + DEAD_X_M;
    if (dy >  DEAD_Y_M) this.cameraY = state.position.y - DEAD_Y_M;
    if (dy < -DEAD_Y_M) this.cameraY = state.position.y + DEAD_Y_M;
  }

  draw(state: RegattaState, dtMs: number): void {
    this.updateCamera(state);
    const c = this.ctx;

    // Compute roam factor smoothly from distance to origin.
    const dist = Math.hypot(state.position.x, state.position.y);
    const roam = Math.max(0, Math.min(1,
      (dist - ROAM_START_M) / (ROAM_FULL_M - ROAM_START_M),
    ));

    // In roam mode the boat's canvas position is independent of world coords
    // and wraps at canvas edges. The transition is smooth: we seed roamX/Y
    // from the boat's current screen position the first frame roam begins,
    // then move it by the boat's velocity each frame.
    if (roam > 0) {
      if (!this.roamInitialised) {
        const [seedX, seedY] = this.worldToScreen(state.position.x, state.position.y);
        this.roamX = seedX;
        this.roamY = seedY;
        this.roamInitialised = true;
      }
      this.roamX += state.velocity.x * (dtMs / 1000) * PX_PER_M;
      this.roamY -= state.velocity.y * (dtMs / 1000) * PX_PER_M;
      // Wrap.
      this.roamX = ((this.roamX % VIEW_W) + VIEW_W) % VIEW_W;
      this.roamY = ((this.roamY % VIEW_H) + VIEW_H) % VIEW_H;
    } else {
      this.roamInitialised = false;
    }

    // Boat draw position: blend between course-mode (projected) and roam.
    const [courseBoatX, courseBoatY] = this.worldToScreen(state.position.x, state.position.y);
    const boatX = courseBoatX * (1 - roam) + this.roamX * roam;
    const boatY = courseBoatY * (1 - roam) + this.roamY * roam;

    // 1. Black background.
    c.fillStyle = '#0a0a0a';
    c.fillRect(0, 0, VIEW_W, VIEW_H);

    // 2. Main water grid — fades out as roam → 1.
    if (roam < 1) {
      c.globalAlpha = 1 - roam;
      const halfWmeters = VIEW_W / (2 * PX_PER_M);
      const halfHmeters = VIEW_H / (2 * PX_PER_M);
      const iMin = Math.floor((this.cameraX - halfWmeters) / TILE_W_WORLD) - 1;
      const iMax = Math.ceil( (this.cameraX + halfWmeters) / TILE_W_WORLD) + 1;
      const jMin = Math.floor((this.cameraY - halfHmeters) / TILE_H_WORLD) - 1;
      const jMax = Math.ceil( (this.cameraY + halfHmeters) / TILE_H_WORLD) + 1;
      c.font = '14px monospace';
      c.textBaseline = 'middle';
      c.textAlign = 'center';
      c.fillStyle = '#6a6860';
      for (let j = jMin; j <= jMax; j++) {
        const oddRow = (((j % 2) + 2) % 2) === 1;
        const xOffset = oddRow ? TILE_W_WORLD / 2 : 0;
        for (let i = iMin; i <= iMax; i++) {
          const wx = i * TILE_W_WORLD + xOffset;
          const wy = j * TILE_H_WORLD;
          const [sx, sy] = this.worldToScreen(wx, wy);
          c.fillText('~', sx, sy);
        }
      }
      c.globalAlpha = 1;
    }

    // 3. Roam halo — circular patch of water around the boat that fades in
    //    as roam → 1. Also drawn at all 4 wrap positions so the halo wraps
    //    cleanly across canvas edges.
    if (roam > 0) {
      c.font = '14px monospace';
      c.textBaseline = 'middle';
      c.textAlign = 'center';
      const r = HALO_RADIUS_PX;
      const r2 = r * r;
      for (const [ox, oy] of wrapOffsets(this.roamX, this.roamY)) {
        const haloCenterX = this.roamX + ox;
        const haloCenterY = this.roamY + oy;
        // Iterate world tiles around the halo area, but draw each only if
        // within the circular radius (with a soft fade at the boundary).
        const tilesAcross = Math.ceil(r / (TILE_W_WORLD * PX_PER_M)) + 1;
        const tilesDown = Math.ceil(r / (TILE_H_WORLD * PX_PER_M)) + 1;
        for (let dj = -tilesDown; dj <= tilesDown; dj++) {
          const j = Math.floor(this.cameraY / TILE_H_WORLD) + dj;
          const oddRow = (((j % 2) + 2) % 2) === 1;
          const xOffset = oddRow ? TILE_W_WORLD / 2 : 0;
          for (let di = -tilesAcross; di <= tilesAcross; di++) {
            // Tile position relative to halo center on canvas
            const px = haloCenterX + di * TILE_W_WORLD * PX_PER_M + xOffset * PX_PER_M;
            const py = haloCenterY - dj * TILE_H_WORLD * PX_PER_M;
            const ddx = px - haloCenterX;
            const ddy = py - haloCenterY;
            const d2 = ddx * ddx + ddy * ddy;
            if (d2 > r2) continue;
            const d = Math.sqrt(d2);
            const a = roam * Math.max(0, Math.min(1, (r - d) / HALO_FEATHER_PX));
            if (a <= 0.02) continue;
            c.globalAlpha = a;
            c.fillStyle = '#6a6860';
            c.fillText('~', px, py);
          }
        }
      }
      c.globalAlpha = 1;
    }

    // 4. Buoys (drawn at world-projected positions; if the boat has roamed
    //    far away the buoys will be off-screen — that's fine, the HUD shows
    //    the distance to the next one).
    c.fillStyle = '#e8e6df';
    c.font = '18px monospace';
    c.textBaseline = 'middle';
    c.textAlign = 'center';
    state.buoys.forEach((b, i) => {
      const [bx, by] = this.worldToScreen(b.pos.x, b.pos.y);
      if (b.rounded) c.globalAlpha = 0.4;
      if (bx >= -10 && bx <= VIEW_W + 10 && by >= -10 && by <= VIEW_H + 10) {
        c.fillText('◇', bx, by);
        if (i === state.nextBuoy && !b.rounded && roam < 0.5) {
          c.font = '11px monospace';
          c.fillText(
            `next ${Math.round(Math.hypot(b.pos.x - state.position.x, b.pos.y - state.position.y))}m`,
            bx, by + 20,
          );
          c.font = '18px monospace';
        }
      }
      c.globalAlpha = 1;
    });

    // 5. Boat — at the blended position. Draw 4 wrap copies in roam mode so
    //    the boat appears to wrap smoothly when it crosses a canvas edge.
    const drawBoat = (cx: number, cy: number): void => {
      c.save();
      c.translate(cx, cy);
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

      // boom rotating around the centroid
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

      // mainsheet limit indicator
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
    };

    if (roam > 0) {
      for (const [ox, oy] of wrapOffsets(boatX, boatY)) {
        drawBoat(boatX + ox, boatY + oy);
      }
    } else {
      drawBoat(boatX, boatY);
    }

    // 6. HUD.
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
    if (roam > 0.5) lines.push('', '  off-course. drifting.');
    else if (state.coach) lines.push('', `  ${state.coach}`);
    if (state.finished) {
      lines.push('', `FINISHED. ${formatTime(state.elapsedMs)}. press q to leave.`);
      const best = parseInt(localStorage.getItem('theorkan.regatta.best') || '0', 10);
      if (best) lines.push(`best: ${formatTime(best)}`);
    }
    lines.forEach((l, i) => c.fillText(l, 14, 14 + i * 16));
  }
}

// Returns offsets so a thing at (x, y) can be drawn at all 4 wrap positions
// where it might be visible (origin, ±VIEW_W, ±VIEW_H).
function wrapOffsets(x: number, y: number): Array<[number, number]> {
  const out: Array<[number, number]> = [[0, 0]];
  if (x < HALO_RADIUS_PX) out.push([VIEW_W, 0]);
  if (x > VIEW_W - HALO_RADIUS_PX) out.push([-VIEW_W, 0]);
  if (y < HALO_RADIUS_PX) out.push([0, VIEW_H]);
  if (y > VIEW_H - HALO_RADIUS_PX) out.push([0, -VIEW_H]);
  return out;
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
