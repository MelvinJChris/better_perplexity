// A burst-safe request queue for every external API call. The Gemini free tier
// is roughly 15 RPM and will 429 under bursts, so provider calls funnel through
// here: bounded concurrency, a minimum gap between dispatches (the RPM gate),
// and retry on transient failures with exponential backoff plus full jitter.
//
// The clock, sleep, and RNG are injectable so the timing and backoff math are
// deterministically testable without real timers (see #7).

export interface QueueOptions {
  /** Maximum requests in flight at once. */
  maxConcurrent: number;
  /** Minimum gap between successive dispatches, in ms (use 60000 / RPM). */
  minIntervalMs: number;
  /** Retries attempted after the first try before giving up. */
  maxRetries: number;
  /** First backoff delay; the cap doubles each attempt up to maxDelayMs. */
  baseDelayMs: number;
  /** Ceiling for a single backoff delay. */
  maxDelayMs: number;
  /** Decides whether a thrown error is transient and worth retrying. */
  isRetryable?: (err: unknown) => boolean;
  /** Injectable for tests; defaults to real timers / clock / RNG. */
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  random?: () => number;
}

interface Job<T> {
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (err: unknown) => void;
}

/** Statuses that mean "try again later" rather than "this request is wrong". */
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

/** An error is retryable when it carries a transient HTTP status, or no status
 *  at all (a network-level failure such as a dropped connection). */
export function defaultIsRetryable(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  if (status === undefined) return true;
  return RETRYABLE_STATUS.has(status);
}

/** Full-jitter exponential backoff: a delay drawn uniformly from [0, cap), where
 *  cap = min(maxDelayMs, baseDelayMs * 2^attempt) and attempt is 0-based. */
export function computeBackoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  random: () => number,
): number {
  const cap = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
  return Math.floor(random() * cap);
}

export class RateLimitQueue {
  private readonly maxConcurrent: number;
  private readonly minIntervalMs: number;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly isRetryable: (err: unknown) => boolean;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private readonly random: () => number;

  private readonly pending: Job<unknown>[] = [];
  private inFlight = 0;
  private lastDispatchAt = -Infinity;
  private waiting = false;

  constructor(options: QueueOptions) {
    this.maxConcurrent = options.maxConcurrent;
    this.minIntervalMs = options.minIntervalMs;
    this.maxRetries = options.maxRetries;
    this.baseDelayMs = options.baseDelayMs;
    this.maxDelayMs = options.maxDelayMs;
    this.isRetryable = options.isRetryable ?? defaultIsRetryable;
    this.sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.now = options.now ?? (() => Date.now());
    this.random = options.random ?? Math.random;
  }

  /** Enqueue work. Resolves with its result once dispatched (respecting the
   *  concurrency and RPM limits) and any transient retries have settled. */
  add<T>(run: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pending.push({ run, resolve, reject } as Job<unknown>);
      this.pump();
    });
  }

  private pump(): void {
    if (this.pending.length === 0) return;
    if (this.inFlight >= this.maxConcurrent) return;

    const wait = this.lastDispatchAt + this.minIntervalMs - this.now();
    if (wait > 0) {
      if (!this.waiting) {
        this.waiting = true;
        void this.sleep(wait).then(() => {
          this.waiting = false;
          this.pump();
        });
      }
      return;
    }

    const job = this.pending.shift();
    if (!job) return;
    this.inFlight += 1;
    this.lastDispatchAt = this.now();
    void this.execute(job).finally(() => {
      this.inFlight -= 1;
      this.pump();
    });

    // Fill remaining concurrency slots (a no-op when spacing forces a wait).
    this.pump();
  }

  private async execute(job: Job<unknown>): Promise<void> {
    let attempt = 0;
    for (;;) {
      try {
        job.resolve(await job.run());
        return;
      } catch (err) {
        if (attempt >= this.maxRetries || !this.isRetryable(err)) {
          job.reject(err);
          return;
        }
        await this.sleep(
          computeBackoffDelay(attempt, this.baseDelayMs, this.maxDelayMs, this.random),
        );
        attempt += 1;
      }
    }
  }
}
