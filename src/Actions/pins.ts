import {
  widgetPinInfoUrl,
  readWidget,
  cleanId,
  isShortLink,
  resolveShortLink,
} from "../../Pinth/index.js";
import { fetchWidgetJson, sessionFetch } from "../Client/client.js";
import { toPinFromWidget } from "../Harvest/index.js";
import type { SessionState } from "../Shapes/common.js";
import type { Pin } from "../Shapes/pins.js";
import { NotFoundError } from "../Errors/index.js";

export async function getPin(
  session: SessionState,
  input: string,
): Promise<Pin> {
  let ref = input;
  if (isShortLink(ref)) {
    ref = await resolveShortLink(ref, sessionFetch(session));
  }
  const id = cleanId(ref);
  if (id.length === 0) {
    throw new NotFoundError("Pin not found: " + input);
  }
  const url = widgetPinInfoUrl([id]);
  const json = await fetchWidgetJson(session, url);
  const rows = readWidget(json);
  for (const row of rows) {
    const pin = toPinFromWidget(row, id);
    if (pin !== null) {
      return pin;
    }
  }
  throw new NotFoundError("Pin not found: " + input);
}
