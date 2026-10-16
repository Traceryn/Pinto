import type { Pin, PinImage, PinnerBrief } from "../Shapes/pins.js";

function textOf(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  return "";
}

function numberOf(value: unknown): number | undefined {
  if (typeof value === "number") {
    return value;
  }
  return undefined;
}

function booleanOf(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  return undefined;
}

function timeOf(value: unknown): number | undefined {
  if (typeof value === "number" && value > 1000000000000) {
    return value;
  }
  if (typeof value === "number" && value > 1000000000) {
    return value * 1000;
  }
  if (typeof value === "string" && value.length > 0) {
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed) === false) {
      return parsed;
    }
  }
  return undefined;
}

export function objectOf(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object") {
    if (Array.isArray(value) === false) {
      return value as Record<string, unknown>;
    }
  }
  return {};
}

export function firstText(values: unknown[]): string {
  for (const item of values) {
    if (typeof item === "string") {
      if (item.length > 0) {
        return item;
      }
    }
  }
  return "";
}

function collectImages(raw: Record<string, unknown>): PinImage[] {
  const found: PinImage[] = [];
  const images = objectOf(raw["images"]);
  const keys = Object.keys(images);
  for (const key of keys) {
    const entry = objectOf(images[key]);
    const url = textOf(entry["url"]);
    if (url.length > 0) {
      const image: PinImage = { url: url };
      const width = numberOf(entry["width"]);
      const height = numberOf(entry["height"]);
      if (width !== undefined) {
        image.width = width;
      }
      if (height !== undefined) {
        image.height = height;
      }
      found.push(image);
    }
  }
  found.sort(function (a, b) {
    let aw = 0;
    let bw = 0;
    if (a.width !== undefined) {
      aw = a.width;
    }
    if (b.width !== undefined) {
      bw = b.width;
    }
    return bw - aw;
  });
  return found;
}

function briefOf(raw: Record<string, unknown>): PinnerBrief {
  const brief: PinnerBrief = {};
  const id = textOf(raw["id"]);
  const username = textOf(raw["username"]);
  const fullName = textOf(raw["full_name"]);
  if (id.length > 0) {
    brief.id = id;
  }
  if (username.length > 0) {
    brief.username = username;
  }
  if (fullName.length > 0) {
    brief.fullName = fullName;
  }
  const image = objectOf(raw["image_small"]);
  const imageUrl = textOf(image["url"]);
  if (imageUrl.length > 0) {
    brief.image = imageUrl;
  }
  return brief;
}

function bestVideoUrl(raw: Record<string, unknown>): string {
  const videos = objectOf(raw["videos"]);
  const list = objectOf(videos["video_list"]);
  const keys = Object.keys(list);
  let best = "";
  let bestWidth = -1;
  for (const key of keys) {
    const entry = objectOf(list[key]);
    const url = textOf(entry["url"]);
    if (url.length === 0) {
      continue;
    }
    const width = numberOf(entry["width"]);
    const size = width !== undefined ? width : 0;
    if (size > bestWidth) {
      bestWidth = size;
      best = url;
    }
  }
  return best;
}

function altTextOf(raw: Record<string, unknown>): string {
  return firstText([
    raw["seo_alt_text"],
    raw["auto_alt_text"],
    raw["accessibility_text"],
  ]);
}

export function toPin(rawInput: unknown): Pin | null {
  const raw = objectOf(rawInput);
  const id = firstText([raw["pin_id"], raw["id"]]);
  const images = collectImages(raw);
  if (id.length === 0 && images.length === 0) {
    return null;
  }
  const pin: Pin = {
    id: String(id),
    title: firstText([raw["title"], raw["grid_title"]]),
    description: firstText([raw["description"], raw["grid_description"]]),
    image: "",
    images: images,
    url: "https://www.pinterest.com/pin/" + id + "/",
  };
  if (images.length > 0) {
    pin.image = images[0].url;
  } else {
    pin.image = firstText([raw["image_large_url"], raw["image_url"]]);
  }
  const video = bestVideoUrl(raw);
  if (video.length > 0) {
    pin.video = video;
  }
  const alt = altTextOf(raw);
  if (alt.length > 0) {
    pin.altText = alt;
  }
  const created = timeOf(raw["created_at"]);
  if (created !== undefined) {
    pin.createdAt = created;
  }
  const isVideo = booleanOf(raw["has_video"]);
  if (isVideo !== undefined) {
    pin.isVideo = isVideo;
  } else if (video.length > 0) {
    pin.isVideo = true;
  }
  const link = firstText([raw["link"], raw["domain_url"]]);
  if (link.length > 0) {
    pin.link = link;
  }
  const color = textOf(raw["dominant_color"]);
  if (color.length > 0) {
    pin.dominantColor = color;
  }
  let saves = numberOf(raw["repin_count"]);
  if (saves === undefined) {
    saves = numberOf(raw["save_count"]);
  }
  if (saves !== undefined) {
    pin.saves = saves;
  }
  const comments = numberOf(raw["comment_count"]);
  if (comments !== undefined) {
    pin.comments = comments;
  }
  pin.pinner = briefOf(objectOf(raw["pinner"]));
  const boardRaw = objectOf(raw["board"]);
  const boardPath = textOf(boardRaw["url"]);
  let boardUrl = "";
  if (boardPath.length > 0) {
    if (boardPath.startsWith("http")) {
      boardUrl = boardPath;
    } else {
      boardUrl = "https://www.pinterest.com" + boardPath;
    }
  }
  pin.board = {
    id: firstText([boardRaw["board_id"], boardRaw["id"]]),
    name: textOf(boardRaw["name"]),
    url: boardUrl,
  };
  return pin;
}
