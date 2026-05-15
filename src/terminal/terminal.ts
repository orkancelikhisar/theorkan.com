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
  promptLine.append(promptEl, inputEl);
  term.appendChild(promptLine);

  let mode: 'shell' | 'offer' | 'modal' = 'shell';
  const submitListeners: Array<(line: string) => void> = [];
  const keyListeners: Array<(e: KeyboardEvent) => void> = [];

  inputEl.addEventListener('keydown', (e) => {
    for (const l of keyListeners) l(e);
    if (e.defaultPrevented) return;
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
    }
  });

  // Focus management — clicking anywhere refocuses the input, except inside
  // modal overlays / panels where the user is interacting elsewhere.
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    if (target && target.closest(
      '.snake-overlay, .t2048-overlay, .life-overlay, .regatta-overlay, ' +
      '.stowaway-flash, .panel, .panel__close',
    )) return;
    inputEl.focus();
  });
  inputEl.focus();

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
    setPrompt(prompt) { promptEl.textContent = prompt; },
    setInputMode(m) { mode = m; },
    getMode() { return mode; },
    onSubmit(cb) { submitListeners.push(cb); },
    onKey(cb) { keyListeners.push(cb); },
    getInputElement() { return inputEl; },
    getInputValue() { return inputEl.value; },
    setInputValue(v) {
      inputEl.value = v;
      // place caret at end
      inputEl.setSelectionRange(v.length, v.length);
    },
    focus() { inputEl.focus(); },
  };
}
