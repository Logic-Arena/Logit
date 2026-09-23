// Single-process limits. Use a shared store before scaling to multiple workers.
export function createBudget(limit, windowMs, now = Date.now) {
  const buckets = new Map();
  const sweep = setInterval(() => {
    const time = now();
    for (const [key, bucket] of buckets) if (bucket.until <= time) buckets.delete(key);
  }, Math.min(windowMs, 60_000));
  sweep.unref();
  return (key) => {
    const time = now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.until <= time) {
      if (!bucket && buckets.size >= 10_000) return 60;
      bucket = { count: 0, until: time + windowMs };
      buckets.set(key, bucket);
    }
    if (bucket.count >= limit) return Math.max(1, Math.ceil((bucket.until - time) / 1000));
    bucket.count++;
    return 0;
  };
}

export function rateLimit(limit, windowMs, key = req => req.user?.id ?? req.ip) {
  const consume = createBudget(limit, windowMs);
  return (req, res, next) => {
    const retry = consume(key(req));
    if (retry) return res.set('Retry-After', String(retry)).status(429).json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' });
    next();
  };
}

export const aiRequestLimit = rateLimit(20, 60 * 60_000);
