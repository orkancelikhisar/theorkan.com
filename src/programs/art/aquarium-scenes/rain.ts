import type { Scene } from './types';

// Falling characters. Each column has a head that descends; behind the head
// trails a small tail of dimmer characters. Random glyph swapping along the
// way. Monochrome bone-on-void.

interface Column { head: number; speed: number; glyphs: string[]; }
interface State { cols: Column[]; }

const GLYPHS = '.-=+*:;_|<>oO0?'.split('');
const COL_PX = 9;
const ROW_PX = 14;

function newColumn(rowCount: number): Column {
  const len = Math.max(rowCount, 1);
  const glyphs: string[] = new Array(len).fill(' ');
  return {
    head: -Math.floor(Math.random() * len),
    speed: 0.5 + Math.random() * 1.0,
    glyphs,
  };
}

export const rainScene: Scene<State> = {
  name: 'rain',
  description: 'falling characters',
  init({ width, height }) {
    const colCount = Math.ceil(width / COL_PX);
    const rowCount = Math.ceil(height / ROW_PX);
    const cols: Column[] = [];
    for (let i = 0; i < colCount; i++) cols.push(newColumn(rowCount));
    return { cols };
  },
  frame(state, { ctx, width, height }, dtMs) {
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    ctx.font = '12px monospace';
    ctx.textBaseline = 'top';

    const rowCount = Math.ceil(height / ROW_PX);
    const step = dtMs * 0.06;

    for (let i = 0; i < state.cols.length; i++) {
      const col = state.cols[i];
      col.head += col.speed * step;
      const headRow = Math.floor(col.head);

      // Advance: occasionally swap a glyph in the trail.
      if (Math.random() < 0.15) {
        const r = Math.floor(Math.random() * col.glyphs.length);
        col.glyphs[r] = Math.random() < 0.5 ? ' ' : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      if (headRow >= 0 && headRow < col.glyphs.length) {
        col.glyphs[headRow] = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }

      // Render: head bright, trail dimming over ~6 rows.
      for (let r = 0; r < col.glyphs.length; r++) {
        const ch = col.glyphs[r];
        if (ch === ' ') continue;
        const dist = headRow - r;
        if (dist < 0 || dist > 8) continue;
        const brightness = Math.max(0, 1 - dist / 8);
        const shade = Math.floor(brightness * 232);
        ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
        ctx.fillText(ch, i * COL_PX, r * ROW_PX);
      }

      if (col.head > rowCount + 8) {
        Object.assign(col, newColumn(rowCount));
      }
    }
  },
};
