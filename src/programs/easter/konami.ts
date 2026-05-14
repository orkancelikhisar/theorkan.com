import type { EventBus } from '../../kernel/events';

const SEQ = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];

export function installKonami(events: EventBus): void {
  let i = 0;
  document.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    const expected = SEQ[i].toLowerCase();
    if (k === expected) {
      i++;
      if (i === SEQ.length) {
        i = 0;
        events.emit('konami:triggered', null);
      }
    } else {
      i = k === SEQ[0].toLowerCase() ? 1 : 0;
    }
  });
}
