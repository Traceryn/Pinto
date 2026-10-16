import {
  BASE_URL,
  bootstrapHeaders,
  widgetHeaders,
  apiHeaders,
  resourceEndpointUrl,
} from "../../Pinth/index.js";
import { cookieHeader, storeCookies } from "../Vault/session.js";
import { deviceOf } from "../Vault/device.js";
import type { SessionState } from "../Shapes/common.js";
import {
  CACHE_MAX_ENTRIES,
  CACHE_TTL_MS,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_TRIES,
  JITTER_MAX_MS,
  MIN_REQUEST_GAP_MS,
  RETRY_BASE_MS,
  RETRY_MAX_MS,
} from "../Config/index.js";
import {
  NetworkError,
  PintoError,
  RateLimitError,
  errorForStatus,
} from "../Errors/index.js";

interface Transport {
  fetchImpl: typeof fetch;
  lastCallAt: number;
  namespace: string;
  tail: Promise<void>;
}

const transports = new WeakMap<SessionState, Transport>();
let namespaceSeq = 0;

function transportFor(session: SessionState): Transport {
  let transport = transports.get(session);
  if (transport === undefined) {
    namespaceSeq = namespaceSeq + 1;
    transport = {
      fetchImpl: fetch,
      lastCallAt: 0,
      namespace: "s" + namespaceSeq,
      tail: Promise.resolve(),
    };
    transports.set(session, transport);
  }
  return transport;
}

export function configureTransport(
  session: SessionState,
  options: { fetchImpl?: typeof fetch } | undefined,
): void {
  const transport = transportFor(session);
  if (options !== undefined && options.fetchImpl !== undefined) {
    transport.fetchImpl = options.fetchImpl;
  }
}

export function sessionFetch(session: SessionState): typeof fetch {
  return transportFor(session).fetchImpl;
}

async function throttle(
  session: SessionState,
  baseGapMs: number,
): Promise<void> {
  if (baseGapMs <= 0) {
    return;
  }
  const jitter = Math.floor(Math.random() * JITTER_MAX_MS);
  const gapMs = baseGapMs + jitter;
  const transport = transportFor(session);

  const run = transport.tail.then(async function () {
    const now = Date.now();
    const since = now - transport.lastCallAt;
    if (since < gapMs) {
      await sleep(gapMs - since);
    }
    transport.lastCallAt = Date.now();
  });
  transport.tail = run.catch(function () {});
  await run;
}

function sleep(ms: number): Promise<void> {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

interface CacheEntry {
  value: unknown;
  at: number;
}

const cache = new Map<string, CacheEntry>();

function cacheGet(key: string, ttlMs: number): unknown | null {
  const entry = cache.get(key);
  if (entry === undefined) {
    return null;
  }
  if (Date.now() - entry.at > ttlMs) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cachePut(key: string, value: unknown): void {
  if (cache.has(key)) {
    cache.delete(key);
  }
  cache.set(key, { value: value, at: Date.now() });
  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) {
      break;
    }
    cache.delete(oldest);
  }
}

export function clearCache(): void {
  cache.clear();
}

function backoffMs(attempt: number): number {
  const base = RETRY_BASE_MS * Math.pow(2, attempt);
  const capped = Math.min(base, RETRY_MAX_MS);
  const jitter = Math.floor(Math.random() * RETRY_BASE_MS);
  return capped + jitter;
}

function isRetryable(err: unknown): boolean {
  if (err instanceof RateLimitError) {
    return true;
  }
  if (err instanceof NetworkError) {
    return true;
  }
  if (err instanceof PintoError) {
    return err.status === 429 || err.status === 403 || err.status >= 500;
  }
  return false;
}

function getSetCookieList(headers: Headers): string[] {
  const holder = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof holder.getSetCookie === "function") {
    return holder.getSetCookie();
  }
  const single = headers.get("set-cookie");
  if (single) {
    return [single];
  }
  return [];
}

function retryAfterMs(headers: Headers): number | undefined {
  const raw = headers.get("retry-after");
  if (raw === null) {
    return undefined;
  }
  const seconds = Number.parseInt(raw, 10);
  if (Number.isNaN(seconds) === false && seconds >= 0) {
    return seconds * 1000;
  }
  return undefined;
}

