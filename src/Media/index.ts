import { getPin } from "../Actions/pins.js";
import { mediaHeaders, pinPageUrl } from "../../Pinth/index.js";
import { sessionFetch } from "../Client/client.js";
import { deviceOf } from "../Vault/device.js";
import { NetworkError, NotFoundError } from "../Errors/index.js";
import type { SessionState } from "../Shapes/common.js";
import { detectFormat } from "./formats.js";
export {
  SUPPORTED_IMAGE_FORMATS,
  SUPPORTED_VIDEO_FORMATS,
  mimeForExtension,
  extensionForMime,
  extensionFromUrl,
  normalizeImageFormat,
  normalizeVideoFormat,
  imageFormatFromUrl,
  videoFormatFromUrl,
  isSupportedImageFormat,
  isSupportedVideoFormat,
  rankVideoUrl,
  filenameForPin,
  sniffFormat,
  detectFormat,
} from "./formats.js";
export type { ImageFormat, MediaFormat, VideoFormat } from "./formats.js";

export interface DownloadedAsset {
  bytes: Buffer;
  contentType: string;
  format: string;
}

async function downloadAsset(
  session: SessionState,
  url: string,
  referer: string,
): Promise<DownloadedAsset> {
  if (url.length === 0) {
    throw new NotFoundError("No asset URL to download");
  }
  const device = deviceOf(session);
  let response: Response;
  try {
    response = await sessionFetch(session)(url, {
      headers: mediaHeaders(device, referer),
    });
  } catch (err) {
    throw new NetworkError("Asset request did not complete", err);
  }
  if (response.ok === false) {
    throw new NetworkError(
      "Asset download failed with status " + response.status,
    );
  }
  const contentType = response.headers.get("content-type") || "";
  const bytes = Buffer.from(await response.arrayBuffer());
  return {
    bytes: bytes,
    contentType: contentType,
    format: detectFormat(url, contentType, bytes),
  };
}

async function download(
  session: SessionState,
  url: string,
  referer: string,
): Promise<Buffer> {
  const asset = await downloadAsset(session, url, referer);
  return asset.bytes;
}

export async function downloadPinImage(
  session: SessionState,
  input: string,
): Promise<Buffer> {
  const pin = await getPin(session, input);
  if (pin.image.length === 0) {
    throw new NotFoundError("Pin has no image: " + input);
  }
  return download(session, pin.image, pinPageUrl(pin.id));
}

export async function downloadPinVideo(
  session: SessionState,
  input: string,
): Promise<Buffer> {
  const pin = await getPin(session, input);
  if (pin.video === undefined || pin.video.length === 0) {
    throw new NotFoundError("Pin has no video: " + input);
  }
  return download(session, pin.video, pinPageUrl(pin.id));
}

export async function downloadImageWithFormat(
  session: SessionState,
  input: string,
): Promise<DownloadedAsset> {
  const pin = await getPin(session, input);
  if (pin.image.length === 0) {
    throw new NotFoundError("Pin has no image: " + input);
  }
  return downloadAsset(session, pin.image, pinPageUrl(pin.id));
}

export async function downloadVideoWithFormat(
  session: SessionState,
  input: string,
): Promise<DownloadedAsset> {
  const pin = await getPin(session, input);
  if (pin.video === undefined || pin.video.length === 0) {
    throw new NotFoundError("Pin has no video: " + input);
  }
  return downloadAsset(session, pin.video, pinPageUrl(pin.id));
}
