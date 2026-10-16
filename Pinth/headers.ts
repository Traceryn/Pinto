import type { DeviceProfile } from "./devices.js";
export type { DeviceProfile };

const ANY = "*" + "/" + "*";

function clientHints(device: DeviceProfile): Record<string, string> {
  const headers: Record<string, string> = {};
  if (device.secChUa.length > 0) {
    headers["Sec-Ch-Ua"] = device.secChUa;
    headers["Sec-Ch-Ua-Mobile"] = device.secChUaMobile;
    headers["Sec-Ch-Ua-Platform"] = device.secChUaPlatform;
  }
  return headers;
}

function baseHeaders(
  device: DeviceProfile,
  cookieText: string,
): Record<string, string> {
  const headers: Record<string, string> = {};
  headers["User-Agent"] = device.agent;
  headers["Accept-Language"] = device.acceptLanguage;
  const hints = clientHints(device);
  const hintKeys = Object.keys(hints);
  for (const key of hintKeys) {
    headers[key] = hints[key];
  }
  headers["X-Requested-With"] = "XMLHttpRequest";
  headers["Referer"] = "https://www.pinterest.com/";
  if (cookieText.length > 0) {
    headers["Cookie"] = cookieText;
  }
  return headers;
}

export function bootstrapHeaders(
  device: DeviceProfile,
): Record<string, string> {
  const headers = baseHeaders(device, "");
  headers["Accept"] =
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp," +
    ANY +
    ";q=0.8";
  headers["Sec-Fetch-Dest"] = "document";
  headers["Sec-Fetch-Mode"] = "navigate";
  headers["Sec-Fetch-Site"] = "none";
  headers["Upgrade-Insecure-Requests"] = "1";
  return headers;
}

export function apiHeaders(
  device: DeviceProfile,
  cookieText: string,
  token: string,
): Record<string, string> {
  const headers = baseHeaders(device, cookieText);
  headers["Accept"] = "application/json, text/plain, " + ANY;
  headers["Origin"] = "https://www.pinterest.com";
  headers["Sec-Fetch-Dest"] = "empty";
  headers["Sec-Fetch-Mode"] = "cors";
  headers["Sec-Fetch-Site"] = "same-origin";
  if (token.length > 0) {
    headers["X-CSRFToken"] = token;
  }
  return headers;
}

export function widgetHeaders(
  device: DeviceProfile,
  cookieText: string,
): Record<string, string> {
  const headers = baseHeaders(device, cookieText);
  headers["Accept"] = "application/json, text/plain, " + ANY;
  headers["Sec-Fetch-Dest"] = "empty";
  headers["Sec-Fetch-Mode"] = "cors";
  headers["Sec-Fetch-Site"] = "same-origin";
  return headers;
}

export function mediaHeaders(
  device: DeviceProfile,
  referer: string,
): Record<string, string> {
  const headers: Record<string, string> = {};
  headers["User-Agent"] = device.agent;
  headers["Accept-Language"] = device.acceptLanguage;
  headers["Accept"] =
    "image/avif,image/webp,image/apng,image/" + ANY + "," + ANY + ";q=0.8";
  headers["Accept-Language"] = "en-US,en;q=0.9";
  headers["Referer"] = referer;
  headers["Sec-Fetch-Dest"] = "image";
  headers["Sec-Fetch-Mode"] = "no-cors";
  headers["Sec-Fetch-Site"] = "cross-site";
  return headers;
}
