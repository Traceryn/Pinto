import { configureTransport } from "../Client/client.js";
import { createEmptySession, setSessionCookies } from "../Vault/session.js";
import type { SaveSession } from "../Vault/session.js";
import type { SessionState } from "../Shapes/common.js";

export interface PooledSlot {
  id: number;
  session: SessionState;
  fetch?: typeof fetch;
  inFlight: number;
  failures: number;
  cooldownUntil: number;
  save: () => Promise<void>;
}

export interface SessionPoolOptions {
  size?: number;
  fetch?: typeof fetch;
  seeds?: Array<string | Record<string, string>>;
  makeSession?: (index: number) => {
    state: SessionState;
    saveSession?: SaveSession;
  };
}

export class SessionPool {
  private slots: PooledSlot[] = [];
  private cursor = 0;

  constructor(options?: SessionPoolOptions) {
    const size =
      options && typeof options.size === "number" && options.size > 0
        ? Math.floor(options.size)
        : 4;
    for (let i = 0; i < size; i = i + 1) {
      let state = createEmptySession();
      let saver: SaveSession | undefined;
      if (options && typeof options.makeSession === "function") {
        const made = options.makeSession(i);
        state = made.state;
        saver = made.saveSession;
      } else if (
        options &&
        options.seeds !== undefined &&
        options.seeds[i] !== undefined
      ) {
        setSessionCookies(state, options.seeds[i]);
      }
      if (options && options.fetch !== undefined) {
        configureTransport(state, { fetchImpl: options.fetch });
      }
      const slot: PooledSlot = {
        id: i,
        session: state,
        fetch: options && options.fetch ? options.fetch : undefined,
        inFlight: 0,
        failures: 0,
        cooldownUntil: 0,
        save: async function () {
          if (saver) {
            await saver(state);
          }
        },
      };
      this.slots.push(slot);
    }
  }

  size(): number {
    return this.slots.length;
  }

  acquire(): PooledSlot {
    const now = Date.now();
    let best: PooledSlot | null = null;
    for (let n = 0; n < this.slots.length; n = n + 1) {
      const slot = this.slots[(this.cursor + n) % this.slots.length];
      if (slot.cooldownUntil > now) {
        continue;
      }
      if (best === null || slot.inFlight < best.inFlight) {
        best = slot;
      }
    }
    if (best === null) {
      best = this.slots[this.cursor % this.slots.length];
    }
    this.cursor = (this.cursor + 1) % Math.max(this.slots.length, 1);
    best.inFlight = best.inFlight + 1;
    return best;
  }

  release(slot: PooledSlot, failed: boolean): void {
    slot.inFlight = Math.max(0, slot.inFlight - 1);
    if (failed) {
      slot.failures = slot.failures + 1;
      if (slot.failures >= 3) {
        slot.cooldownUntil = Date.now() + 60 * 1000;
        slot.failures = 0;
      }
    } else {
      slot.failures = 0;
    }
  }

  reportBlocked(slot: PooledSlot, cooldownMs: number): void {
    slot.inFlight = Math.max(0, slot.inFlight - 1);
    slot.failures = slot.failures + 1;
    slot.cooldownUntil = Date.now() + cooldownMs;
  }
}
