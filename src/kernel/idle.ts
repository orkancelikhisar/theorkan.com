import type { EventBus } from './events';

export function startIdleTracker(events: EventBus): () => void {
  let last = Date.now();
  let timer15 = false;
  let timer30 = false;

  function reset(): void {
    last = Date.now();
    if (timer15 || timer30) events.emit('shell:active', null);
    timer15 = false; timer30 = false;
  }

  const interval = window.setInterval(() => {
    const ms = Date.now() - last;
    if (!timer15 && ms >= 15_000) { timer15 = true; events.emit('shell:idle', { ms }); }
    if (!timer30 && ms >= 30_000) { timer30 = true; events.emit('shell:idle', { ms }); }
  }, 1000);

  document.addEventListener('keydown', reset);
  document.addEventListener('mousemove', reset);

  return () => {
    window.clearInterval(interval);
    document.removeEventListener('keydown', reset);
    document.removeEventListener('mousemove', reset);
  };
}
