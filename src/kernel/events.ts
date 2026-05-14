export type EventName = string;
export type EventHandler<T = unknown> = (payload: T) => void;

export interface EventBus {
  on<T = unknown>(name: EventName, fn: EventHandler<T>): () => void;
  emit<T = unknown>(name: EventName, payload: T): void;
}

export function createEventBus(): EventBus {
  const subs = new Map<EventName, Set<EventHandler>>();

  return {
    on(name, fn) {
      let set = subs.get(name);
      if (!set) { set = new Set(); subs.set(name, set); }
      set.add(fn as EventHandler);
      return () => set!.delete(fn as EventHandler);
    },
    emit(name, payload) {
      const set = subs.get(name);
      if (!set) return;
      for (const fn of set) {
        try { (fn as EventHandler)(payload); }
        catch (err) { console.error(`[bus] handler for "${name}" threw:`, err); }
      }
    },
  };
}
