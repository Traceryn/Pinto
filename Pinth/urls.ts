export const PRIMARY_HOST = "www.pinterest.com";

const KNOWN_TLDS = [
  "com",
  "co.uk",
  "ca",
  "fr",
  "de",
  "es",
  "it",
  "pt",
  "jp",
  "kr",
  "ru",
  "br",
  "com.au",
  "mx",
  "nz",
  "ie",
  "at",
  "ch",
  "nl",
  "be",
  "dk",
  "se",
  "no",
  "fi",
  "pl",
  "cz",
  "gr",
  "hu",
  "ro",
  "tr",
  "in",
  "sg",
  "hk",
  "my",
  "ph",
  "id",
  "vn",
  "th",
  "ar",
  "cl",
  "co",
  "ve",
  "ua",
];

const RESERVED_SEGMENTS = [
  "pins",
  "boards",
  "followers",
  "following",
  "saved",
  "ideas",
  "search",
  "today",
  "login",
  "signup",
  "settings",
  "about",
  "business",
  "create",
  "pin",
  "resource",
  "categories",
  "topics",
];

export type PinterestRef =
  | { kind: "pin"; id: string; url: string }
  | { kind: "user"; username: string; url: string }
  | { kind: "board"; username: string; slug: string; url: string }
  | { kind: "unknown"; url: string };

export function isPinterestHost(host: string): boolean {
  const lower = host.toLowerCase();
  if (lower === "pinterest.com" || lower === "www.pinterest.com") {
    return true;
  }
  const marker = "pinterest.";
  let at = lower.indexOf(marker);
  while (at >= 0) {
    if (at === 0 || lower.charAt(at - 1) === ".") {
      const after = lower.slice(at + marker.length);

      return KNOWN_TLDS.includes(after);
    }
    at = lower.indexOf(marker, at + 1);
  }
  return false;
}

export function canonicalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return "";
  }
  let parsed: URL;
  try {
    parsed = new URL(
      trimmed.startsWith("http") ? trimmed : "https://" + trimmed,
    );
  } catch {
    return trimmed;
  }
  if (isPinterestHost(parsed.hostname) === false) {
    return trimmed;
  }
  const path = stripTrailingSlash(parsed.pathname);
  return "https://" + PRIMARY_HOST + (path.length > 0 ? path : "");
}

function stripTrailingSlash(path: string): string {
  let out = path;
  while (out.length > 1 && out.endsWith("/")) {
    out = out.slice(0, -1);
  }
  return out;
}

function isReserved(segment: string): boolean {
  return RESERVED_SEGMENTS.includes(segment.toLowerCase());
}

function segmentsOf(path: string): string[] {
  return path.split("/").filter(function (part) {
    return part.length > 0;
  });
}

