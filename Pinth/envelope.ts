export function readWidget(json: unknown): unknown[] {
  if (json === null || typeof json !== "object") {
    return [];
  }
  const top = json as Record<string, unknown>;
  const data = top["data"];
  if (Array.isArray(data)) {
    return data;
  }
  return [];
}

export function readWidgetRows(json: unknown): unknown[] {
  if (json === null || typeof json !== "object") {
    return [];
  }
  const top = json as Record<string, unknown>;
  const data = top["data"];
  if (Array.isArray(data)) {
    return data;
  }
  if (data !== null && typeof data === "object") {
    return [data];
  }
  return [];
}

export function readFeed(json: unknown): {
  items: unknown[];
  bookmark: string;
} {
  const out = { items: [] as unknown[], bookmark: "" };
  if (json === null || typeof json !== "object") {
    return out;
  }
  const top = json as Record<string, unknown>;
  const envelope = top["resource_response"];
  if (envelope === null || typeof envelope !== "object") {
    return out;
  }
  const body = envelope as Record<string, unknown>;
  const data = body["data"];
  if (data !== null && typeof data === "object") {
    const feed = data as Record<string, unknown>;
    let rawItems: unknown[] = [];
    if (Array.isArray(feed["results"])) {
      rawItems = feed["results"] as unknown[];
    }
    if (rawItems.length === 0 && Array.isArray(feed["pins"])) {
      rawItems = feed["pins"] as unknown[];
    }
    for (const item of rawItems) {
      if (item) {
        out.items.push(item);
      }
    }
    const innerBookmark = pickBookmark(feed);
    if (innerBookmark.length > 0) {
      out.bookmark = innerBookmark;
    }
  }
  if (out.bookmark.length === 0) {
    out.bookmark = pickBookmark(body);
  }
  return out;
}

function pickBookmark(body: Record<string, unknown>): string {
  let marks: unknown[] = [];
  if (Array.isArray(body["bookmarks"])) {
    marks = body["bookmarks"] as unknown[];
  } else if (typeof body["bookmark"] === "string") {
    marks = [body["bookmark"]];
  }
  for (const mark of marks) {
    if (typeof mark === "string" && mark.length > 0 && mark !== "-end-") {
      return mark;
    }
  }
  return "";
}
