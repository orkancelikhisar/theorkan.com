import { describe, it, expect } from 'vitest';
import { getRegistry } from '../../src/kernel/registry';

describe('program registry contract', () => {
  it('loads at least the baseline programs', () => {
    const reg = getRegistry();
    expect(reg.size).toBeGreaterThan(0);
  });

  it('has unique program names', () => {
    const reg = getRegistry();
    const names = [...new Set(reg.values())].map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('has no alias collisions', () => {
    const reg = getRegistry();
    const programs = [...new Set(reg.values())];
    const all: string[] = [];
    for (const p of programs) {
      all.push(p.name);
      if (p.aliases) all.push(...p.aliases);
    }
    expect(new Set(all).size).toBe(all.length);
  });

  it('every program declares a category and mode', () => {
    const reg = getRegistry();
    for (const p of new Set(reg.values())) {
      expect(p.category).toBeDefined();
      expect(p.mode).toBeDefined();
      expect(p.manpage).toBeDefined();
      expect(p.manpage.length).toBeGreaterThan(0);
    }
  });

  it('modal programs implement onKey and render', () => {
    const reg = getRegistry();
    for (const p of new Set(reg.values())) {
      if (p.mode === 'modal') {
        expect(p.onKey, `${p.name} (modal) must define onKey`).toBeDefined();
        expect(p.render, `${p.name} (modal) must define render`).toBeDefined();
      }
    }
  });

  it('inline programs implement onCommand', () => {
    const reg = getRegistry();
    for (const p of new Set(reg.values())) {
      if (p.mode === 'inline') {
        expect(p.onCommand, `${p.name} (inline) must define onCommand`).toBeDefined();
      }
    }
  });
});