export function toPath(input: string): string {
  let trimmed = input.trim();
  if (trimmed.startsWith("http")) {
    try {
      const parsed = new URL(trimmed);
      if (isPinterestHost(parsed.hostname)) {
        return parsed.pathname;
      }
      return "/";
    } catch {}
  }
  if (trimmed.startsWith("/")) {
    const cutAt = trimmed.search(/[?#]/);
    if (cutAt >= 0) {
      trimmed = trimmed.slice(0, cutAt);
    }
    return trimmed;
  }
  const hostAt = trimmed.toLowerCase().indexOf("pinterest.");
  if (hostAt >= 0) {
    const cutAt = trimmed.search(/[?#]/);
    if (cutAt >= 0) {
      trimmed = trimmed.slice(0, cutAt);
    }
    const slash = trimmed.indexOf("/", hostAt);
    return slash >= 0 ? trimmed.slice(slash) : "/";
  }
  return "/" + trimmed;
}

export function isShortLink(input: string): boolean {
  const trimmed = input.trim().toLowerCase();
  const withoutProto = trimmed.replace(/^https?:\/\//, "");
  const host = withoutProto.split(/[/?#]/, 1)[0];
  return host === "pin.it" || host === "www.pin.it";
}

export async function resolveShortLink(
  input: string,
  fetchImpl?: typeof fetch,
): Promise<string> {
  const trimmed = input.trim();
  if (isShortLink(trimmed) === false) {
    return trimmed;
  }
  const run = fetchImpl !== undefined ? fetchImpl : fetch;
  try {
    const response = await run(trimmed, {
      method: "HEAD",
      redirect: "follow",
    });
    if (response.url.length > 0 && response.url !== trimmed) {
      return response.url;
    }
  } catch {}
  try {
    const response = await run(
      "https://api.pinterest.com/url_shortener/" +
        trimmed
          .split("/")
          .filter(function (p) {
            return p.length > 0;
          })
          .pop() +
        "/redirect/",
      { method: "HEAD", redirect: "follow" },
    );
    if (response.url.length > 0) {
      return response.url;
    }
  } catch {}
  return trimmed;
}

export function extractPinId(input: string): string {
  const raw = input.trim();
  if (raw.length === 0) {
    return "";
  }
  if (/^[0-9]+$/.test(raw)) {
    return raw;
  }
  const parts = segmentsOf(toPath(raw));
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === "pin" && i + 1 < parts.length) {
      const candidate = parts[i + 1];
      if (/^[0-9]+$/.test(candidate)) {
        return candidate;
      }
    }
  }
  for (const part of parts) {
    if (/^[0-9]{6,}$/.test(part)) {
      return part;
    }
  }
  return "";
}

export function extractUsername(input: string): string {
  const parts = segmentsOf(toPath(input));
  if (parts.length === 0) {
    return "";
  }
  const first = parts[0];
  if (isReserved(first) || /^[0-9]+$/.test(first)) {
    return "";
  }
  return first;
}

export function extractBoardSlug(input: string): string {
  const parts = segmentsOf(toPath(input));
  if (parts.length < 2) {
    return "";
  }
  const owner = parts[0];
  const slug = parts[1];
  if (isReserved(owner) || isReserved(slug)) {
    return "";
  }
  if (/^[0-9]+$/.test(owner)) {
    return "";
  }
  return owner + "/" + slug;
}

export function parsePinterestRef(input: string): PinterestRef | null {
  const raw = input.trim();
  if (raw.length === 0) {
    return null;
  }

  if (raw.startsWith("http")) {
    try {
      const parsed = new URL(raw);
      if (isPinterestHost(parsed.hostname) === false) {
        return { kind: "unknown", url: canonicalizeUrl(raw) };
      }
    } catch {}
  }
  const pinId = extractPinId(raw);
  if (pinId.length > 0) {
    return { kind: "pin", id: pinId, url: pinPageUrl(pinId) };
  }
  const board = extractBoardSlug(raw);
  if (board.length > 0) {
    const cut = board.indexOf("/");
    const username = board.slice(0, cut);
    const slug = board.slice(cut + 1);
    return {
      kind: "board",
      username: username,
      slug: slug,
      url: boardPageUrl(username, slug),
    };
  }
  const username = extractUsername(raw);
  if (username.length > 0 && username.includes(".") === false) {
    return { kind: "user", username: username, url: userPageUrl(username) };
  }
  return { kind: "unknown", url: canonicalizeUrl(raw) };
}

export function cleanId(input: string): string {
  return extractPinId(input);
}

export function cleanUsername(input: string): string {
  const raw = input.trim();
  if (raw.startsWith("@")) {
    return raw.slice(1);
  }
  if (
    raw.startsWith("http") ||
    raw.includes("/") ||
    raw.includes("pinterest.")
  ) {
    return extractUsername(raw);
  }
  return raw;
}

export function cleanSlug(input: string): string {
  const raw = input.trim();
  if (
    raw.startsWith("http") ||
    raw.includes("pinterest.") ||
    raw.startsWith("/")
  ) {
    return extractBoardSlug(raw);
  }
  const parts = segmentsOf(raw);
  if (parts.length >= 2) {
    return parts[0] + "/" + parts[1];
  }
  return raw;
}

export function pinPageUrl(id: string): string {
  return "https://" + PRIMARY_HOST + "/pin/" + id + "/";
}

export function userPageUrl(username: string): string {
  return "https://" + PRIMARY_HOST + "/" + username + "/";
}

export function boardPageUrl(username: string, slug: string): string {
  return "https://" + PRIMARY_HOST + "/" + username + "/" + slug + "/";
}

export function resourceEndpointUrl(handler: string): string {
  const clean = handler.startsWith("/") ? handler.slice(1) : handler;
  const withSlash = clean.endsWith("/") ? clean : clean + "/";
  return "https://www.pinterest.com/resource/" + withSlash;
}

export function widgetBase(): string {
  return "https://widgets.pinterest.com";
}

export function widgetPinInfoUrl(ids: string[]): string {
  const params = new URLSearchParams();
  params.set("pin_ids", ids.join(","));
  params.set("sub", "www");
  params.set("base_sdx", "www");
  return widgetBase() + "/v3/pidgets/pins/info/?" + params.toString();
}

export function widgetUserPinsUrl(username: string, size: number): string {
  const params = new URLSearchParams();
  params.set("w", String(clampSize(size)));
  return (
    widgetBase() +
    "/v3/pidgets/users/" +
    encodeURIComponent(username) +
    "/pins/?" +
    params.toString()
  );
}

export function widgetBoardPinsUrl(
  owner: string,
  slug: string,
  size: number,
): string {
  const path = encodeURIComponent(owner) + "/" + encodeURIComponent(slug);
  const params = new URLSearchParams();
  params.set("w", String(clampSize(size)));
  return (
    widgetBase() + "/v3/pidgets/boards/" + path + "/pins/?" + params.toString()
  );
}

export function searchSourceUrl(scope: string, query: string): string {
  const folder = scope === "pins" ? "pins" : scope;
  return "/search/" + folder + "/?q=" + encodeURIComponent(query);
}

function clampSize(size: number): number {
  if (Number.isFinite(size) === false) {
    return 25;
  }
  const rounded = Math.floor(size);
  if (rounded < 1) {
    return 1;
  }
  if (rounded > 100) {
    return 100;
  }
  return rounded;
}
