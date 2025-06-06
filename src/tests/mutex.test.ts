import { describe, it, expect, vi } from 'vitest';
import { Mutex } from '../lib/mutex';

describe('Mutex', () => {
  it('should execute functions in sequence', async () => {
    const mutex = new Mutex();
    const results: number[] = [];
    const delays = [30, 10, 20]; // Deliberately out of order

    // Start three concurrent operations with different delays
    const promises = delays.map((delay, index) =>
      mutex.lock(async () => {
        await new Promise((resolve) => setTimeout(resolve, delay));
        results.push(index);
        return index;
      }),
    );

    // Wait for all operations to complete
    await Promise.all(promises);

    // Results should be in sequence regardless of delays
    expect(results).toEqual([0, 1, 2]);
  });

  it('should maintain lock order and preserve return values', async () => {
    const mutex = new Mutex();

    const first = mutex.lock(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return 'first';
    });

    const second = mutex.lock(async () => {
      return 'second';
    });

    const results = await Promise.all([first, second]);
    expect(results).toEqual(['first', 'second']);
  });

  it('should release the lock even if the function throws', async () => {
    const mutex = new Mutex();
    const results: string[] = [];

    // First function that will throw
    const firstPromise = mutex
      .lock(async () => {
        results.push('first-start');
        await new Promise((resolve) => setTimeout(resolve, 10));
        results.push('first-end');
        throw new Error('Test error');
      })
      .catch((e) => {
        results.push('first-error');
        return 'error handled';
      });

    // Second function that should still execute despite the first one throwing
    const secondPromise = mutex.lock(async () => {
      results.push('second');
      return 'second complete';
    });

    await Promise.all([firstPromise, secondPromise]);

    expect(results).toEqual(['first-start', 'first-end', 'first-error', 'second']);
  });

  it('should handle many concurrent operations', async () => {
    const mutex = new Mutex();
    const results: number[] = [];
    const count = 50;

    const promises = Array.from({ length: count }, (_, i) =>
      mutex.lock(async () => {
        // Very short delay to simulate work
        await new Promise((resolve) => setTimeout(resolve, 1));
        results.push(i);
        return i;
      }),
    );

    await Promise.all(promises);

    // Should maintain order despite concurrent requests
    expect(results).toEqual(Array.from({ length: count }, (_, i) => i));
  });
});
