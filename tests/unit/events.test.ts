import { describe, it, expect, vi } from 'vitest';
import { createEventBus } from '../../src/kernel/events';

describe('event bus', () => {
  it('delivers events to subscribers', () => {
    const bus = createEventBus();
    const fn = vi.fn();
    bus.on('test', fn);
    bus.emit('test', { x: 1 });
    expect(fn).toHaveBeenCalledWith({ x: 1 });
  });

  it('supports multiple subscribers for one event', () => {
    const bus = createEventBus();
    const a = vi.fn(); const b = vi.fn();
    bus.on('test', a); bus.on('test', b);
    bus.emit('test', null);
    expect(a).toHaveBeenCalled();
    expect(b).toHaveBeenCalled();
  });

  it('unsubscribes via returned dispose function', () => {
    const bus = createEventBus();
    const fn = vi.fn();
    const off = bus.on('test', fn);
    off();
    bus.emit('test', null);
    expect(fn).not.toHaveBeenCalled();
  });

  it('isolates errors in one subscriber from others', () => {
    const bus = createEventBus();
    const bad = vi.fn(() => { throw new Error('boom'); });
    const good = vi.fn();
    bus.on('test', bad); bus.on('test', good);
    expect(() => bus.emit('test', null)).not.toThrow();
    expect(good).toHaveBeenCalled();
  });
});
