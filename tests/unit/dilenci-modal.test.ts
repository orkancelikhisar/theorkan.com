import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDilenci } from '../../src/dilenci/dilenci';
import { createEventBus } from '../../src/kernel/events';
import type { FS } from '../../src/kernel/fs';
import type { VoidAPI } from '../../src/void/void';
import type { AudioAPI } from '../../src/audio/audio';
import type { TerminalAPI } from '../../src/terminal/terminal';

describe('dilenci modal presence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    localStorage.clear();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('does not awaken behind a modal and closes if one opens', () => {
    const events = createEventBus();
    let mode: 'shell' | 'offer' | 'modal' = 'shell';
    const terminal = {
      println: vi.fn(),
      setInputMode: vi.fn((next: typeof mode) => { mode = next; }),
      getMode: vi.fn(() => mode),
    } as unknown as TerminalAPI;
    const api = createDilenci({
      events,
      fs: { write: vi.fn() } as unknown as FS,
      voidApi: { shine: vi.fn(), whisper: vi.fn() } as unknown as VoidAPI,
      audio: { play: vi.fn() } as unknown as AudioAPI,
      terminal,
      container: document.body,
    });

    events.emit('shell:modal', { active: true, name: 'undertow' });
    vi.advanceTimersByTime(50_000);
    api.wake();
    expect(api.isInOfferMode()).toBe(false);
    expect(document.querySelector('.dilenci-panel')?.classList.contains('is-open')).toBe(false);

    events.emit('shell:modal', { active: false, name: null });
    api.wake();
    vi.advanceTimersByTime(20);
    expect(api.isInOfferMode()).toBe(true);
    expect(document.querySelector('.dilenci-panel')?.classList.contains('is-open')).toBe(true);

    events.emit('shell:modal', { active: true, name: 'undertow' });
    expect(api.isInOfferMode()).toBe(false);
    expect(document.querySelector('.dilenci-panel')?.classList.contains('is-open')).toBe(false);
  });
});
