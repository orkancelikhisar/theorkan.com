import { describe, it, expect, beforeEach } from 'vitest';
import { createPanelManager } from '../../src/kernel/panels';

describe('panel manager', () => {
  let container: HTMLElement;
  let manager: ReturnType<typeof createPanelManager>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    manager = createPanelManager(container);
  });

  it('spawns a panel and returns an id', () => {
    const id = manager.spawn({ title: 'test' });
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('mounts the panel in the container', () => {
    manager.spawn({ title: 'test' });
    expect(container.querySelectorAll('.panel').length).toBe(1);
  });

  it('updates panel text content', () => {
    const id = manager.spawn({ title: 'x', content: 'before' });
    manager.update(id, 'after');
    expect(container.textContent).toContain('after');
    expect(container.textContent).not.toContain('before');
  });

  it('closes a panel and removes it', () => {
    const id = manager.spawn({ title: 'x' });
    manager.close(id);
    expect(container.querySelectorAll('.panel').length).toBe(0);
  });

  it('returns the content element so programs can draw into it', () => {
    const id = manager.spawn({ title: 'x' });
    const el = manager.getContentElement(id);
    expect(el).toBeInstanceOf(HTMLElement);
  });

  it('supports multiple panels with unique ids', () => {
    const a = manager.spawn({ title: 'a' });
    const b = manager.spawn({ title: 'b' });
    expect(a).not.toBe(b);
    expect(container.querySelectorAll('.panel').length).toBe(2);
  });

  it('fires onClose callback when closed', () => {
    let called = false;
    const id = manager.spawn({ title: 'x', onClose: () => { called = true; } });
    manager.close(id);
    expect(called).toBe(true);
  });
});
