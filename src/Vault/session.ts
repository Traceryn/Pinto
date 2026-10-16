import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { SessionState } from "../Shapes/common.js";

export function createEmptySession(): SessionState {
  return { cookies: {}, createdAt: Date.now() };
}

export function cookieHeader(state: SessionState): string {
  const parts: string[] = [];
  const keys = Object.keys(state.cookies);
  for (const key of keys) {
    parts.push(key + "=" + state.cookies[key]);
  }
  return parts.join("; ");
}

export function storeCookies(
  state: SessionState,
  setCookie: string[] | null,
): void {
  if (setCookie === null) {
    return;
  }
  if (setCookie === undefined) {
    return;
  }
  for (const header of setCookie) {
    const pair = header.split(";", 1)[0];
    const idx = pair.indexOf("=");
    if (idx > 0) {
      state.cookies[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
    }
  }
  if (state.cookies["csrftoken"]) {
    state.csrftoken = state.cookies["csrftoken"];
  }
}

export type SaveSession = (state: SessionState) => Promise<void>;

export function setSessionCookies(
  state: SessionState,
  input: string | Record<string, string>,
): void {
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (trimmed.startsWith("{")) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        if (parsed !== null && typeof parsed === "object") {
          mergeCookieObject(state, parsed as Record<string, unknown>);
          syncCsrf(state);
          return;
        }
      } catch {}
    }
    mergeCookieString(state, trimmed);
    syncCsrf(state);
    return;
  }
  mergeCookieObject(state, input);
  syncCsrf(state);
}

function mergeCookieString(state: SessionState, text: string): void {
  if (text.length === 0) {
    return;
  }
  const parts = splitHeaderPairs(text);
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx > 0) {
      const name = part.slice(0, idx).trim();
      const value = cleanCookieValue(part.slice(idx + 1));
      if (name.length > 0 && value.length > 0) {
        state.cookies[name] = value;
      }
    }
  }
}

function splitHeaderPairs(text: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  let braceDepth = 0;
  let bracketDepth = 0;
  for (let i = 0; i < text.length; i = i + 1) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = inQuotes === false;
      current = current + ch;
      continue;
    }
    if (inQuotes === false) {
      if (ch === "{") {
        braceDepth = braceDepth + 1;
      } else if (ch === "}") {
        braceDepth = Math.max(0, braceDepth - 1);
      } else if (ch === "[") {
        bracketDepth = bracketDepth + 1;
      } else if (ch === "]") {
        bracketDepth = Math.max(0, bracketDepth - 1);
      } else if (ch === ";" && braceDepth === 0 && bracketDepth === 0) {
        out.push(current);
        current = "";
        continue;
      }
    }
    current = current + ch;
  }
  if (current.length > 0) {
    out.push(current);
  }
  return out;
}

function cleanCookieValue(raw: string): string {
  let value = raw.trim();
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    value = value.slice(1, -1);
  }
  const decoded = safeDecode(value);
  return decoded.trim();
}

