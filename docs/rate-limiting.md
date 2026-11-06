# Rate Limiting and Gateway Tuning Guide

Pinto ships with a three-layer rate control stack so you can bulk-read Pinterest without getting rate-limited or blocked:

1. **SessionPool** — N cookie-backed sessions, round-robin checkout, auto-cooldown on 429/403
2. **GlobalRateLimiter** — per-host token bucket (requests/sec + concurrent cap)
3. **Gateway** — wraps pool + limiter + cache with request coalescing (dedupe in-flight requests)

This guide explains how to tune each layer, interpret stats, and when to raise concurrency for bulk reads.

## Architecture Overview

```
Request → Gateway (cache hit?)
          ↓ miss
      Gateway → GlobalRateLimiter (per-host cap)
                ↓ allowed
            SessionPool (least-loaded slot)
                ↓
            Pinterest API
```

| Component | Responsibility | Default |
|---|---|---|
| `SessionPool` | Cookie session rotation + least-loaded slot | 4 sessions |
| `GlobalRateLimiter` | Per-host request rate + concurrency cap | 8 req/sec, 20 concurrent |
| `CacheStore` | Dedupe + repeat-read avoidance | 1-minute TTL, 1,000 entries |
| `Gateway` | Orchestrates pool + limiter + cache | — |
## SessionPool — Pool Sizing

The pool holds N cookie sessions. Each slot tracks `inFlight`, `failures`, and `cooldownUntil`.

### Options

| Option | Type | Default | Meaning |
|---|---|---|---|
| `size` | `number` | `4` | Number of concurrent session slots |
| `seeds` | `string[] \| Record[]` | `[]` | Initial cookie headers |
| `makeSession` | `(index) => { state, saveSession? }` | — | Factory for custom session creation |
| `fetch` | `typeof fetch` | — | Custom fetch implementation (proxy, interception) |

### When to Increase Pool Size

| Scenario | Recommended Size | Why |
|---|---|---|
| Light usage (occasional pins/boards) | 4–8 | Default is sufficient |
| Bulk board export (many pages) | 16–32 | More parallel slots = fewer waits |
| Multi-user / multi-account | 1 per user + headroom | Each user needs its own session |
| High-latency proxies | 32+ | Slow responses inflate `inFlight` |

### Example

```typescript
import { createGateway } from "@traceryn/pinto";

const gateway = createGateway({
  pool: {
    size: 32,
    seeds: [
      "csrftoken=abc123; _pinterest_sess=sess1",
      "csrftoken=def456; _pinterest_sess=sess2",
    ],
  },
});
```

**Rule of thumb:** Start at `size = 8`. If `poolSize()` stays saturated and `stats.coalesced` is low, double it. If you see frequent `cooldownUntil` slots, reduce concurrency instead.

## GlobalRateLimiter — Host-Level Limiter

The limiter enforces two caps **per host** (e.g. `widgets.pinterest.com`, `www.pinterest.com`):

1. **Requests per second** (`maxPerSecond`) — token bucket refilled every 1s
2. **Concurrent requests** (`maxConcurrent`) — in-flight ceiling

### Options

| Option | Type | Default | Meaning |
|---|---|---|---|
| `maxPerSecond` | `number` | `8` | Max requests started per second per host |
| `maxConcurrent` | `number` | `20` | Max simultaneous requests per host |

### Rate Limit Error Handling

When Pinterest responds `429 Too Many Requests` or `403 Forbidden`:

1. The slot is **cooled down** (marked unusable for N seconds)
2. `RateLimitError.retryAfterMs` is read from the response header (falls back to 30s)
3. The gateway retries after cooldown

### Tuning Examples

```typescript
import { createGateway, GlobalRateLimiter } from "@traceryn/pinto";

// Conservative
const safeGateway = createGateway({
  limiter: new GlobalRateLimiter({ maxPerSecond: 4, maxConcurrent: 10 }),
});

// Aggressive bulk read
const bulkGateway = createGateway({
  limiter: new GlobalRateLimiter({ maxPerSecond: 25, maxConcurrent: 50 }),
});
```

**Rule of thumb:** Start at defaults (`8/s`, `20 concurrent`). If you see `RateLimitError` in `stats.failures`, halve `maxPerSecond`. If reads are queueing (high latency, low error rate), raise `maxPerSecond` by 50% increments.

## CacheStore — Cache TTLs

The gateway caches responses by key (endpoint + query). Repeat reads hit the cache and never touch Pinterest.

### Defaults

| Setting | Value | Meaning |
|---|---|---|
| `CACHE_TTL_MS` | `60_000` (60s) | How long a cached response is fresh |
| `CACHE_MAX_ENTRIES` | `1_000` | Max entries before LRU eviction |

### Gateway Options

```typescript
createGateway({
  cache: createMemoryCache({
    maxEntries: 5000,   // larger cache = fewer re-fetches
  }),
  ttlMs: 300_000,       // 5-minute cache TTL instead of 60s
});
```

