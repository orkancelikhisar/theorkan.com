export type Board = number[][];

export function emptyBoard(w: number, h: number): Board {
  return Array.from({ length: h }, () => Array(w).fill(0));
}

export function lifeStep(board: Board): Board {
  const h = board.length;
  const w = board[0]?.length ?? 0;
  const next = emptyBoard(w, h);
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      let n = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= h || nc < 0 || nc >= w) continue;
          if (board[nr][nc]) n++;
        }
      }
      const alive = board[r][c];
      if (alive && (n === 2 || n === 3)) next[r][c] = 1;
      else if (!alive && n === 3) next[r][c] = 1;
    }
  }
  return next;
}

export function randomize(board: Board, density = 0.3): void {
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[0].length; c++) {
      board[r][c] = Math.random() < density ? 1 : 0;
    }
  }
}

export const PRESETS: Record<string, [number, number][]> = {
  glider: [[0,1],[1,2],[2,0],[2,1],[2,2]],
  blinker: [[1,0],[1,1],[1,2]],
  toad: [[1,1],[1,2],[1,3],[2,0],[2,1],[2,2]],
};
