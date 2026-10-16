import type { PagingOptions } from "../Shapes/common.js";
import { objectOf } from "./normalize.js";

export function findHolder(
  rows: unknown[],
  key: string,
): Record<string, unknown> | null {
  for (const row of rows) {
    const holder = objectOf(row)[key];
    if (holder !== null && typeof holder === "object") {
      return holder as Record<string, unknown>;
    }
  }
  return null;
}

export function pinRows(rows: unknown[]): unknown[] {
  for (const row of rows) {
    const pins = objectOf(row)["pins"];
    if (Array.isArray(pins)) {
      return pins as unknown[];
    }
  }
  return [];
}

export function sizeOf(
  options: PagingOptions | undefined,
  fallback: number,
): number {
  if (options && typeof options.pageSize === "number") {
    return options.pageSize;
  }
  return fallback;
}
