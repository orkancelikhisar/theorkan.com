export type ProgramCategory = 'info' | 'game' | 'art' | 'music' | 'util' | 'device' | 'discovery' | 'easter' | 'meta';
export type ProgramMode = 'inline' | 'panel' | 'modal';

export interface KeyEvent {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

export interface PanelOptions {
  title?: string;
  content?: string;
  contentEl?: HTMLElement;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'center' | 'right' | 'left';
  width?: number;
  height?: number;
  closable?: boolean;
  onClose?: () => void;
}

export interface ProgramContext {
  args: string[];
  cwd: string;
  print(text: string): void;
  println(text?: string): void;
  panel: {
    spawn(opts: PanelOptions): string;
    close(id: string): void;
    closeAll(): void;
    update(id: string, content: string): void;
    focus(id: string): void;
  };
  fs: {
    read(path: string): string;
    write(path: string, data: string): void;
    list(path: string): string[];
    exists(path: string): boolean;
  };
  void: {
    shine(intensity?: number): void;
    crackle(): void;
    whisper(word: string): void;
    drift(): void;
    themed(name: string, opts?: Record<string, unknown>): void;
  };
  audio: {
    play(sample: string): void;
    stop(sample: string): void;
    volume(n: number): void;
  };
  dilenci: {
    notify(eventName: string, payload?: unknown): void;
    status(): { silenced: boolean } | null;
  };
  events: {
    on(name: string, cb: (payload: unknown) => void): () => void;
    emit(name: string, payload: unknown): void;
  };
  storage: { get(key: string): unknown; set(key: string, value: unknown): void };
  random(): number;
}

export interface Program {
  name: string;
  aliases?: string[];
  manpage: string;
  category: ProgramCategory;
  mode: ProgramMode;
  // For modal programs: the CSS selector of the overlay element they mount.
  // Used by the shell to (a) route keypresses to the program's onKey while
  // the overlay is present, and (b) skip terminal-refocus on clicks inside.
  overlaySelector?: string;
  init?(ctx: ProgramContext): void | Promise<void>;
  render?(ctx: ProgramContext): void;
  onKey?(ctx: ProgramContext, key: KeyEvent): void;
  onCommand?(ctx: ProgramContext, argv: string[]): string | void;
  cleanup?(ctx: ProgramContext): void;
}
