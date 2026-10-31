import { RESOURCES, readFeed, searchSourceUrl } from "../../Pinth/index.js";
import { callResource } from "../Client/client.js";
import { toPin } from "../Harvest/index.js";
import type { Page, PagingOptions, SessionState } from "../Shapes/common.js";
import type { Pin } from "../Shapes/pins.js";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../Config/index.js";

export type SearchScope = "pins" | "boards" | "users" | "videos";

function sizeOf(options: PagingOptions | undefined): number {
  if (options && typeof options.pageSize === "number") {
    const size = Math.floor(options.pageSize);
    if (size < 1) {
      return 1;
    }
    return size > MAX_PAGE_SIZE ? MAX_PAGE_SIZE : size;
  }
  return DEFAULT_PAGE_SIZE;
}

function cursorOf(options: PagingOptions | undefined): string {
  if (options && typeof options.cursor === "string") {
    return options.cursor;
  }
  return "";
}

function limitOf(options: PagingOptions | undefined): number | undefined {
  if (options && typeof options.limit === "number") {
    const n = Math.floor(options.limit);
    if (n > 0) {
      return n;
    }
  }
  return undefined;
}

function toPage(items: unknown[], cursor: string): Page<Pin> {
  const pins: Pin[] = [];
  for (const item of items) {
    const pin = toPin(item);
    if (pin !== null) {
      pins.push(pin);
    }
  }
  const page: Page<Pin> = { results: pins, hasMore: false };
  if (cursor.length > 0) {
    page.cursor = cursor;
    page.hasMore = true;
  }
  return page;
}

export async function searchScoped(
  session: SessionState,
  save: () => Promise<void>,
  query: string,
  scope: SearchScope,
  options: PagingOptions | undefined,
): Promise<Page<Pin>> {
  const mark = cursorOf(options);
  const payload: Record<string, unknown> = {};
  payload["query"] = query;
  payload["scope"] = scope;
  payload["page_size"] = sizeOf(options);
  payload["auto_correction_discovered"] = false;
  if (mark.length > 0) {
    payload["bookmark"] = mark;
  }
  const sourceUrl = searchSourceUrl(scope, query);
  const json = await callResource(
    session,
    RESOURCES.searchPins,
    payload,
    sourceUrl,
    save,
  );
  const feed = readFeed(json);
  const page = toPage(feed.items, feed.cursor);
  const limit = limitOf(options);
  if (limit !== undefined && page.results.length > limit) {
    page.results = page.results.slice(0, limit);
  }
  return page;
}

export async function searchPins(
  session: SessionState,
  save: () => Promise<void>,
  query: string,
  options: PagingOptions | undefined,
): Promise<Page<Pin>> {
  return searchScoped(session, save, query, "pins", options);
}

export async function* searchAll(
  session: SessionState,
  save: () => Promise<void>,
  query: string,
  scope: SearchScope = "pins",
  pageSize: number = DEFAULT_PAGE_SIZE,
): AsyncGenerator<Pin, void, undefined> {
  let cursor = "";
  let first = true;
  while (first || cursor.length > 0) {
    const options: PagingOptions = { pageSize: pageSize };
    if (cursor.length > 0) {
      options.cursor = cursor;
    }
    const page = await searchScoped(session, save, query, scope, options);
    first = false;
    for (const pin of page.results) {
      yield pin;
    }
    cursor = page.cursor !== undefined ? page.cursor : "";
    if (page.hasMore === false) {
      return;
    }
  }
}
