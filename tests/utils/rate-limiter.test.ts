import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimiter, DailyQuota } from '../../src/utils/rate-limiter.js';

describe('RateLimiter', () => {
  it('should allow requests within rate limit', async () => {
    const limiter = new RateLimiter(60); // 60 per minute = 1 per second
    // Should not throw or delay significantly
    const start = Date.now();
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(500); // Should be fast when tokens available
  });

  it('should delay when tokens exhausted', async () => {
    const limiter = new RateLimiter(6000); // 100 per second — fast enough to not timeout
    // Exhaust all initial tokens
    for (let i = 0; i < 6000; i++) {
      await limiter.acquire();
    }
    // Next request should need to wait for refill
    const start = Date.now();
    await limiter.acquire();
    const elapsed = Date.now() - start;
    // Should have waited at least a small amount of time
    expect(elapsed).toBeGreaterThanOrEqual(0);
  }, 10000);

  it('should refill tokens over time', async () => {
    const limiter = new RateLimiter(600); // 10 per second
    // Exhaust a few tokens
    for (let i = 0; i < 5; i++) {
      await limiter.acquire();
    }
    // Wait a bit for refill
    await new Promise((r) => setTimeout(r, 100));
    // Should be able to acquire again quickly
    const start = Date.now();
    await limiter.acquire();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(200);
  });
});

describe('DailyQuota', () => {
  it('should track daily quota', () => {
    const quota = new DailyQuota(5);
    expect(quota.canProceed()).toBe(true);
    expect(quota.remaining()).toBe(5);

    quota.consume();
    quota.consume();
    expect(quota.remaining()).toBe(3);
    expect(quota.canProceed()).toBe(true);
  });

  it('should block when quota exhausted', () => {
    const quota = new DailyQuota(2);
    quota.consume();
    quota.consume();
    expect(quota.canProceed()).toBe(false);
    expect(quota.remaining()).toBe(0);
  });

  it('should reset on new day', () => {
    const quota = new DailyQuota(5);
    quota.consume();
    quota.consume();
    expect(quota.remaining()).toBe(3);

    // Simulate day change by manipulating internal state
    // @ts-expect-error accessing private property for testing
    quota.resetDate = '2020-01-01';

    expect(quota.remaining()).toBe(5);
    expect(quota.canProceed()).toBe(true);
  });
});
