import './terminal.css';

export interface TerminalAPI {
  print(text: string, opts?: { dim?: boolean; warn?: boolean }): void;
  println(text?: string, opts?: { dim?: boolean; warn?: boolean }): void;
  clear(): void;
  scrollToBottom(): void;
  setPrompt(prompt: string): void;
  setInputMode(mode: 'shell' | 'offer' | 'modal'): void;
  getMode(): 'shell' | 'offer' | 'modal';
  onSubmit(cb: (line: string) => void): void;
  onKey(cb: (key: KeyboardEvent) => void): void;
  getInputElement(): HTMLElement;
  getInputValue(): string;
  setInputValue(v: string): void;
  focus(): void;
}

export function createTerminal(root: HTMLElement): TerminalAPI {
  root.innerHTML = '';
  const term = document.createElement('div');
  term.className = 'terminal';
  root.appendChild(term);

  const lines = document.createElement('div');
  lines.className = 'terminal__lines';
  term.appendChild(lines);

  const promptLine = document.createElement('div');
  promptLine.className = 'terminal__line terminal__prompt-line';
  const promptEl = document.createElement('span');
  promptEl.className = 'terminal__prompt';
  promptEl.textContent = 'orkan@theorkan:~$ ';
  const inputEl = document.createElement('input');
  inputEl.type = 'text';
  inputEl.className = 'terminal__input';
  inputEl.spellcheck = false;
  inputEl.autocomplete = 'off';
  inputEl.setAttribute('autocapitalize', 'off');
  inputEl.setAttribute('autocorrect', 'off');
  const cursorEl = document.createElement('span');
  cursorEl.className = 'terminal__cursor';
  promptLine.append(promptEl, inputEl, cursorEl);
  term.appendChild(promptLine);

  let mode: 'shell' | 'offer' | 'modal' = 'shell';
  const submitListeners: Array<(line: string) => void> = [];
  const keyListeners: Array<(e: KeyboardEvent) => void> = [];

  // Position the block cursor over the input at the current selectionStart.
  // Monospace font means one character is exactly 1 ch wide. We compute the
  // cursor's left offset as: input.offsetLeft + selectionStart * charWidth(px).
  function measureCharPx(): number {
    const probe = document.createElement('span');
    probe.style.visibility = 'hidden';
    probe.style.position = 'absolute';
    probe.style.font = window.getComputedStyle(inputEl).font;
    probe.textContent = '0';
    document.body.appendChild(probe);
    const w = probe.getBoundingClientRect().width;
    probe.remove();
    return w || 8;
  }
  let charPx = measureCharPx();

  function syncCursor(): void {
    const pos = inputEl.selectionStart ?? inputEl.value.length;
    const left = inputEl.offsetLeft + pos * charPx;
    cursorEl.style.left = `${left}px`;
  }

  inputEl.addEventListener('input', syncCursor);
  inputEl.addEventListener('keyup', syncCursor);
  inputEl.addEventListener('click', syncCursor);
  inputEl.addEventListener('select', syncCursor);
  window.addEventListener('resize', () => { charPx = measureCharPx(); syncCursor(); });

  inputEl.addEventListener('keydown', (e) => {
    for (const l of keyListeners) l(e);
    if (e.defaultPrevented) {
      requestAnimationFrame(syncCursor);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const line = inputEl.value;
      inputEl.value = '';
      const archived = document.createElement('div');
      archived.className = 'terminal__line';
      archived.textContent = `${promptEl.textContent}${line}`;
      lines.appendChild(archived);
      for (const cb of submitListeners) cb(line);
      term.scrollTop = term.scrollHeight;
      syncCursor();
    } else {
      requestAnimationFrame(syncCursor);
    }
  });

  // Focus management — clicking anywhere refocuses the input, except inside
  // panels / modal overlays where the user is interacting elsewhere. The
  // `[class*="-overlay"]` pattern matches any modal element by convention, so
  // new modal programs don't need to touch this file.
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    if (target && target.closest(
      '[class*="-overlay"], .stowaway-flash, .panel, .panel__close',
    )) return;
    inputEl.focus();
    syncCursor();
  });
  inputEl.focus();
  // Initial cursor position once layout has settled.
  requestAnimationFrame(syncCursor);

  // When the window itself regains focus (tab-switch back, alt-tab, etc.),
  // restore focus to the input — without this, modal programs (walk,
  // gallery, etc.) stop receiving keys because their key-routing relies on
  // the input being the active element.
  window.addEventListener('focus', () => { inputEl.focus(); syncCursor(); });

  return {
    print(text, opts) {
      const span = document.createElement('span');
      span.className = 'terminal__line';
      if (opts?.dim) span.classList.add('terminal__line--dim');
      if (opts?.warn) span.classList.add('terminal__line--warn');
      span.textContent = text;
      lines.appendChild(span);
    },
    println(text = '', opts) {
      const div = document.createElement('div');
      div.className = 'terminal__line';
      if (opts?.dim) div.classList.add('terminal__line--dim');
      if (opts?.warn) div.classList.add('terminal__line--warn');
      div.textContent = text;
      lines.appendChild(div);
      term.scrollTop = term.scrollHeight;
    },
    clear() { lines.innerHTML = ''; },
    scrollToBottom() { term.scrollTop = term.scrollHeight; },
    setPrompt(prompt) {
      promptEl.textContent = prompt;
      requestAnimationFrame(syncCursor);
    },
    setInputMode(m) { mode = m; },
    getMode() { return mode; },
    onSubmit(cb) { submitListeners.push(cb); },
    onKey(cb) { keyListeners.push(cb); },
    getInputElement() { return inputEl; },
    getInputValue() { return inputEl.value; },
    setInputValue(v) {
      inputEl.value = v;
      inputEl.setSelectionRange(v.length, v.length);
      syncCursor();
    },
    focus() { inputEl.focus(); syncCursor(); },
  };
}
