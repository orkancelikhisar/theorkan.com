import { describe, expect, it } from 'vitest';
import { createLanguageCurrent } from '../../src/programs/art/undertow/language';

describe('undertow language current', () => {
  it('is deterministic for a given day seed', () => {
    const a = createLanguageCurrent(47);
    const b = createLanguageCurrent(47);
    expect(Array.from({ length: 30 }, () => a.next()))
      .toEqual(Array.from({ length: 30 }, () => b.next()));
  });

  it('generates bounded, punctuated lines without recent repeats', () => {
    const current = createLanguageCurrent(91);
    const lines = Array.from({ length: 60 }, () => current.next());
    for (const line of lines) {
      expect(line.length).toBeGreaterThanOrEqual(8);
      expect(line.length).toBeLessThanOrEqual(88);
      expect(line).toMatch(/[.]$/);
    }
    for (let i = 1; i < lines.length; i++) expect(lines[i]).not.toBe(lines[i - 1]);
    expect(new Set(lines).size).toBeGreaterThan(48);
  });
});
