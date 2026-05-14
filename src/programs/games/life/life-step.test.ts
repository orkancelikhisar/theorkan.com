import { describe, it, expect } from 'vitest';
import { lifeStep, emptyBoard } from './life-step';

describe('conway life step', () => {
  it('a blinker oscillates', () => {
    const b = emptyBoard(5, 5);
    b[2][1] = 1; b[2][2] = 1; b[2][3] = 1;
    const next = lifeStep(b);
    expect(next[1][2]).toBe(1);
    expect(next[2][2]).toBe(1);
    expect(next[3][2]).toBe(1);
    expect(next[2][1]).toBe(0);
    expect(next[2][3]).toBe(0);
  });

  it('a block is still life', () => {
    const b = emptyBoard(4, 4);
    b[1][1] = 1; b[1][2] = 1; b[2][1] = 1; b[2][2] = 1;
    const next = lifeStep(b);
    expect(next).toEqual(b);
  });

  it('empty stays empty', () => {
    const b = emptyBoard(3, 3);
    const next = lifeStep(b);
    expect(next).toEqual(b);
  });

  it('a single cell dies (no neighbours)', () => {
    const b = emptyBoard(3, 3);
    b[0][0] = 1;
    const next = lifeStep(b);
    expect(next[0][0]).toBe(0);
  });
});
