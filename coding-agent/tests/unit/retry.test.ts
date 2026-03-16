import { describe, it, expect, beforeEach } from 'vitest';
import { RetryStrategy, calculateBackoff, calculateJitteredBackoff } from '../../src/errors/retry.js';

describe('RetryStrategy', () => {
  let retry: RetryStrategy;

  beforeEach(() => {
    retry = new RetryStrategy({
      maxAttempts: 3,
      initialDelay: 100,
      maxDelay: 1000,
      backoffMultiplier: 2
    });
  });

  describe('execute', () => {
    it('should succeed on first attempt', async () => {
      const fn = async () => 'success';
      const result = await retry.execute(fn);

      expect(result).toBe('success');
    });

    it('should retry on failure', async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        if (attempts < 2) throw new Error('Temporary error');
        return 'success';
      };

      const result = await retry.execute(fn);

      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });

    it('should throw after max attempts', async () => {
      const fn = async () => {
        throw new Error('Persistent error');
      };

      await expect(retry.execute(fn)).rejects.toThrow('Persistent error');
    });

    it('should not retry non-retryable errors', async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        throw new Error('Non-retryable');
      };

      await expect(retry.execute(fn)).rejects.toThrow();
      expect(attempts).toBe(1);
    });
  });
});

describe('calculateBackoff', () => {
  it('should calculate exponential backoff', () => {
    expect(calculateBackoff(1, 1000, 10000, 2)).toBe(1000);
    expect(calculateBackoff(2, 1000, 10000, 2)).toBe(2000);
    expect(calculateBackoff(3, 1000, 10000, 2)).toBe(4000);
    expect(calculateBackoff(4, 1000, 10000, 2)).toBe(8000);
  });

  it('should respect max delay', () => {
    expect(calculateBackoff(10, 1000, 5000, 2)).toBe(5000);
  });
});

describe('calculateJitteredBackoff', () => {
  it('should add jitter to backoff', () => {
    const backoff1 = calculateJitteredBackoff(2, 1000, 10000, 2);
    const backoff2 = calculateJitteredBackoff(2, 1000, 10000, 2);

    // Should be around 2000 ± 30%
    expect(backoff1).toBeGreaterThan(1400);
    expect(backoff1).toBeLessThan(2600);

    // Should be different due to randomness
    expect(backoff1).not.toBe(backoff2);
  });
});
