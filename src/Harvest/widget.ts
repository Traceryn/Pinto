import type { Pin, PinImage, PinnerBrief, BoardBrief } from "../Shapes/pins.js";
import type { UserProfile } from "../Shapes/users.js";
import type { Board } from "../Shapes/boards.js";
import {
  imageFormatFromUrl,
  mimeForExtension,
  normalizeVideoFormat,
  extensionFromUrl,
  rankVideoUrl,
} from "../Media/formats.js";
import { firstText, objectOf } from "./normalize.js";

function usernameFromUrl(url: string): string {
  const parts = url.split("/").filter(function (p) {
    return p.length > 0;
  });
  if (parts.length >= 1) {
    let last = parts[parts.length - 1];
    if (
      last === "pins" ||
      last === "boards" ||
      last === "followers" ||
      last === "following"
    ) {
      last = parts[parts.length - 2] || "";
    }
    return last;
  }
  return "";
}

function widgetImages(raw: Record<string, unknown>): PinImage[] {
  const found: PinImage[] = [];
  const images = objectOf(raw["images"]);
  const keys = Object.keys(images);
  for (const key of keys) {
    const entry = objectOf(images[key]);
    const url = firstText([entry["url"]]);
    if (url.length > 0) {
      const image: PinImage = { url: url };
      if (typeof entry["width"] === "number") {
        image.width = entry["width"] as number;
      }
      if (typeof entry["height"] === "number") {
        image.height = entry["height"] as number;
      }
      found.push(image);
    }
  }
  found.sort(function (a, b) {
    const aw = a.width !== undefined ? a.width : 0;
    const bw = b.width !== undefined ? b.width : 0;
    return bw - aw;
  });
  return found;
}

function widgetBoardBrief(raw: Record<string, unknown>): BoardBrief {
  const boardRaw = objectOf(raw["board"]);
  const slug = firstText([boardRaw["url"]]);
  let url = "";
  if (slug.length > 0) {
    if (slug.startsWith("http")) {
      url = slug;
    } else {
      url = "https://www.pinterest.com" + slug;
    }
  }
  return {
    id: firstText([boardRaw["id"]]),
    name: firstText([boardRaw["name"]]),
    url: url,
  };
}

function widgetPinner(raw: Record<string, unknown>): PinnerBrief {
  const pinnerRaw = objectOf(raw["pinner"]);
  const brief: PinnerBrief = {};
  const id = firstText([pinnerRaw["id"]]);
  const fullName = firstText([pinnerRaw["full_name"]]);
  const profileUrl = firstText([pinnerRaw["profile_url"]]);
  const username = usernameFromUrl(profileUrl);
  if (id.length > 0) {
    brief.id = id;
  }
  if (username.length > 0) {
    brief.username = username;
  }
  if (fullName.length > 0) {
    brief.fullName = fullName;
  }
  const image = firstText([pinnerRaw["image_small_url"]]);
  if (image.length > 0) {
    brief.image = image;
  }
  return brief;
}

export function toPinFromWidget(
  rawInput: unknown,
  fallbackId: string,
): Pin | null {
  const raw = objectOf(rawInput);
  const id = firstText([raw["id"], fallbackId]);
  const images = widgetImages(raw);
  if (id.length === 0 && images.length === 0) {
    return null;
  }
  const description = firstText([raw["description"], raw["grid_title"]]);
  const pin: Pin = {
    id: String(id),
    title: firstText([raw["title"]]),
    description: description,
    image: "",
    images: images,
    url: "https://www.pinterest.com/pin/" + id + "/",
  };
  if (images.length > 0) {
    pin.image = images[0].url;
    const fmt = imageFormatFromUrl(pin.image);
    if (fmt.length > 0) {
      pin.imageFormat = fmt;
      const mime = mimeForExtension(fmt);
      if (mime.length > 0) {
        pin.imageMime = mime;
      }
    }
  }
  const link = firstText([raw["link"]]);
  if (link.length > 0) {
    pin.link = link;
  }
  const domain = firstText([raw["domain"]]);
  if (domain.length > 0) {
    pin.domain = domain;
  }
  const color = firstText([raw["dominant_color"]]);
  if (color.length > 0) {
    pin.dominantColor = color;
  }
  if (typeof raw["repin_count"] === "number") {
    pin.saves = raw["repin_count"] as number;
  }
  const alt = firstText([raw["seo_alt_text"], raw["auto_alt_text"]]);
  if (alt.length > 0) {
    pin.altText = alt;
  }
  const createdAt = raw["created_at"];
  if (typeof createdAt === "string" && createdAt.length > 0) {
    const parsed = Date.parse(createdAt);
    if (Number.isNaN(parsed) === false) {
      pin.createdAt = parsed;
    }
  }
  const video = widgetVideo(raw);
  if (video.length > 0) {
    pin.video = video;
    pin.isVideo = true;
    tagVideoFormat(pin);
  } else if (raw["is_video"] === true) {
    pin.isVideo = true;
  } else if (hasStoryVideo(raw)) {
    pin.isVideo = true;
  }
  pin.pinner = widgetPinner(raw);
  pin.board = widgetBoardBrief(raw);
  return pin;
}

