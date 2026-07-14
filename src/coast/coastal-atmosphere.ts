import './coastal-atmosphere.css';
import type { EventBus } from '../kernel/events';
import type { TerminalAPI } from '../terminal/terminal';
import {
  coastalSnapshot, markCoastalFlag, mutateCoastalMemory, readCoastalMemory,
  subscribeCoastalMemory,
} from './coastal-memory';

export interface CoastalAtmosphereAPI {
  refresh(): void;
  stop(): void;
  enterAbsence(): void;
}

export function createCoastalAtmosphere(
  events: EventBus,
  terminal: TerminalAPI,
  container: HTMLElement,
): CoastalAtmosphereAPI {
  const layer = document.createElement('div');
  layer.className = 'coast-atmosphere';
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = `
    <div class="coast-atmosphere__mist"></div>
    <div class="coast-atmosphere__rain"></div>
    <div class="coast-atmosphere__salt"></div>
    <div class="coast-atmosphere__beam"></div>
    <div class="coast-atmosphere__eye"><i></i></div>
    <div class="coast-atmosphere__transmission"></div>`;
  container.appendChild(layer);
  const rain = layer.querySelector<HTMLElement>('.coast-atmosphere__rain')!;
  rain.textContent = Array.from({ length: 22 }, (_, row) => (
    `${' '.repeat(row % 7)},     ·       ;          ,    /       ·      ,`
  )).join('\n');
  const transmission = layer.querySelector<HTMLElement>('.coast-atmosphere__transmission')!;

  let stopped = false;
  let lighthouseActive = false;
  let eyeRecorded = false;
  let absenceTimer: number | null = null;
  let eyeX = 0.5;
  let eyeY = 0.5;

  function refresh(): void {
    if (stopped) return;
    const snapshot = coastalSnapshot();
    const root = document.documentElement;
    root.style.setProperty('--coast-tide', snapshot.tide.toFixed(3));
    root.style.setProperty('--coast-wind-deg', `${snapshot.windDegrees}deg`);
    root.style.setProperty('--coast-wind-speed', String(snapshot.windSpeed));
    root.style.setProperty('--coast-eye-x', eyeX.toFixed(3));
    root.style.setProperty('--coast-eye-y', eyeY.toFixed(3));
    document.body.dataset.coastWeather = snapshot.weather;
    document.body.dataset.coastTide = snapshot.tideName;
    document.body.dataset.coastDecay = String(Math.min(5, Math.floor(snapshot.memory.commandCount / 8)));
    layer.style.setProperty('--beam-strength', snapshot.lighthouse.toFixed(3));

    const active = snapshot.lighthouse > 0.08;
    layer.classList.toggle('is-lighthouse', active);
    if (active && !lighthouseActive) {
      lighthouseActive = true;
      markCoastalFlag('lighthousePasses');
      if (!eyeRecorded) {
        eyeRecorded = true;
        markCoastalFlag('eyeSightings');
      }
      events.emit('coast:lighthouse', snapshot);
      const phrase = snapshot.memory.phrases[snapshot.memory.phrases.length - 1];
      transmission.textContent = phrase?.text ?? 'the light finds no one waiting.';
      transmission.classList.add('is-visible');
    } else if (!active && lighthouseActive) {
      lighthouseActive = false;
      transmission.classList.remove('is-visible');
    }
  }

  function enterAbsence(): void {
    if (absenceTimer != null || stopped) return;
    const memory = readCoastalMemory();
    if (memory.absenceSeen) return;
    mutateCoastalMemory((next) => { next.absenceSeen = true; });
    document.body.classList.add('coast-absence');
    events.emit('coast:absence', { active: true });
    absenceTimer = window.setTimeout(() => {
      document.body.classList.remove('coast-absence');
      terminal.println('the harbor returned before you could prove it was gone.', { dim: true });
      events.emit('coast:absence', { active: false });
      absenceTimer = null;
    }, 8_500);
  }

  const unsubscribe = subscribeCoastalMemory(refresh);
  const interval = window.setInterval(refresh, 1_000);
  const offIdle = events.on('shell:idle', (payload: unknown) => {
    const ms = (payload as { ms?: number })?.ms ?? 0;
    const memory = readCoastalMemory();
    if (ms >= 30_000 && memory.commandCount >= 6 && !memory.absenceSeen) enterAbsence();
  });
  const onPointer = (event: PointerEvent) => {
    eyeX = event.clientX / Math.max(1, window.innerWidth);
    eyeY = event.clientY / Math.max(1, window.innerHeight);
  };
  window.addEventListener('pointermove', onPointer, { passive: true });
  refresh();

  return {
    refresh,
    enterAbsence,
    stop() {
      stopped = true;
      unsubscribe();
      offIdle();
      window.clearInterval(interval);
      if (absenceTimer != null) window.clearTimeout(absenceTimer);
      window.removeEventListener('pointermove', onPointer);
      document.body.classList.remove('coast-absence');
      layer.remove();
    },
  };
}
