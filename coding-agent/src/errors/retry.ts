import { AppError } from './errors.js';
import { logger } from '../monitoring/logger.js';

export interface RetryOptions {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryableErrors: ['PROVIDER_ERROR', 'TIMEOUT', 'RATE_LIMIT', 'ECONNRESET', 'ETIMEDOUT']
};

export class RetryStrategy {
  private options: RetryOptions;

  constructor(options?: Partial<RetryOptions>) {
    this.options = { ...DEFAULT_RETRY_OPTIONS, ...options };
  }

  async execute<T>(
    fn: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<T> {
    let lastError: Error | undefined;
    let delay = this.options.initialDelay;

    for (let attempt = 1; attempt <= this.options.maxAttempts; attempt++) {
      try {
        logger.debug('Retry attempt', { attempt, context });
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (!this.isRetryable(error as Error)) {
          logger.warn('Non-retryable error, aborting', {
            error: (error as Error).message,
            context
          });
          throw error;
        }

        if (attempt === this.options.maxAttempts) {
          logger.error('Max retry attempts reached', {
            attempts: attempt,
            error: (error as Error).message,
            context
          });
          break;
        }

        logger.warn('Retryable error, waiting before retry', {
          attempt,
          delay,
          error: (error as Error).message,
          context
        });

        await this.sleep(delay);
        delay = Math.min(delay * this.options.backoffMultiplier, this.options.maxDelay);
      }
    }

    throw lastError;
  }

  private isRetryable(error: Error): boolean {
    if (error instanceof AppError) {
      return this.options.retryableErrors?.includes(error.code) || false;
    }

    // Check for network errors and common retryable patterns
    const message = error.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('econnreset') ||
      message.includes('etimedout') ||
      message.includes('network') ||
      message.includes('rate limit') ||
      message.includes('temporary')
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Decorator for automatic retry
export function withRetry(options?: Partial<RetryOptions>) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const retry = new RetryStrategy(options);

    descriptor.value = async function (...args: any[]) {
      return retry.execute(() => originalMethod.apply(this, args), {
        method: _propertyKey,
        args
      });
    };

    return descriptor;
  };
}

// Utility function for one-off retries
export async function retryAsync<T>(
  fn: () => Promise<T>,
  options?: Partial<RetryOptions>
): Promise<T> {
  const retry = new RetryStrategy(options);
  return retry.execute(fn);
}

// Exponential backoff calculator
export function calculateBackoff(
  attempt: number,
  initialDelay: number = 1000,
  maxDelay: number = 10000,
  multiplier: number = 2
): number {
  const delay = initialDelay * Math.pow(multiplier, attempt - 1);
  return Math.min(delay, maxDelay);
}

// Jittered backoff (adds randomness to prevent thundering herd)
export function calculateJitteredBackoff(
  attempt: number,
  initialDelay: number = 1000,
  maxDelay: number = 10000,
  multiplier: number = 2
): number {
  const baseDelay = calculateBackoff(attempt, initialDelay, maxDelay, multiplier);
  const jitter = Math.random() * 0.3 * baseDelay; // ±30% jitter
  return Math.floor(baseDelay + jitter);
}