export async function ensureSession(session: SessionState): Promise<void> {
  if (session.csrftoken) {
    return;
  }
  await throttle(session, MIN_REQUEST_GAP_MS);
  const device = deviceOf(session);
  let response: Response;
  try {
    response = await transportFor(session).fetchImpl(BASE_URL, {
      headers: bootstrapHeaders(device),
    });
  } catch (err) {
    throw new NetworkError("Failed to bootstrap session cookies", err);
  }
  const list = getSetCookieList(response.headers);
  storeCookies(session, list);
  try {
    await response.arrayBuffer();
  } catch {}
}

function resourceHeaders(
  session: SessionState,
  sourceUrl: string,
  handler: string,
): Record<string, string> {
  const device = deviceOf(session);
  const headers = apiHeaders(
    device,
    cookieHeader(session),
    session.csrftoken ? session.csrftoken : "",
  );
  headers["Referer"] = "https://www.pinterest.com" + sourceUrl;
  headers["X-Pinterest-PWS-Handler"] = handler;
  return headers;
}

async function postResourceOnce(
  session: SessionState,
  resourcePath: string,
  options: Record<string, unknown>,
  sourceUrl: string,
  save: () => Promise<void>,
): Promise<unknown> {
  await throttle(session, MIN_REQUEST_GAP_MS);
  const headers = resourceHeaders(session, sourceUrl, resourcePath);
  const payload = JSON.stringify({ options: options });
  const body = new URLSearchParams();
  body.set("source_url", sourceUrl);
  body.set("data", payload);
  const url = resourceEndpointUrl(resourcePath);
  const controller = new AbortController();
  const timer = setTimeout(function () {
    controller.abort();
  }, DEFAULT_TIMEOUT_MS);
  let response: Response;
  try {
    response = await transportFor(session).fetchImpl(url, {
      method: "POST",
      headers: headers,
      body: body.toString(),
      signal: controller.signal,
    });
  } catch (err) {
    throw new NetworkError("Resource request did not complete", err);
  } finally {
    clearTimeout(timer);
  }
  const list = getSetCookieList(response.headers);
  storeCookies(session, list);
  await save();

  if (response.ok === false) {
    const text = await response.text().catch(function () {
      return "";
    });
    if (response.status === 429) {
      throw new RateLimitError(
        "Rate limited by Pinterest",
        retryAfterMs(response.headers),
      );
    }
    throw errorForStatus(
      response.status,
      "Request failed with status " +
        response.status +
        ": " +
        text.slice(0, 120),
    );
  }

  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export async function callResource(
  session: SessionState,
  resourcePath: string,
  options: Record<string, unknown>,
  sourceUrl: string,
  save: () => Promise<void>,
): Promise<unknown> {
  await ensureSession(session);
  const cacheKey =
    transportFor(session).namespace +
    ":res:" +
    resourcePath +
    ":" +
    sourceUrl +
    ":" +
    JSON.stringify(options);
  const cached = cacheGet(cacheKey, CACHE_TTL_MS);
  if (cached !== null) {
    return cached;
  }
  let attempt = 0;
  let lastError: unknown;
  while (attempt < DEFAULT_TRIES) {
    try {
      const result = await postResourceOnce(
        session,
        resourcePath,
        options,
        sourceUrl,
        save,
      );
      if (result !== null) {
        cachePut(cacheKey, result);
      }
      return result;
    } catch (err) {
      lastError = err;
      if (isRetryable(err) === false || attempt >= DEFAULT_TRIES - 1) {
        throw err;
      }
      const wait = backoffMs(attempt);
      const hint = err instanceof RateLimitError ? err.retryAfterMs : undefined;
      await sleep(hint !== undefined ? hint : wait);
      attempt = attempt + 1;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new NetworkError("Resource request failed after retries");
}

export async function fetchWidgetJson(
  session: SessionState,
  url: string,
): Promise<unknown | null> {
  const cacheKey = transportFor(session).namespace + ":wid:" + url;
  const cached = cacheGet(cacheKey, CACHE_TTL_MS);
  if (cached !== null) {
    return cached;
  }
  await throttle(session, MIN_REQUEST_GAP_MS);
  const device = deviceOf(session);
  const controller = new AbortController();
  const timer = setTimeout(function () {
    controller.abort();
  }, DEFAULT_TIMEOUT_MS);
  try {
    const response = await transportFor(session).fetchImpl(url, {
      headers: widgetHeaders(device, cookieHeader(session)),
      signal: controller.signal,
    });
    if (response.ok === false) {
      return null;
    }
    const text = await response.text();
    try {
      const parsed = JSON.parse(text) as unknown;
      cachePut(cacheKey, parsed);
      return parsed;
    } catch {
      return null;
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
