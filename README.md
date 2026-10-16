<img alt="Pinto logo" src="https://raw.githubusercontent.com/Traceryn/tiktok-sdk/master/media/Traceryn.png" height="85"/>

# **_Pinto_**

An unofficial TypeScript/JavaScript API for interacting with Pinterest.

---

<div align='center'>
  <a href='#install'>Install</a> •
  <a href='#quick-start'>Quick start</a> •
  <a href='#index'>Docs</a> •
  <a href='#sponsor'>Sponsor</a> •
  <a href='#disclaimer'>Disclaimer</a>
</div>

> [!IMPORTANT]
> **Status: pre-release.** Pinto is under active development and the public API
> may still change before `1.0.0`. The read surface (`getPin`, `getUser`,
> `getBoard`, `search`, media downloads) is stable and covered by a live test
> suite. Pin your version in production.
>
> Use the stable version: `npm install @traceryn/pinto`

---

## Sponsor

If you'd like to financially support this project, you can do so by supporting the current maintainer [here](https://github.com/sponsors/Corex24).

---

## Why Pinto

- **No browser required.** Pinto talks to Pinterest's public widget and resource
  endpoints directly over `fetch`. No Selenium, no Puppeteer, no half-gig of RAM
  spent driving Chromium.
- **Read-only by design.** It fetches public pins, boards, profiles and search
  results — nothing more. It never posts, follows, or messages on your behalf.
- **Anonymous out of the box.** Every request is fingerprinted as a real device —
  a stable, randomly-selected browser profile (UA, `Accept-Language`,
  `sec-ch-ua`) is generated per session so each client reads as a distinct device
  rather than a single flagged scraper.
- **Built to scale.** A `SessionPool`, a shared `CacheStore`, a global rate
  limiter, and a coalescing `Gateway` turn one upstream request into thousands of
  served reads. Bring your own Redis to share across processes.
- **First-class TypeScript.** Fully typed public surface, ESM + CJS builds.

## Install

```bash
npm install @traceryn/pinto
# or
yarn add @traceryn/pinto
```

Then import:

```ts
import { createPinto } from "@traceryn/pinto";
```

## Quick start

```ts
import { createPinto } from "@traceryn/pinto";

const pinto = createPinto();

// Read a pin — accepts a full URL, a /pin/<id>/ path, a short link, or a bare ID.
const pin = await pinto.getPin("https://pin.it/67v3VVvF2");
console.log(pin.id, pin.image, pin.isVideo ? "video" : "image");

// Read a profile.
const user = await pinto.getUser("https://www.pinterest.com/Corex2410/");
console.log(user.username, user.followers);

// Read a board and its pins.
const board = await pinto.getBoard(
  "https://www.pinterest.com/Corex2410/black-white-symbols/",
);
const pins = await pinto.boardPins(board.url, { pageSize: 50 });
console.log(board.name, pins.results.length, pins.hasMore);
```

Do check out and run [`Example/example.ts`](Example/example.ts) to see the full
flow. To run it:

1. `cd path/to/Pinto`
2. `npm install`
3. `npm run example`

# Index

