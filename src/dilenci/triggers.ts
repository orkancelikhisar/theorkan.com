// Trigger roll engine (§8.5).
// Each event calls roll() with the current context; returns true if Dilenci
// should appear. Honors cooldown, multipliers, and idle escalation.

// Tuned for "Dilenci is a resident, not a guest" — substantially more
// proactive than the original §8.5 spec. The shorter cooldown keeps him from
// dominating, but the elevated base and earlier idle ramp mean he reliably
// makes his presence felt within the first session.
const BASE_RATE = 0.03;
const COOLDOWN_MS = 75_000;
const IDLE_ESCALATION_AFTER = 25_000;
const IDLE_GUARANTEED_BY = 150_000;

export interface TriggerCtx {
  idleMs: number;
  hunger: number;
  multipliers: number[]; // additive multipliers stacked by callers
}

export interface TriggerAPI {
  roll(ctx: TriggerCtx, rng?: () => number): boolean;
  markFired(): void;
  inCooldown(): boolean;
  setLastFired(ts: number): void;
}

export function createTriggers(): TriggerAPI {
  let lastFired = 0;

  function inCooldown(): boolean {
    return Date.now() - lastFired < COOLDOWN_MS;
  }

  return {
    inCooldown,
    setLastFired(ts) { lastFired = ts; },
    markFired() { lastFired = Date.now(); },
    roll(ctx, rng = Math.random) {
      if (inCooldown()) return false;

      // Guaranteed appearance if long-idle.
      if (ctx.idleMs >= IDLE_GUARANTEED_BY) return true;

      let multiplier = 1;
      // Idle escalation: +5x/min over IDLE_ESCALATION_AFTER.
      if (ctx.idleMs > IDLE_ESCALATION_AFTER) {
        const overMin = (ctx.idleMs - IDLE_ESCALATION_AFTER) / 60_000;
        multiplier += overMin * 5;
      }
      // Caller-supplied additive multipliers (cat /dev/heart, whisper-words, etc.)
      for (const m of ctx.multipliers) multiplier += m;
      // Hunger nudges the floor: starving dilenci appears more readily.
      multiplier += ctx.hunger * 0.8;

      const p = Math.min(0.95, BASE_RATE * multiplier);
      return rng() < p;
    },
  };
}
