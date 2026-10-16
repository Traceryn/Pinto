import { createPinto } from "../Actions/index.js";
import type { Page, PagingOptions } from "../Shapes/common.js";
import type { Board } from "../Shapes/boards.js";
import type { Pin } from "../Shapes/pins.js";
import type { UserProfile } from "../Shapes/users.js";
import type { SearchScope } from "../Actions/search.js";
import { BlockedError, RateLimitError } from "../Errors/index.js";
import { createMemoryCache, type CacheStore } from "./cache.js";
import { GlobalRateLimiter } from "./rate.js";
import { SessionPool } from "./pool.js";
import type { PooledSlot, SessionPoolOptions } from "./pool.js";
import { CACHE_TTL_MS } from "../Config/index.js";

export interface GatewayOptions {
  pool?: SessionPoolOptions;
  cache?: CacheStore;
  limiter?: GlobalRateLimiter;
  ttlMs?: number;
}

export interface GatewayStats {
  hits: number;
  misses: number;
  coalesced: number;
  failures: number;
}

function keyOf(parts: string[]): string {
  return parts.join("|");
}

export function createGateway(options?: GatewayOptions) {
  const pool = new SessionPool(options ? options.pool : undefined);
  const cache = options && options.cache ? options.cache : createMemoryCache();
  const limiter =
    options && options.limiter ? options.limiter : new GlobalRateLimiter();
  const ttl =
    options && typeof options.ttlMs === "number" ? options.ttlMs : CACHE_TTL_MS;
  const inflight = new Map<string, Promise<unknown>>();
  const stats: GatewayStats = { hits: 0, misses: 0, coalesced: 0, failures: 0 };

  async function guarded<T>(
    key: string,
    host: string,
    work: (s: PooledSlot) => Promise<T>,
  ): Promise<T> {
    const slot = pool.acquire();
    const release = await limiter.acquire(host);
    try {
      const out = await work(slot);
      if (out !== null && out !== undefined) {
        cache.set(key, out, ttl);
      }
      pool.release(slot, false);
      return out;
    } catch (err) {
      stats.failures = stats.failures + 1;
      const blocked =
        err instanceof RateLimitError ||
        (err instanceof BlockedError && err.status === 403);
      if (blocked) {
        const wait =
          err instanceof RateLimitError && err.retryAfterMs !== undefined
            ? err.retryAfterMs
            : 30000;
        pool.reportBlocked(slot, wait);
      } else {
        pool.release(slot, true);
      }
      throw err;
    } finally {
      release();
      inflight.delete(key);
    }
  }

  async function shared<T>(
    key: string,
    host: string,
    work: (s: PooledSlot) => Promise<T>,
  ): Promise<T> {
    const hit = cache.get(key);
    if (hit !== null && hit !== undefined) {
      stats.hits = stats.hits + 1;
      return hit as T;
    }
    const pending = inflight.get(key);
    if (pending !== undefined) {
      stats.coalesced = stats.coalesced + 1;
      return pending as Promise<T>;
    }
    stats.misses = stats.misses + 1;
    const job = guarded(key, host, work);
    inflight.set(key, job);
    return job;
  }

  async function getPin(input: string): Promise<Pin> {
    return shared(
      keyOf(["pin", input]),
      "widgets.pinterest.com",
      async function (slot) {
        return createPinto({
          session: slot.session,
          fetch: slot.fetch,
        }).getPin(input);
      },
    );
  }

  async function getUser(input: string): Promise<UserProfile> {
    return shared(
      keyOf(["user", input]),
      "widgets.pinterest.com",
      async function (slot) {
        return createPinto({
          session: slot.session,
          fetch: slot.fetch,
        }).getUser(input);
      },
    );
  }

  async function getBoard(input: string): Promise<Board> {
    return shared(
      keyOf(["board", input]),
      "widgets.pinterest.com",
      async function (slot) {
        return createPinto({
          session: slot.session,
          fetch: slot.fetch,
        }).getBoard(input);
      },
    );
  }

  async function boardPins(
    input: string,
    paging?: PagingOptions,
  ): Promise<Page<Pin>> {
    const key = keyOf([
      "boardPins",
      input,
      JSON.stringify(paging ? paging : {}),
    ]);
    return shared(key, "widgets.pinterest.com", async function (slot) {
      return createPinto({
        session: slot.session,
        fetch: slot.fetch,
      }).boardPins(input, paging);
    });
  }

  async function userPins(
    input: string,
    paging?: PagingOptions,
  ): Promise<Page<Pin>> {
    const key = keyOf([
      "userPins",
      input,
      JSON.stringify(paging ? paging : {}),
    ]);
    return shared(key, "widgets.pinterest.com", async function (slot) {
      return createPinto({
        session: slot.session,
        fetch: slot.fetch,
      }).userPins(input, paging);
    });
  }

  async function search(
    query: string,
    scope: SearchScope = "pins",
    paging?: PagingOptions,
  ): Promise<Page<Pin>> {
    const key = keyOf([
      "search",
      scope,
      query,
      JSON.stringify(paging ? paging : {}),
    ]);
    return shared(key, "www.pinterest.com", async function (slot) {
      const merged = { ...(paging ? paging : {}), scope: scope };
      return createPinto({ session: slot.session, fetch: slot.fetch }).search(
        query,
        merged,
      );
    });
  }

  function getStats(): GatewayStats {
    return { ...stats };
  }

  function poolSize(): number {
    return pool.size();
  }

  return {
    getPin: getPin,
    getUser: getUser,
    getBoard: getBoard,
    boardPins: boardPins,
    userPins: userPins,
    search: search,
    stats: getStats,
    poolSize: poolSize,
  };
}

export type Gateway = ReturnType<typeof createGateway>;
