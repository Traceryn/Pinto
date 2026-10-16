import {
  createGateway,
  GlobalRateLimiter,
  createMemoryCache,
} from "../Scale/index.js";
import { importNetscapeCookies } from "../Vault/index.js";
import { createEmptySession } from "../Vault/session.js";

describe("gateway pool seeding", () => {
  it("seeds N sessions (per-seed fallback)", () => {
    const gw = createGateway({
      pool: {
        size: 3,
        seeds: [
          "csrftoken=a; _pinterest_sess=s1",
          "csrftoken=b; _pinterest_sess=s2",
        ],
      },
    });
    expect(gw.poolSize()).toBe(3);
  });
});

describe("gateway cache sharing", () => {
  it("shares one fetch across parallel identical reads", async () => {
    let hits = 0;
    const fakeFetch = async function () {
      hits = hits + 1;
      await new Promise(function (r) {
        setTimeout(r, 30);
      });
      return new Response(
        JSON.stringify({
          data: [
            {
              pins: [{ id: "1", images: { orig: { url: "https://x/y.jpg" } } }],
            },
          ],
        }),
        { status: 200 },
      );
    } as typeof fetch;
    const gw = createGateway({
      pool: { size: 2, fetch: fakeFetch },
      cache: createMemoryCache(),
    });
    const [a, b, c] = await Promise.all([
      gw.boardPins("parallel-board/a", { pageSize: 5 }),
      gw.boardPins("parallel-board/a", { pageSize: 5 }),
      gw.boardPins("parallel-board/a", { pageSize: 5 }),
    ]);
    expect(hits).toBe(1);
    expect(a.results.length).toBe(1);
    expect(b.results.length).toBe(1);
    expect(c.results.length).toBe(1);
    expect(gw.stats().coalesced >= 1).toBe(true);
  });

  it("serves repeat reads from cache without refetch", async () => {
    let hits = 0;
    const fakeFetch = async function () {
      hits = hits + 1;
      return new Response(
        JSON.stringify({
          data: [
            {
              pins: [{ id: "7", images: { orig: { url: "https://x/z.jpg" } } }],
            },
          ],
        }),
        { status: 200 },
      );
    } as typeof fetch;
    const gw = createGateway({
      pool: { size: 1, fetch: fakeFetch },
      cache: createMemoryCache(),
    });
    await gw.boardPins("cached-board/b", { pageSize: 5 });
    await gw.boardPins("cached-board/b", { pageSize: 5 });
    expect(hits).toBe(1);
    expect(gw.stats().hits).toBe(1);
  });
});

describe("global limiter", () => {
  it("caps burst throughput", async () => {
    const limiter = new GlobalRateLimiter({
      maxPerSecond: 2,
      maxConcurrent: 10,
    });
    const t0 = Date.now();
    const jobs: Array<Promise<void>> = [];
    for (let i = 0; i < 5; i = i + 1) {
      jobs.push(
        (async function () {
          const release = await limiter.acquire("widgets.pinterest.com");
          release();
        })(),
      );
    }
    await Promise.all(jobs);
    const elapsed = Date.now() - t0;
    expect(elapsed >= 900).toBe(true);
  });
});

describe("netscape import", () => {
  it("feeds pool seeds", () => {
    const text =
      "www.pinterest.com\tFALSE\t/\tTRUE\t0\tcsrftoken\tabc123\n" +
      ".pinterest.com\tTRUE\t/\tTRUE\t0\t_pinterest_sess\tsess999\n";
    const state = createEmptySession();
    const n = importNetscapeCookies(state, text);
    expect(n).toBe(2);
    expect(state.csrftoken).toBe("abc123");
    const gw = createGateway({
      pool: { size: 1, seeds: ["csrftoken=abc123; _pinterest_sess=sess999"] },
    });
    expect(gw.poolSize()).toBe(1);
  });
});

describe("memory cache store", () => {
  it("expires entries", async () => {
    const cache = createMemoryCache({ maxEntries: 10 });
    cache.set("k", { v: 1 }, 30);
    expect(cache.get("k")).toEqual({ v: 1 });
    await new Promise(function (r) {
      setTimeout(r, 60);
    });
    expect(cache.get("k")).toBeNull();
  });
});
