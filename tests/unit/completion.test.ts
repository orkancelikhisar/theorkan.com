import { describe, it, expect } from 'vitest';
import { complete } from '../../src/terminal/completion';
import { BASELINE_DISCOVERED, BUILTIN_NAMES } from '../../src/kernel/shell';
import { getRegistry } from '../../src/kernel/registry';

describe('tab completion', () => {
  it('completes a command prefix from known commands', () => {
    const out = complete('hel', ['help', 'history', 'man'], { discoveredOnly: false });
    expect(out.candidates).toEqual(['help']);
  });

  it('returns multiple candidates when prefix is ambiguous', () => {
    const out = complete('h', ['help', 'history', 'man'], { discoveredOnly: false });
    expect(out.candidates.sort()).toEqual(['help', 'history']);
  });

  it('filters by discovered commands when flag set', () => {
    const out = complete('p', ['ping', 'pinpoint', 'ps'], {
      discoveredOnly: true,
      baseline: ['ping', 'ps'],
      discovered: [],
    });
    expect(out.candidates.sort()).toEqual(['ping', 'ps']);
  });

  it('reveals discovered command after it has been used once', () => {
    const out = complete('pin', ['ping', 'pinpoint'], {
      discoveredOnly: true,
      baseline: ['ping'],
      discovered: ['pinpoint'],
    });
    expect(out.candidates.sort()).toEqual(['ping', 'pinpoint']);
  });

  it('returns empty when nothing matches', () => {
    const out = complete('xyz', ['help'], { discoveredOnly: false });
    expect(out.candidates).toEqual([]);
  });

  it('exposes undertow through the real public registry', () => {
    const all = [...BUILTIN_NAMES, ...getRegistry().keys()];
    const out = complete('', all, {
      discoveredOnly: true,
      baseline: [...BASELINE_DISCOVERED, ...BUILTIN_NAMES],
      discovered: [],
    });
    expect(out.candidates).toContain('undertow');
  });
});
