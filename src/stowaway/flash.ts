import './flash.css';
import lines from '../content/stowaway-flashes.json';

export function flashStowaway(x?: number, y?: number): void {
  const el = document.createElement('div');
  el.className = 'stowaway-flash';
  el.textContent = lines[Math.floor(Math.random() * lines.length)];

  if (x != null && y != null) {
    el.style.left = `${x + 8}px`;
    el.style.top = `${y + 8}px`;
  } else {
    el.style.left = '50%';
    el.style.top = '20%';
    el.style.transform = 'translateX(-50%)';
  }

  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('active'));
  window.setTimeout(() => {
    el.classList.remove('active');
    window.setTimeout(() => el.remove(), 250);
  }, 1200);
}
