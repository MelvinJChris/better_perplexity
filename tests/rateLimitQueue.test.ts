import { describe, expect, it } from 'vitest';
import { ProviderError } from '@/lib/providers/errors';
import {
  computeBackoffDelay,
  defaultIsRetryable,
  RateLimitQueue,
} from '@/lib/providers/rateLimitQueue';

/** Flush pending microtasks and the macrotask queue. */
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('computeBackoffDelay', () => {
  it('grows exponentially and is capped at maxDelayMs', () => {
    expect(computeBackoffDelay(0, 100, 1000, () => 1)).toBe(100);
    expect(computeBackoffDelay(1, 100, 1000, () => 1)).toBe(200);
    expect(computeBackoffDelay(2, 100, 1000, () => 1)).toBe(400);
    expect(computeBackoffDelay(5, 100, 1000, () => 1)).toBe(1000);
  });

  it('applies full jitter scaled by the RNG', () => {
    expect(computeBackoffDelay(3, 100, 1000, () => 0)).toBe(0);
    expect(computeBackoffDelay(3, 100, 1000, () => 0.5)).toBe(400);
  });
});

describe('defaultIsRetryable', () => {
  it('retries transient statuses and network-level failures', () => {
    expect(defaultIsRetryable(new ProviderError('x', 429))).toBe(true);
    expect(defaultIsRetryable(new ProviderError('x', 503))).toBe(true);
    expect(defaultIsRetryable(new Error('connection reset'))).toBe(true);
  });

  it('does not retry client errors', () => {
    expect(defaultIsRetryable(new ProviderError('x', 400))).toBe(false);
    expect(defaultIsRetryable(new ProviderError('x', 401))).toBe(false);
  });
});

describe('RateLimitQueue', () => {
  it('never exceeds maxConcurrent requests in flight', async () => {
    const queue = new RateLimitQueue({
      maxConcurrent: 2,
      minIntervalMs: 0,
      maxRetries: 0,
      baseDelayMs: 1,
      maxDelayMs: 1,
    });
    const started: number[] = [];
    const release: Array<() => void> = [];
    const make = (i: number) => () =>
      new Promise<number>((resolve) => {
        started.push(i);
        release[i] = () => resolve(i);
      });

    const all = [0, 1, 2, 3].map((i) => queue.add(make(i)));
    expect(started).toEqual([0, 1]);

    release[0]();
    await tick();
    expect(started).toEqual([0, 1, 2]);

    release[1]();
    await tick();
    expect(started).toEqual([0, 1, 2, 3]);

    release[2]();
    release[3]();
    expect(await Promise.all(all)).toEqual([0, 1, 2, 3]);
  });

  it('spaces dispatches by minIntervalMs using the injected clock', async () => {
    let t = 0;
    const queue = new RateLimitQueue({
      maxConcurrent: 1,
      minIntervalMs: 1000,
      maxRetries: 0,
      baseDelayMs: 1,
      maxDelayMs: 1,
      now: () => t,
      sleep: (ms) => {
        t += ms;
        return Promise.resolve();
      },
    });
    const dispatchedAt: number[] = [];
    const results = await Promise.all(
      [0, 1, 2].map((i) =>
        queue.add(() => {
          dispatchedAt.push(t);
          return Promise.resolve(i);
        }),
      ),
    );
    expect(results).toEqual([0, 1, 2]);
    expect(dispatchedAt).toEqual([0, 1000, 2000]);
  });

  it('retries a transient failure and then resolves', async () => {
    let calls = 0;
    const queue = new RateLimitQueue({
      maxConcurrent: 1,
      minIntervalMs: 0,
      maxRetries: 3,
      baseDelayMs: 10,
      maxDelayMs: 100,
      sleep: () => Promise.resolve(),
      random: () => 0,
    });
    const result = await queue.add(() => {
      calls += 1;
      if (calls < 3) throw new ProviderError('rate limited', 429);
      return Promise.resolve('ok');
    });
    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });

  it('gives up after maxRetries on a persistent transient failure', async () => {
    let calls = 0;
    const queue = new RateLimitQueue({
      maxConcurrent: 1,
      minIntervalMs: 0,
      maxRetries: 2,
      baseDelayMs: 1,
      maxDelayMs: 1,
      sleep: () => Promise.resolve(),
      random: () => 0,
    });
    await expect(
      queue.add(() => {
        calls += 1;
        return Promise.reject(new ProviderError('still down', 503));
      }),
    ).rejects.toThrow('still down');
    expect(calls).toBe(3);
  });

  it('does not retry a non-transient error', async () => {
    let calls = 0;
    const queue = new RateLimitQueue({
      maxConcurrent: 1,
      minIntervalMs: 0,
      maxRetries: 5,
      baseDelayMs: 1,
      maxDelayMs: 1,
      sleep: () => Promise.resolve(),
    });
    await expect(
      queue.add(() => {
        calls += 1;
        return Promise.reject(new ProviderError('bad request', 400));
      }),
    ).rejects.toThrow('bad request');
    expect(calls).toBe(1);
  });
});
