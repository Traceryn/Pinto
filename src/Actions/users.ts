import {
  widgetUserPinsUrl,
  readWidgetRows,
  cleanUsername,
  isShortLink,
  resolveShortLink,
} from "../../Pinth/index.js";
import { fetchWidgetJson, sessionFetch } from "../Client/client.js";
import {
  findHolder,
  pinRows,
  sizeOf,
  widgetUserToProfile,
  toPinFromWidget,
} from "../Harvest/index.js";
import type { Page, PagingOptions, SessionState } from "../Shapes/common.js";
import type { UserProfile } from "../Shapes/users.js";
import type { Pin } from "../Shapes/pins.js";
import { NotFoundError } from "../Errors/index.js";

const DEFAULT_SIZE = 25;

export async function getUser(
  session: SessionState,
  input: string,
): Promise<UserProfile> {
  let ref = input;
  if (isShortLink(ref)) {
    ref = await resolveShortLink(ref, sessionFetch(session));
  }
  const username = cleanUsername(ref);
  if (username.length === 0) {
    throw new NotFoundError("User not found: " + input);
  }
  const url = widgetUserPinsUrl(username, DEFAULT_SIZE);
  const json = await fetchWidgetJson(session, url);
  const rows = readWidgetRows(json);
  const holder = findHolder(rows, "user");
  if (holder === null) {
    throw new NotFoundError("User not found: " + input);
  }
  const user = widgetUserToProfile(holder, username);
  if (user === null) {
    throw new NotFoundError("User not found: " + input);
  }
  return user;
}

export async function userPins(
  session: SessionState,
  input: string,
  options: PagingOptions | undefined,
): Promise<Page<Pin>> {
  let ref = input;
  if (isShortLink(ref)) {
    ref = await resolveShortLink(ref, sessionFetch(session));
  }
  const username = cleanUsername(ref);
  if (username.length === 0) {
    throw new NotFoundError("User not found: " + input);
  }
  const size = sizeOf(options, DEFAULT_SIZE);
  const url = widgetUserPinsUrl(username, size);
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
