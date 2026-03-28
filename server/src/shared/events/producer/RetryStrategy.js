
const RETRYABLE_PATTERNS = [
  'channel closed',
  'connection closed',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEOUT',
  'buffer full',
  'heartbeat timeout',
  'not available',
  'server connection closed'
];

export class RetryStrategy {
  constructor(opts = {}) {
    this.maxRetries = opts.maxRetries ?? 3;
    this.baseDelayMs = opts.baseDelayMs ?? 200;
    this.maxDelayMs = opts.maxDelayMs ?? 5000;
    this.jitterFactor = opts.jitterFactor ?? 0.3;
  }

  /**
   * Determines if an error is retryable
   */
  isRetryable(err) {
    if (!err) return false;

    const message = (err.message || '').toLowerCase();
    const code = (err.code || '').toUpperCase();

    if (code === 'ENOTFOUND') return true;

    return RETRYABLE_PATTERNS.some((pattern) =>
      message.includes(pattern.toLowerCase()) ||
      code.includes(pattern.toUpperCase())
    );
  }

  /**
   * Checks whether we should retry based on attempt count
   */
  shouldRetry(attempt) {
    return attempt < this.maxRetries;
  }

  /**
   * Calculates delay using exponential backoff + jitter
   */
  delay(attempt) {
    const exponential = this.baseDelayMs * Math.pow(2, attempt);

    // Cap delay to maxDelayMs
    const capped = Math.min(exponential, this.maxDelayMs);

    // Add jitter
    const jitterRange = capped * this.jitterFactor;
    const jitter = (Math.random() - 0.5) * 2 * jitterRange;

    return Math.max(0, Math.round(capped + jitter));
  }

  /**
   * Wait for computed delay
   */
  wait(attempt) {
    const ms = this.delay(attempt);
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}