- [Reading Pins](#reading-pins)
- [Reading Users](#reading-users)
- [Reading Boards](#reading-boards)
- [Search](#search)
- [Downloading Media](#downloading-media)
- [Media Formats](#media-formats)
- [Authentication & Sessions](#authentication--sessions)
- [Saving & Restoring Sessions](#saving--restoring-sessions)
- [Cookie Import Formats](#cookie-import-formats)
- [Device Fingerprinting](#device-fingerprinting)
- [Scaling: Gateway, Pool, Cache, Limiter](#scaling-gateway-pool-cache-limiter)
- [Proxies & Custom Fetch](#proxies--custom-fetch)
- [Error Handling](#error-handling)
- [Configuration](#configuration)
- [Disclaimer](#disclaimer)
- [License](#license)

## Reading Pins

`getPin` accepts almost any Pinterest reference — a full URL, a short link
(`pin.it/...`), a `/pin/<id>/` path, a regional host (`br.pinterest.com/...`),
or a bare pin ID.

```ts
const pin = await pinto.getPin(
  "https://www.pinterest.com/pin/1060738518503398158/",
);

pin.id; // "1060738518503398158"
pin.title; // ""
pin.description; // "..."
pin.image; // highest-resolution image URL
pin.images; // [{ url, width?, height? }, ...] sorted largest-first
pin.isVideo; // true for video / story pins
pin.video; // best .mp4 URL (empty for plain image pins)
pin.link; // outbound link, if the pinner attached one
pin.domain; // source domain, if any
pin.altText; // SEO / auto alt text, if present
pin.createdAt; // epoch ms, if present
pin.pinner; // { id?, username?, fullName?, image? }
pin.board; // { id?, name?, url? }
```

A deleted or unknown pin throws `NotFoundError` — see [Error Handling](#error-handling).

## Reading Users

```ts
const user = await pinto.getUser("https://www.pinterest.com/Corex2410/");

user.username; // "Corex2410"
user.id; // internal numeric id
user.fullName; // display name
user.bio; // profile "about" text
user.followers; // follower count
user.pinsCount; // number of pins
user.image; // avatar URL

// A user's most recent pins.
const pins = await pinto.userPins("Corex2410", { pageSize: 25 });
pins.results; // Pin[]
pins.hasMore; // widget feeds don't paginate, so this is always false
```

## Reading Boards

```ts
const board = await pinto.getBoard(
  "https://www.pinterest.com/Corex2410/black-white-symbols/",
);

board.id; // internal id
board.name; // "black-white-symbols"
board.description;
board.url; // canonical https://www.pinterest.com/... URL
board.pinsCount;
board.followers;
board.image; // board thumbnail

// Pins on the board.
const pins = await pinto.boardPins(board.url, { pageSize: 50 });
```

## Search

Search returns a real paginated feed (unlike the board/user widgets), so it
supports bookmarks and streaming via `searchAll`.

```ts
// Pins (default scope).
const pins = await pinto.searchPins("cats", { pageSize: 25 });

// Scoped search: pins | boards | users | videos.
const boards = await pinto.search("home decor", { scope: "boards" });
const users = await pinto.search("design", { scope: "users" });
const videos = await pinto.search("recipe", { scope: "videos" });

// Manual pagination with the bookmark from the previous page.
const page2 = await pinto.search("cats", {
  pageSize: 25,
  bookmark: pins.bookmark,
});

// Stream every result across pages with an async generator.
for await (const pin of pinto.searchAll("cats", "pins", 25)) {
  console.log(pin.id, pin.image);
}
```

## Downloading Media

Media downloads reuse the same session (device fingerprint, cookies, custom
`fetch`), so the whole client egresses from one identity.

```ts
import { downloadPinImage, downloadPinVideo } from "@traceryn/pinto";
import { writeFile } from "node:fs/promises";

// Bytes.
const imageBytes = await downloadPinImage(pinto.session, pin.url);
await writeFile("pin.jpg", imageBytes);

const videoBytes = await downloadPinVideo(pinto.session, videoPin.url);
await writeFile("pin.mp4", videoBytes);

// Or get the format alongside the bytes, so you can name files correctly.
import { downloadImageWithFormat, filenameForPin } from "@traceryn/pinto";

const asset = await downloadImageWithFormat(pinto.session, pin.url);
asset.bytes; // Buffer
asset.contentType; // "image/jpeg"
asset.format; // "jpg"
const name = filenameForPin(pin.id, pin.image, asset.format);
await writeFile(name, asset.bytes);
```

## Media Formats

Pinto supports every image and video format Pinterest serves:

| Type  | Formats                       |
| ----- | ----------------------------- |
| Image | `jpg` / `jpeg`, `png`, `webp` |
| Video | `mp4`, `mov`, `m4v`           |

Format detection is three-tier and never guesses from the URL alone — Pinterest
image URLs often have no extension:

1. the response `Content-Type` header,
2. the file extension in the URL,
3. the file's magic bytes (JPEG `FF D8 FF`, PNG header, WebP `RIFF…WEBP`,
   MP4 `ftyp`).

```ts
import { detectFormat, isSupportedImageFormat } from "@traceryn/pinto";

detectFormat(url, "image/jpeg"); // "jpg"
isSupportedImageFormat("webp"); // true
```

## Authentication & Sessions

Anonymous reads work immediately, but a real logged-in session gets its own
per-account quota and looks like an ordinary browser. Bring your own cookies:

```ts
const pinto = createPinto();

// 1. Log into pinterest.com in your own browser.
// 2. DevTools -> Network, copy any request's "Cookie" header value.
// 3. Paste it:
await pinto.setCookies("_pinterest_sess=...; csrftoken=...; ...");

console.log(pinto.isAuthenticated()); // true
```

> [!CAUTION]
> Treat cookies like passwords. Never commit them, never expose them to end
> users, and store them encrypted server-side.

## Saving & Restoring Sessions

Persist the session so credentials survive restarts, using `useFileSession` (a
good guide for writing a Redis/Postgres store):

```ts
import { createPinto, useFileSession } from "@traceryn/pinto";

const { state, saveSession } = await useFileSession("./.pinto-session");

const pinto = createPinto({
  session: state,
  saveSession: (s) => saveSession(s), // called after cookies change
});
```

For an in-memory session (tests, short-lived jobs):

```ts
import { createPinto, useMemorySession } from "@traceryn/pinto";

const { state, saveSession } = useMemorySession();
const pinto = createPinto({ session: state, saveSession });
```

### Multi-tenant (one client per end user)

Every client is fully isolated — device fingerprint, rate budget, cache
namespace, cookies and `fetch` all hang off the session object:

```ts
function clientForUser(user) {
  return createPinto({
    session: user.pintoSession,
    saveSession: (s) => db.save(user.id, s),
  });
}
```

## Cookie Import Formats

`importCookies` auto-detects the paste shape, so devs can use whatever their
browser or exporter gives them:

```ts
import { createEmptySession, importCookies } from "@traceryn/pinto";

const session = createEmptySession();

// 1. Raw Cookie header (DevTools -> Network -> copy "Cookie" value).
//    Handles "...", %-encoding, and ";" inside JSON values (g_state).
importCookies(session, "csrftoken=...; _pinterest_sess=...; g_state={...}");

// 2. Browser-extension JSON array: [{ name, value, domain, ... }, ...]
importCookies(session, extensionExportJson);

// 3. cookies.txt (Netscape / curl format, tab-separated).
importCookies(session, await readFile("./cookies.txt", "utf8"));
```

## Device Fingerprinting

Every session is fingerprinted as a real, distinct device. On first use a stable
browser profile is generated and stored on the session, so a given client always
sends the same identity — but different clients look like different devices:

- a `User-Agent` (Chrome / Firefox / Edge / Safari / Opera, Windows / macOS /
  Linux / Android / iOS),
- a matching `Accept-Language`,
- and consistent `sec-ch-ua`, `sec-ch-ua-mobile`, `sec-ch-ua-platform` headers.

This is what lets thousands of anonymous readers avoid tripping a single global
fingerprint. You can also inject a fixed `fetch` (see below) to pin a session to
one egress IP.

## Scaling: Gateway, Pool, Cache, Limiter

For high traffic, don't point every request at Pinterest directly. Wrap reads in
a `Gateway`, which adds four things on top of a plain client:

- a **SessionPool** — N sessions round-robin, least-loaded checkout, automatic
  cooldown when a slot is rate-limited or blocked,
- a **CacheStore** — repeat reads are served from cache, never re-fetched,
- a **GlobalRateLimiter** — caps per-host throughput across every slot,
- **request coalescing** — N parallel identical reads trigger exactly one
  upstream fetch.

```ts
import {
  createGateway,
  createMemoryCache,
  GlobalRateLimiter,
} from "@traceryn/pinto";

const gateway = createGateway({
  pool: { size: 8 }, // 8 pooled sessions
  cache: createMemoryCache(), // swap for Redis in prod
  limiter: new GlobalRateLimiter({ maxPerSecond: 8 }), // cap egress
});

const pin = await gateway.getPin("https://pin.it/67v3VVvF2"); // shared across users

gateway.stats(); // { hits, misses, coalesced, failures }
gateway.poolSize(); // 8
```

```ts
import { SessionPool } from "@traceryn/pinto";

// Seed the pool with your own accounts (never end-user cookies).
const pool = new SessionPool({
  size: 4,
  seeds: [myCookieHeader1, myCookieHeader2 /* ... */],
});
```

> [!NOTE]
> The in-memory cache and limiter are per-process. To share state across many
> processes/regions, implement the `CacheStore` interface with Redis and inject
> it via `createGateway({ cache })`.

## Proxies & Custom Fetch

Route a client through your own egress IP by injecting a `fetch`:

```ts
import { ProxyAgent, fetch as undiciFetch } from "undici";

const agent = new ProxyAgent("http://user:pass@proxy-host:8080");

const pinto = createPinto({
  fetch: (url, init) => undiciFetch(url, { ...init, dispatcher: agent }),
});
```

Media downloads use the same injected `fetch`, so the whole client egresses from
one identity.

## Error Handling

All errors extend `PintoError` and carry a `status` and a `code`:

```ts
import {
  PintoError,
  NotFoundError, // 404 — pin/board/user doesn't exist
  BlockedError, // 403 — Pinterest blocked the request
  RateLimitError, // 429 — throttled; carries retryAfterMs
  NetworkError, // network-level failure; carries cause
  ParseError, // response couldn't be parsed
  errorForStatus,
} from "@traceryn/pinto";

try {
  await pinto.getPin(url);
} catch (err) {
  if (err instanceof NotFoundError) {
    // handle missing pin
  } else if (err instanceof RateLimitError) {
    // back off for err.retryAfterMs
  } else if (err instanceof BlockedError) {
    // cool this session down / rotate the pool slot
  } else if (err instanceof PintoError) {
    // err.status, err.code
  }
}
```

## Configuration

| Constant             | Default | Meaning                                       |
| -------------------- | ------- | --------------------------------------------- |
| `DEFAULT_PAGE_SIZE`  | `25`    | Default `pageSize` for feeds                  |
| `MAX_PAGE_SIZE`      | `100`   | Largest `pageSize` a single request accepts   |
| `DEFAULT_TIMEOUT_MS` | `20000` | Per-request timeout                           |
| `DEFAULT_TRIES`      | `3`     | Retries on transient failures                 |
| `MIN_REQUEST_GAP_MS` | `150`   | Minimum gap between requests (anti-detection) |
| `CACHE_TTL_MS`       | `60000` | Default gateway cache TTL                     |

## Disclaimer

Pinto is not affiliated, associated, authorized, endorsed by, or in any way
officially connected with Pinterest or any of its subsidiaries or affiliates.
The official Pinterest website can be found at [pinterest.com](https://pinterest.com).
"Pinterest", as well as related names, marks, emblems and images are registered
trademarks of their respective holders.

The maintainers of Pinto do not in any way condone the use of this application
in practices that violate the Terms of Service of Pinterest. The maintainers of
this application call upon the personal responsibility of its users to use this
application in a fair way, as it is intended to be used. Use at your own
discretion.

This is a read-only research tool. It does not post, message, or otherwise act on
your behalf, and it is not intended for spam, bulk abuse, or circumventing
Pinterest's protections at scale.

## License

MIT License

Copyright (c) 2026 Corex Anthony

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Thus, the maintainers of the project can't be held liable for any potential
misuse of this project.
