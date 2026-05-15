export interface PanelOptions {
  title?: string;
  content?: string;
  contentEl?: HTMLElement;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'center' | 'right' | 'left';
  width?: number;   // px
  height?: number;  // px
  closable?: boolean;
  onClose?: () => void;
}

export interface PanelManager {
  spawn(opts: PanelOptions): string;
  close(id: string): void;
  update(id: string, content: string): void;
  focus(id: string): void;
  getContentElement(id: string): HTMLElement | null;
  closeAll(): void;
}

interface PanelRecord {
  el: HTMLElement;
  contentEl: HTMLElement;
  onClose?: () => void;
}

let nextId = 1;

export function createPanelManager(container: HTMLElement): PanelManager {
  const panels = new Map<string, PanelRecord>();

  function spawn(opts: PanelOptions): string {
    const id = `panel-${nextId++}`;
    const el = document.createElement('div');
    el.className = 'panel';
    el.dataset.id = id;
    if (opts.position) el.classList.add(`panel--${opts.position}`);
    if (opts.width)  el.style.width  = `${opts.width}px`;
    if (opts.height) el.style.height = `${opts.height}px`;

    const closable = opts.closable !== false;
    if (opts.title || closable) {
      const titleBar = document.createElement('div');
      titleBar.className = 'panel__title';

      const titleText = document.createElement('span');
      titleText.className = 'panel__title-text';
      titleText.textContent = opts.title ?? '';
      titleBar.appendChild(titleText);

      if (closable) {
        const xBtn = document.createElement('button');
        xBtn.className = 'panel__close';
        xBtn.setAttribute('aria-label', 'close');
        xBtn.textContent = '×';
        xBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          close(id);
        });
        titleBar.appendChild(xBtn);
      }
      el.appendChild(titleBar);
    }

    const contentEl = document.createElement('div');
    contentEl.className = 'panel__content';
    if (opts.contentEl) contentEl.appendChild(opts.contentEl);
    else if (opts.content) contentEl.textContent = opts.content;
    el.appendChild(contentEl);

    container.appendChild(el);
    panels.set(id, { el, contentEl, onClose: opts.onClose });
    return id;
  }

  function close(id: string): void {
    const rec = panels.get(id);
    if (!rec) return;
    rec.el.remove();
    panels.delete(id);
    rec.onClose?.();
  }

  function update(id: string, content: string): void {
    const rec = panels.get(id);
    if (!rec) return;
    rec.contentEl.textContent = content;
  }

  function focus(id: string): void {
    const rec = panels.get(id);
    if (!rec) return;
    container.appendChild(rec.el);
  }

  function getContentElement(id: string): HTMLElement | null {
    return panels.get(id)?.contentEl ?? null;
  }

  function closeAll(): void {
    for (const id of [...panels.keys()]) close(id);
  }

  return { spawn, close, update, focus, getContentElement, closeAll };
}
