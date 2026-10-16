export const SUPPORTED_IMAGE_FORMATS = ["jpg", "jpeg", "png", "webp"] as const;
export const SUPPORTED_VIDEO_FORMATS = ["mp4", "mov", "m4v"] as const;

export type ImageFormat = (typeof SUPPORTED_IMAGE_FORMATS)[number];
export type VideoFormat = (typeof SUPPORTED_VIDEO_FORMATS)[number];
export type MediaFormat = ImageFormat | VideoFormat;

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp4: "video/mp4",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
};

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/pjpeg": "jpg",
  "image/png": "png",
  "image/x-png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/x-quicktime": "mov",
  "video/x-m4v": "m4v",
  "video/m4v": "m4v",
  "video/x-msvideo": "mp4",
};

export function mimeForExtension(ext: string): string {
  const key = ext.trim().toLowerCase().replace(/^\./, "");
  const short = key === "jpe" ? "jpg" : key;
  return MIME_BY_EXT[short] !== undefined ? MIME_BY_EXT[short] : "";
}

export function extensionForMime(mime: string): string {
  const key = mime.trim().toLowerCase().split(";")[0].trim();
  return EXT_BY_MIME[key] !== undefined ? EXT_BY_MIME[key] : "";
}

export function extensionFromUrl(url: string): string {
  const clean = url.trim().split(/[?#]/)[0];
  const last = clean.slice(clean.lastIndexOf("/") + 1);
  const dot = last.lastIndexOf(".");
  if (dot < 0) {
    return "";
  }
  const ext = last.slice(dot + 1).toLowerCase();
  if (/^[a-z0-9]+$/.test(ext) === false) {
    return "";
  }
  return ext;
}

export function normalizeImageFormat(ext: string): string {
  const key = ext.trim().toLowerCase().replace(/^\./, "");
  if (key === "jpg" || key === "jpeg") {
    return "jpg";
  }
  if (key === "png") {
    return "png";
  }
  if (key === "webp") {
    return "webp";
  }
  return "";
}

export function normalizeVideoFormat(ext: string): string {
  const key = ext.trim().toLowerCase().replace(/^\./, "");
  if (key === "mp4") {
    return "mp4";
  }
  if (key === "mov") {
    return "mov";
  }
  if (key === "m4v") {
    return "m4v";
  }
  return "";
}

export function imageFormatFromUrl(url: string): string {
  return normalizeImageFormat(extensionFromUrl(url));
}

export function videoFormatFromUrl(url: string): string {
  return normalizeVideoFormat(extensionFromUrl(url));
}

export function isSupportedImageFormat(ext: string): boolean {
  return normalizeImageFormat(ext).length > 0;
}

export function isSupportedVideoFormat(ext: string): boolean {
  return normalizeVideoFormat(ext).length > 0;
}

const VIDEO_RANK: Record<string, number> = {
  mp4: 0,
  m4v: 1,
  mov: 2,
};

export function rankVideoUrl(url: string): number {
  const fmt = videoFormatFromUrl(url);
  if (fmt.length > 0 && VIDEO_RANK[fmt] !== undefined) {
    return VIDEO_RANK[fmt];
  }
  if (url.includes(".m3u8")) {
    return 99;
  }
  return 50;
}

export function sniffFormat(bytes: Uint8Array): string {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "jpg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    return "mp4";
  }
  return "";
}

export function detectFormat(
  url: string,
  contentType?: string,
  bytes?: Uint8Array,
): string {
  if (contentType !== undefined && contentType.length > 0) {
    const fromMime = extensionForMime(contentType);
    if (fromMime.length > 0) {
      return fromMime;
    }
  }
  const fromUrl = extensionFromUrl(url);
  if (fromUrl.length > 0) {
    const img = normalizeImageFormat(fromUrl);
    if (img.length > 0) {
      return img;
    }
    const vid = normalizeVideoFormat(fromUrl);
    if (vid.length > 0) {
      return vid;
    }
    return fromUrl;
  }
  if (bytes !== undefined && bytes.length > 0) {
    return sniffFormat(bytes);
  }
  return "";
}

export function filenameForPin(
  pinId: string,
  url: string,
  fallbackExt: string,
): string {
  let ext = extensionFromUrl(url);
  if (ext.length === 0) {
    ext = fallbackExt.trim().toLowerCase().replace(/^\./, "");
  }
  if (ext.length === 0 || /^[a-z0-9]+$/.test(ext) === false) {
    ext = "bin";
  }
  return "pin-" + pinId + "." + ext;
}