### When to Adjust TTL

| Data type | Recommended TTL | Why |
|---|---|---|
| Pin metadata | 5–15 min | Pins change infrequently |
| Board pins (listing) | 1–5 min | Pins are added/removed frequently |
| Search results | 30s–2 min | Search is dynamic |
| User profile | 10–30 min | Profiles are stable |

### Custom CacheStore

For multi-process deployments, implement `CacheStore` with Redis:

```typescript
import { createGateway } from "@traceryn/pinto";

const gateway = createGateway({
  cache: redisCacheStore, // implements CacheStore (get/set/delete/clear)
  ttlMs: 300_000,
});
```

## GatewayStats — How to Read Them

```typescript
const stats = gateway.stats();
// { hits: 1250, misses: 300, coalesced: 800, failures: 2 }
poolSize: gateway.poolSize(); // 32
```

| Metric | Meaning | Healthy Range |
|---|---|---|
| `hits` | Cache served the request | Higher is better |
| `misses` | Cache miss → upstream fetch | Expected on cold start |
| `coalesced` | Duplicate request merged with in-flight | Good — means dedupe works |
| `failures` | Requests that errored (429, 403, network) | Should be near 0 |
| `poolSize` | Active session slots | Should match your configured size |

**Investigate if:**
- `failures > 5%` of total → raise cooldown, lower `maxPerSecond`
- `hits ≈ 0` after warmup → your TTL is too short or keys vary too much
- `coalesced ≈ 0` under load → you're not repeating requests; consider cache

## Bulk Reads: When to Raise Concurrency

For one-time bulk operations (board export, full media archive), you can safely push concurrency higher:

### Recommended Bulk Config

```typescript
const bulkGateway = createGateway({
  pool: {
    size: 64,            // more sessions = more parallelism
    seeds: accountCookies, // 10–20 accounts spread across slots
  },
  limiter: new GlobalRateLimiter({
    maxPerSecond: 40,    // higher burst allowance
    maxConcurrent: 80,   // allow many in-flight
  }),
  cache: createMemoryCache({
    maxEntries: 10_000,  // avoid evicting during large crawl
  }),
  ttlMs: 600_000,        // 10 min — board data doesn't change fast
});
```

### Bulk Read Strategy

1. **Warm the cache first** — fetch popular boards once, let cache serve repeats
2. **Use `searchAll`** — the async generator handles pagination cursors internally
3. **Monitor `stats.failures`** — if it climbs, pause and let cooldowns expire
4. **Spread across accounts** — seed the pool with 5–10 accounts to distribute IP/reputation risk

### Example: Bulk Board Export

```typescript
import { createGateway } from "@traceryn/pinto";

const gw = createGateway({
  pool: { size: 32, seeds: accountCookies },
  limiter: new GlobalRateLimiter({ maxPerSecond: 20, maxConcurrent: 40 }),
});

async function exportBoard(boardUrl: string) {
  let cursor: string | undefined;
  do {
    const page = await gw.boardPins(boardUrl, { cursor });
    for (const pin of page.results) {
      // process pin
    }
    cursor = page.cursor;
  } while (page.hasMore);
}
```

## Symptom → Fix

| Symptom | Likely Cause | Fix |
|---|---|---|
| `RateLimitError` (429) | Too many requests/sec | Lower `maxPerSecond`, add more accounts |
| `BlockedError` (403) | IP/session flagged | Reduce concurrency, add cooldown time |
| `stats.failures` climbing | Slots on cooldown | Wait out cooldowns, then lower rate |
| High latency, low errors | Too few pool slots | Increase `pool.size` |
| `hits ≈ 0` after warmup | TTL too short | Increase `ttlMs` |
| Memory growth | Unbounded cache | Set `maxEntries`, use Redis |
| Duplicate upstream fetches | No coalescing | Use `gateway.shared()` (default for all methods) |

## Complete Example

```typescript
import { createGateway, createMemoryCache, GlobalRateLimiter } from "@traceryn/pinto";

const gateway = createGateway({
  pool: {
    size: 16,
    seeds: [
      "csrftoken=a; _pinterest_sess=x1",
      "csrftoken=b; _pinterest_sess=x2",
    ],
  },
  limiter: new GlobalRateLimiter({
    maxPerSecond: 12,
    maxConcurrent: 30,
  }),
  cache: createMemoryCache({ maxEntries: 2000 }),
  ttlMs: 300_000, // 5 min
});

// Periodic health check
setInterval(() => {
  const s = gateway.stats();
  console.log(
    `hits=${s.hits} misses=${s.misses} coalesced=${s.coalesced} failures=${s.failures} pool=${gateway.poolSize()}`
  );
  if (s.failures > 10) {
    console.warn("High failure rate — consider lowering maxPerSecond");
  }
}, 30_000);
```