function widgetVideo(raw: Record<string, unknown>): string {
  const found: string[] = [];
  const videos = objectOf(raw["videos"]);
  const list = objectOf(videos["video_list"]);
  const keys = Object.keys(list);
  for (const key of keys) {
    const entry = objectOf(list[key]);
    const url = firstText([entry["url"]]);
    if (url.length > 0) {
      found.push(url);
    }
  }

  const story = objectOf(raw["story_pin_data"]);
  const pages = story["pages"];
  if (Array.isArray(pages)) {
    for (const page of pages) {
      const blocks = objectOf(page)["blocks"];
      if (Array.isArray(blocks) === false) {
        continue;
      }
      for (const block of blocks) {
        const blockRec = objectOf(block);
        const video = objectOf(blockRec["video"]);
        const blockList = objectOf(video["video_list"]);
        const blockKeys = Object.keys(blockList);
        for (const key of blockKeys) {
          const url = firstText([objectOf(blockList[key])["url"]]);
          if (url.length > 0) {
            found.push(url);
          }
        }
      }
    }
  }
  if (found.length === 0) {
    return "";
  }

  found.sort(function (a, b) {
    return rankVideoUrl(a) - rankVideoUrl(b);
  });
  return found[0];
}

export function tagVideoFormat(pin: Pin): void {
  if (pin.video === undefined || pin.video.length === 0) {
    return;
  }
  const raw = extensionFromUrl(pin.video);
  const fmt = normalizeVideoFormat(raw);
  if (fmt.length > 0) {
    pin.videoFormat = fmt;
  } else if (pin.video.includes(".m3u8")) {
    pin.videoFormat = "hls";
  } else if (raw.length > 0) {
    pin.videoFormat = raw;
  }
  const mimeKey = pin.videoFormat !== undefined ? pin.videoFormat : "";
  const mime = mimeForExtension(mimeKey);
  if (mime.length > 0) {
    pin.videoMime = mime;
  }
}

function hasStoryVideo(raw: Record<string, unknown>): boolean {
  const story = objectOf(raw["story_pin_data"]);
  const pages = story["pages"];
  if (Array.isArray(pages) === false) {
    return false;
  }
  for (const pageInput of pages) {
    const page = objectOf(pageInput);
    const blocks = page["blocks"];
    if (Array.isArray(blocks) === false) {
      continue;
    }
    for (const blockInput of blocks) {
      const block = objectOf(blockInput);
      const kind = firstText([block["type"]]);
      if (kind.includes("video")) {
        return true;
      }
      if (
        Object.keys(objectOf(objectOf(block["video"])["video_list"])).length > 0
      ) {
        return true;
      }
    }
  }
  return false;
}

export function widgetUserToProfile(
  rawInput: unknown,
  fallbackName: string,
): UserProfile | null {
  const raw = objectOf(rawInput);
  const profileUrl = firstText([raw["profile_url"]]);
  const username = usernameFromUrl(profileUrl) || fallbackName;
  if (username.length === 0) {
    return null;
  }
  const user: UserProfile = { username: username };
  const id = firstText([raw["id"]]);
  if (id.length > 0) {
    user.id = id;
  }
  const fullName = firstText([raw["full_name"]]);
  if (fullName.length > 0) {
    user.fullName = fullName;
  }
  const bio = firstText([raw["about"]]);
  if (bio.length > 0) {
    user.bio = bio;
  }
  if (typeof raw["follower_count"] === "number") {
    user.followers = raw["follower_count"] as number;
  }
  if (typeof raw["pin_count"] === "number") {
    user.pinsCount = raw["pin_count"] as number;
  }
  const image = firstText([raw["image_small_url"]]);
  if (image.length > 0) {
    user.image = image;
  }
  return user;
}

export function widgetBoardToBoard(rawInput: unknown): Board | null {
  const raw = objectOf(rawInput);
  const slug = firstText([raw["url"]]);
  const id = firstText([raw["id"]]);
  if (id.length === 0 && slug.length === 0) {
    return null;
  }
  let url = slug;
  if (slug.length > 0 && slug.startsWith("http") === false) {
    url = "https://www.pinterest.com" + slug;
  }
  const board: Board = {
    id: String(id),
    name: firstText([raw["name"]]),
    description: firstText([raw["description"]]),
    url: url,
  };
  if (typeof raw["pin_count"] === "number") {
    board.pinsCount = raw["pin_count"] as number;
  }
  if (typeof raw["follower_count"] === "number") {
    board.followers = raw["follower_count"] as number;
  }
  const image = firstText([raw["image_thumbnail_url"]]);
  if (image.length > 0) {
    board.image = image;
  }
  return board;
}