function safeDecode(value: string): string {
  if (value.includes("%") === false) {
    return value;
  }
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function looksLikeStorageState(input: unknown): boolean {
  if (input === null || typeof input !== "object") {
    return false;
  }
  const rec = input as Record<string, unknown>;
  return looksLikeExtensionArray(rec["cookies"]);
}

function mergeCookieObject(
  state: SessionState,
  input: Record<string, unknown>,
): void {
  if (looksLikeStorageState(input)) {
    mergeExtensionArray(
      state,
      (input as Record<string, unknown>)["cookies"] as Array<
        Record<string, unknown>
      >,
    );
    return;
  }
  const keys = Object.keys(input);
  for (const key of keys) {
    if (key === "cookies" || key === "session") {
      const nested = input[key];
      if (nested !== null && typeof nested === "object") {
        mergeCookieObject(state, nested as Record<string, unknown>);
        continue;
      }
    }
    const value = input[key];
    if (typeof value === "string" && value.length > 0) {
      const name = key.trim();
      const cleaned = cleanCookieValue(value);
      if (name.length > 0 && cleaned.length > 0) {
        state.cookies[name] = cleaned;
      }
    }
  }
}

function looksLikeExtensionArray(input: unknown): boolean {
  if (Array.isArray(input) === false) {
    return false;
  }
  const list = input as unknown[];
  if (list.length === 0) {
    return false;
  }
  const first = list[0];
  if (first === null || typeof first !== "object") {
    return false;
  }
  const rec = first as Record<string, unknown>;
  return typeof rec["name"] === "string" && rec["value"] !== undefined;
}

function mergeExtensionArray(
  state: SessionState,
  list: Array<Record<string, unknown>>,
): number {
  let added = 0;
  for (const entry of list) {
    if (entry === null || typeof entry !== "object") {
      continue;
    }
    const name = entry["name"];
    const value = entry["value"];
    if (typeof name === "string" && typeof value === "string") {
      const cleanName = name.trim();
      const cleanValue = cleanCookieValue(value);
      if (cleanName.length > 0 && cleanValue.length > 0) {
        state.cookies[cleanName] = cleanValue;
        added = added + 1;
      }
    }
  }
  return added;
}

function stripSetCookieAttributes(pair: string): string {
  const semi = pair.indexOf(";");
  const first = semi >= 0 ? pair.slice(0, semi) : pair;
  return first.trim();
}

const SET_COOKIE_ATTRS = [
  "path",
  "expires",
  "max-age",
  "domain",
  "secure",
  "httponly",
  "samesite",
  "partitioned",
  "priority",
];

function isAttributePair(name: string): boolean {
  return SET_COOKIE_ATTRS.includes(name.toLowerCase());
}

function splitSetCookieHeaders(text: string): string[] {
  const out: string[] = [];
  let current = "";
  let i = 0;
  while (i < text.length) {
    const comma = text.indexOf(",", i);
    if (comma < 0) {
      current = current + text.slice(i);
      break;
    }
    const tail = text.slice(comma + 1).trimStart();
    const eq = tail.indexOf("=");
    const semi = tail.indexOf(";");
    if (eq > 0 && (semi < 0 || eq < semi)) {
      const candidate = tail.slice(0, eq).trim();
      if (
        candidate.length > 0 &&
        isAttributePair(candidate) === false &&
        /^[A-Za-z0-9_$-]+$/.test(candidate)
      ) {
        out.push(current + text.slice(i, comma));
        current = "";
        i = comma + 1;
        continue;
      }
    }
    current = current + text.slice(i, comma + 1);
    i = comma + 1;
  }
  if (current.trim().length > 0) {
    out.push(current);
  }
  return out;
}

function looksLikeSetCookie(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("path=/") ||
    lower.includes("httponly") ||
    lower.includes("max-age=") ||
    lower.includes("expires=")
  );
}

function importSetCookieText(state: SessionState, text: string): number {
  const lines = text.split(/\r?\n/).join(",");
  const headers = splitSetCookieHeaders(lines);
  let added = 0;
  for (const header of headers) {
    let line = header.trim();
    if (line.toLowerCase().startsWith("set-cookie:")) {
      line = line.slice("set-cookie:".length).trim();
    }
    const pair = stripSetCookieAttributes(line);
    const idx = pair.indexOf("=");
    if (idx > 0) {
      const name = pair.slice(0, idx).trim();
      const value = cleanCookieValue(pair.slice(idx + 1));
      if (
        name.length > 0 &&
        value.length > 0 &&
        isAttributePair(name) === false
      ) {
        state.cookies[name] = value;
        added = added + 1;
      }
    }
  }
  syncCsrf(state);
  return added;
}

