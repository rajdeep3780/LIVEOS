import type { NextFunction, Request, Response } from 'express';

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyPrefix: string;
  message: string;
  keyGenerator?: (req: Request) => string;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export function createRateLimiter(options: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();

  const sweepTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) {
        buckets.delete(key);
      }
    }
  }, Math.min(options.windowMs, 60_000));
  sweepTimer.unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const clientKey = options.keyGenerator
      ? options.keyGenerator(req)
      : req.ip || req.socket.remoteAddress || 'unknown';
    const bucketKey = `${options.keyPrefix}:${clientKey}`;

    let bucket = buckets.get(bucketKey);
    if (!bucket || bucket.resetAt <= now) {
      bucket = {
        count: 0,
        resetAt: now + options.windowMs,
      };
      buckets.set(bucketKey, bucket);
    }

    bucket.count += 1;

    const remaining = Math.max(0, options.max - bucket.count);
    const resetSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

    res.setHeader('RateLimit-Limit', String(options.max));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(resetSeconds));

    if (bucket.count > options.max) {
      res.setHeader('Retry-After', String(resetSeconds));
      return res.status(429).json({ error: options.message });
    }

    return next();
  };
}

export const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  keyPrefix: 'auth:login',
  message: 'Too many sign-in attempts. Please wait a few minutes before trying again.',
});

export const registerRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  keyPrefix: 'auth:register',
  message: 'Too many registration attempts. Please wait a few minutes before trying again.',
});
