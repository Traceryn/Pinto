import {
  widgetBoardPinsUrl,
  readWidgetRows,
  cleanSlug,
  isShortLink,
  resolveShortLink,
} from "../../Pinth/index.js";
import { fetchWidgetJson, sessionFetch } from "../Client/client.js";
import {
  findHolder,
  pinRows,
  sizeOf,
  widgetBoardToBoard,
  toPinFromWidget,
} from "../Harvest/index.js";
import type { Page, PagingOptions, SessionState } from "../Shapes/common.js";
import type { Board } from "../Shapes/boards.js";
import type { Pin } from "../Shapes/pins.js";
import { NotFoundError } from "../Errors/index.js";

const DEFAULT_SIZE = 25;

export async function getBoard(
  session: SessionState,
  input: string,
): Promise<Board> {
  let ref = input;
  if (isShortLink(ref)) {
    ref = await resolveShortLink(ref, sessionFetch(session));
  }
  const slug = cleanSlug(ref);
  if (slug.length === 0) {
    throw new NotFoundError("Board not found: " + input);
  }
  const cut = slug.indexOf("/");
  const owner = cut >= 0 ? slug.slice(0, cut) : slug;
  const name = cut >= 0 ? slug.slice(cut + 1) : slug;
  const url = widgetBoardPinsUrl(owner, name, DEFAULT_SIZE);
  const json = await fetchWidgetJson(session, url);
  const rows = readWidgetRows(json);
  const holder = findHolder(rows, "board");
  if (holder === null) {
    throw new NotFoundError("Board not found: " + input);
  }
  const board = widgetBoardToBoard(holder);
  if (board === null) {
    throw new NotFoundError("Board not found: " + input);
  }
  return board;
}

export async function boardPins(
  session: SessionState,
  input: string,
  options: PagingOptions | undefined,
): Promise<Page<Pin>> {
  let ref = input;
  if (isShortLink(ref)) {
    ref = await resolveShortLink(ref, sessionFetch(session));
  }
  const slug = cleanSlug(ref);
  if (slug.length === 0) {
    throw new NotFoundError("Board not found: " + input);
  }
  const cut = slug.indexOf("/");
  const owner = cut >= 0 ? slug.slice(0, cut) : slug;
  const name = cut >= 0 ? slug.slice(cut + 1) : slug;
  const size = sizeOf(options, DEFAULT_SIZE);
  const url = widgetBoardPinsUrl(owner, name, size);
  const json = await fetchWidgetJson(session, url);
  const rows = readWidgetRows(json);
  const raws = pinRows(rows);
  const pins: Pin[] = [];
  for (const raw of raws) {
    const pin = toPinFromWidget(raw, "");
    if (pin !== null) {
      pins.push(pin);
    }
  }
  const page: Page<Pin> = { results: pins, hasMore: false };
  return page;
}