function stripHeaderBlockPrefix(text: string): string | null {
  const lines = text.split(/\r?\n/);
  const kept: string[] = [];
  let sawCookieLine = false;
  for (const line of lines) {
    const trimmed = line.trim().replace(/^curl\s+.*-H\s+['"]?/i, "");
    const match = trimmed.match(/^(cookie|set-cookie)\s*:\s*(.*)$/i);
    if (match) {
      sawCookieLine = true;
      kept.push(match[2].replace(/['"]\s*$/, ""));
      continue;
    }
    if (trimmed.length > 0 && /^[A-Za-z-]+\s*:/.test(trimmed)) {
      continue; // drop
    }
    kept.push(trimmed);
  }
  if (sawCookieLine === false) {
    return null;
  }
  return kept.join("; ");
}

export function importCookies(
  state: SessionState,
  input: string | Record<string, string> | Array<Record<string, unknown>>,
): number {
  if (typeof input !== "string") {
    if (Array.isArray(input)) {
      const added = mergeExtensionArray(
        state,
        input as Array<Record<string, unknown>>,
      );
      syncCsrf(state);
      return added;
    }
    if (looksLikeStorageState(input)) {
      const before = Object.keys(state.cookies).length;
      mergeCookieObject(state, input as Record<string, unknown>);
      syncCsrf(state);
      return Object.keys(state.cookies).length - before;
    }
    setSessionCookies(state, input);
    return Object.keys(state.cookies).length;
  }
  const trimmed = input.trim();
  if (trimmed.startsWith("# Netscape") || trimmed.includes("\tcsrftoken\t")) {
    return importNetscapeCookies(state, input);
  }
  if (trimmed.includes("\t")) {
    const probe = parseNetscapeCookies(trimmed);
    if (Object.keys(probe).length > 0) {
      for (const key of Object.keys(probe)) {
        state.cookies[key] = probe[key];
      }
      syncCsrf(state);
      return Object.keys(probe).length;
    }
  }
  const stripped = stripHeaderBlockPrefix(trimmed);
  if (stripped !== null) {
    return importCookies(state, stripped);
  }
  if (looksLikeSetCookie(trimmed)) {
    return importSetCookieText(state, trimmed);
  }
  if (trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (looksLikeExtensionArray(parsed)) {
        return importCookies(state, parsed as Array<Record<string, unknown>>);
      }
    } catch {}
  }
  if (trimmed.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed !== null && typeof parsed === "object") {
        const before = Object.keys(state.cookies).length;
        mergeCookieObject(state, parsed as Record<string, unknown>);
        syncCsrf(state);
        return Object.keys(state.cookies).length - before;
      }
    } catch {}
  }
  const before = Object.keys(state.cookies).length;
  setSessionCookies(state, input);
  return Object.keys(state.cookies).length - before;
}

function syncCsrf(state: SessionState): void {
  if (state.cookies["csrftoken"]) {
    state.csrftoken = state.cookies["csrftoken"];
  }
}

export function hasCredentials(state: SessionState): boolean {
  if (state.csrftoken === undefined || state.csrftoken.length === 0) {
    return false;
  }
  const sess = state.cookies["_pinterest_sess"];
  if (sess !== undefined && sess.length > 0) {
    return true;
  }
  const auth = state.cookies["_auth"];
  return auth !== undefined && auth.length > 0;
}

export function parseNetscapeCookies(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }
    const fields = trimmed.split("\t");
    if (fields.length < 7) {
      continue;
    }
    const name = fields[5];
    let value = fields.slice(6).join("\t");
    if (name.length === 0) {
      continue;
    }
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    try {
      value = decodeURIComponent(value);
    } catch {}
    out[name] = value;
  }
  return out;
}

export function importNetscapeCookies(
  state: SessionState,
  text: string,
): number {
  const parsed = parseNetscapeCookies(text);
  const keys = Object.keys(parsed);
  for (const key of keys) {
    state.cookies[key] = parsed[key];
  }
  syncCsrf(state);
  return keys.length;
}

export async function loadNetscapeFile(
  path: string,
): Promise<Record<string, string>> {
  const raw = await readFile(path, "utf8");
  return parseNetscapeCookies(raw);
}

export async function useFileSession(
  dir: string,
): Promise<{ state: SessionState; saveSession: SaveSession }> {
  await mkdir(dir, { recursive: true });
  const file = join(dir, "session.json");
  let state = createEmptySession();
  try {
    const raw = await readFile(file, "utf8");
    state = { ...createEmptySession(), ...JSON.parse(raw) };
  } catch {}
  const saveSession: SaveSession = async (next) => {
    await writeFile(file, JSON.stringify(next, null, 2), "utf8");
  };
  return { state, saveSession };
}

export function useMemorySession(initial?: Partial<SessionState>): {
  state: SessionState;
  saveSession: SaveSession;
} {
  const state: SessionState = { ...createEmptySession(), ...initial };
  return { state, saveSession: async () => {} };
}
