import { describe, it, expect, beforeEach } from 'vitest';
import { createHistory } from '../../src/terminal/history';

describe('command history', () => {
  let h: ReturnType<typeof createHistory>;
  beforeEach(() => { h = createHistory(); });

  it('returns null for prev on fresh history', () => {
    expect(h.prev('')).toBe(null);
  });

  it('cycles backward through entries', () => {
    h.add('one'); h.add('two'); h.add('three');
    expect(h.prev('')).toBe('three');
    expect(h.prev('')).toBe('two');
    expect(h.prev('')).toBe('one');
    expect(h.prev('')).toBe('one');
  });

  it('next cycles forward, returns saved buffer at end', () => {
    h.add('one'); h.add('two');
    expect(h.prev('typed-buffer')).toBe('two');
    expect(h.prev('typed-buffer')).toBe('one');
    expect(h.next()).toBe('two');
    expect(h.next()).toBe('typed-buffer');
  });

  it('persists across reload', () => {
    h.add('persist-me');
    const h2 = createHistory();
    expect(h2.prev('')).toBe('persist-me');
  });

  it('all() returns full history', () => {
    h.add('a'); h.add('b');
    expect(h.all()).toEqual(['a', 'b']);
  });

  it('dedupes consecutive identical entries', () => {
    h.add('a'); h.add('a'); h.add('b'); h.add('b');
    expect(h.all()).toEqual(['a', 'b']);
  });
});
