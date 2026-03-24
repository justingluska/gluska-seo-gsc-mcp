/**
 * Token bucket rate limiter that respects Google API quotas.
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per millisecond

  /**
   * @param maxPerMinute Maximum requests per minute
   */
  constructor(maxPerMinute: number) {
    this.maxTokens = maxPerMinute;
    this.tokens = maxPerMinute;
    this.refillRate = maxPerMinute / 60_000;
    this.lastRefill = Date.now();
  }

  private refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Wait until a token is available
    const waitMs = Math.ceil((1 - this.tokens) / this.refillRate);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    this.refill();
    this.tokens -= 1;
  }
}

/**
 * Daily quota tracker.
 */
export class DailyQuota {
  private count: number = 0;
  private resetDate: string;
  private readonly limit: number;

  constructor(limit: number) {
    this.limit = limit;
    this.resetDate = new Date().toISOString().split('T')[0];
  }

  private maybeReset() {
    const today = new Date().toISOString().split('T')[0];
    if (today !== this.resetDate) {
      this.count = 0;
      this.resetDate = today;
    }
  }

  canProceed(): boolean {
    this.maybeReset();
    return this.count < this.limit;
  }

  consume() {
    this.maybeReset();
    this.count++;
  }

  remaining(): number {
    this.maybeReset();
    return this.limit - this.count;
  }
}
