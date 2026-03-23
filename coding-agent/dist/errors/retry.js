import { AppError } from './errors.js';
import { logger } from '../monitoring/logger.js';
const DEFAULT_RETRY_OPTIONS = {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    retryableErrors: ['PROVIDER_ERROR', 'TIMEOUT', 'RATE_LIMIT', 'ECONNRESET', 'ETIMEDOUT']
};
export class RetryStrategy {
    options;
    constructor(options) {
        this.options = { ...DEFAULT_RETRY_OPTIONS, ...options };
    }
    async execute(fn, context) {
        let lastError;
        let delay = this.options.initialDelay;
        for (let attempt = 1; attempt <= this.options.maxAttempts; attempt++) {
            try {
                logger.debug('Retry attempt', { attempt, context });
                return await fn();
            }
            catch (error) {
                lastError = error;
                if (!this.isRetryable(error)) {
                    logger.warn('Non-retryable error, aborting', {
                        error: error.message,
                        context
                    });
                    throw error;
                }
                if (attempt === this.options.maxAttempts) {
                    logger.error('Max retry attempts reached', {
                        attempts: attempt,
                        error: error.message,
                        context
                    });
                    break;
                }
                logger.warn('Retryable error, waiting before retry', {
                    attempt,
                    delay,
                    error: error.message,
                    context
                });
                await this.sleep(delay);
                delay = Math.min(delay * this.options.backoffMultiplier, this.options.maxDelay);
            }
        }
        throw lastError;
    }
    isRetryable(error) {
        if (error instanceof AppError) {
            return this.options.retryableErrors?.includes(error.code) || false;
        }
        // Check for network errors and common retryable patterns
        const message = error.message.toLowerCase();
        return (message.includes('timeout') ||
            message.includes('econnreset') ||
            message.includes('etimedout') ||
            message.includes('network') ||
            message.includes('rate limit') ||
            message.includes('temporary'));
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
// Decorator for automatic retry
export function withRetry(options) {
    return function (_target, _propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        const retry = new RetryStrategy(options);
        descriptor.value = async function (...args) {
            return retry.execute(() => originalMethod.apply(this, args), {
                method: _propertyKey,
                args
            });
        };
        return descriptor;
    };
}
// Utility function for one-off retries
export async function retryAsync(fn, options) {
    const retry = new RetryStrategy(options);
    return retry.execute(fn);
}
// Exponential backoff calculator
export function calculateBackoff(attempt, initialDelay = 1000, maxDelay = 10000, multiplier = 2) {
    const delay = initialDelay * Math.pow(multiplier, attempt - 1);
    return Math.min(delay, maxDelay);
}
// Jittered backoff (adds randomness to prevent thundering herd)
export function calculateJitteredBackoff(attempt, initialDelay = 1000, maxDelay = 10000, multiplier = 2) {
    const baseDelay = calculateBackoff(attempt, initialDelay, maxDelay, multiplier);
    const jitter = Math.random() * 0.3 * baseDelay; // ±30% jitter
    return Math.floor(baseDelay + jitter);
}
//# sourceMappingURL=retry.js.map