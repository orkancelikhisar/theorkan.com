import { flashStowaway } from './flash';

export function installInterceptors(): void {
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    flashStowaway(e.clientX, e.clientY);
  });

  document.addEventListener('dragstart', (e) => {
    const target = e.target as HTMLElement | null;
    if (target?.matches('img, video, canvas')) {
      e.preventDefault();
      flashStowaway(e.clientX, e.clientY);
    }
  });

  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && (e.key === 's' || e.key === 'S' || e.key === 'p' || e.key === 'P')) {
      e.preventDefault();
      flashStowaway();
    }
  });
}
