export class PintoError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "PintoError";
    this.status = status;
    this.code = code !== undefined ? code : "pinto_error";
  }
}

export class NotFoundError extends PintoError {
  constructor(message: string) {
    super(message, 404, "not_found");
    this.name = "NotFoundError";
  }
}

export class BlockedError extends PintoError {
  constructor(message: string, status?: number) {
    super(message, status !== undefined ? status : 403, "blocked");
    this.name = "BlockedError";
  }
}

export class RateLimitError extends BlockedError {
  retryAfterMs?: number;

  constructor(message: string, retryAfterMs?: number) {
    super(message, 429);
    this.name = "RateLimitError";
    this.code = "rate_limited";
    if (retryAfterMs !== undefined) {
      this.retryAfterMs = retryAfterMs;
    }
  }
}

export class NetworkError extends PintoError {
  constructor(message: string, cause?: unknown) {
    super(message, 0, "network_error");
    this.name = "NetworkError";
    if (cause !== undefined) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}

export class ParseError extends PintoError {
  constructor(message: string) {
    super(message, 200, "parse_error");
    this.name = "ParseError";
  }
}

export function errorForStatus(status: number, message: string): PintoError {
  if (status === 404) {
    return new NotFoundError(message);
  }
  if (status === 429) {
    return new RateLimitError(message);
  }
  if (status === 403) {
    return new BlockedError(message, status);
  }
  return new PintoError(message, status, "http_" + status);
}
