export interface RateLimitOptions {
  maxPerSecond?: number;
  maxConcurrent?: number;
}

interface HostBucket {
  slots: number[];
  active: number;
  queue: Array<() => void>;
}

function prune(now: number, windowMs: number, slots: number[]): void {
  while (slots.length > 0 && now - slots[0] >= windowMs) {
    slots.shift();
  }
}

export class GlobalRateLimiter {
  private maxPerSecond: number;
  private maxConcurrent: number;
  private buckets = new Map<string, HostBucket>();

  constructor(options?: RateLimitOptions) {
    this.maxPerSecond =
      options && typeof options.maxPerSecond === "number"
        ? options.maxPerSecond
        : 8;
    this.maxConcurrent =
      options && typeof options.maxConcurrent === "number"
        ? options.maxConcurrent
        : 20;
  }

  private bucketFor(host: string): HostBucket {
    let bucket = this.buckets.get(host);
    if (bucket === undefined) {
      bucket = { slots: [], active: 0, queue: [] };
      this.buckets.set(host, bucket);
    }
    return bucket;
  }

  async acquire(host: string): Promise<() => void> {
    const bucket = this.bucketFor(host);
    await this.waitTurn(bucket);
    bucket.active = bucket.active + 1;
    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      bucket.active = bucket.active - 1;
      if (bucket.active < 0) {
        bucket.active = 0;
      }
      this.pump(bucket);
    };
  }

  private waitTurn(bucket: HostBucket): Promise<void> {
    const now = Date.now();
    prune(now, 1000, bucket.slots);
    if (
      bucket.active < this.maxConcurrent &&
      bucket.slots.length < this.maxPerSecond
    ) {
      bucket.slots.push(now);
      return Promise.resolve();
    }
    return new Promise<void>(function (resolve) {
      bucket.queue.push(resolve);
    }).then(() => this.claim(bucket));
  }

  private claim(bucket: HostBucket): void {
    const now = Date.now();
    prune(now, 1000, bucket.slots);
    bucket.slots.push(now);
  }

  private pump(bucket: HostBucket): void {
    const next = bucket.queue.shift();
    if (next === undefined) {
      return;
    }
    const now = Date.now();
    prune(now, 1000, bucket.slots);
    if (
      bucket.active >= this.maxConcurrent ||
      bucket.slots.length >= this.maxPerSecond
    ) {
      const delay =
        bucket.slots.length > 0
          ? Math.max(0, 1000 - (now - bucket.slots[0]))
          : 50;
      setTimeout(
        () => {
          bucket.queue.unshift(next);
          this.pump(bucket);
        },
        Math.min(Math.max(delay, 20), 1000),
      );
      return;
    }
    next();
  }

  stats(): { hosts: number } {
    return { hosts: this.buckets.size };
  }
}
