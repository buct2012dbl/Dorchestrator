import { RateLimitError } from '../errors/errors.js';
import { logger } from './logger.js';

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  maxTokens?: number;
}

interface RateLimitEntry {
  count: number;
  tokens: number;
  resetAt: number;
}

export class RateLimiter {
  private limits = new Map<string, RateLimitEntry>();
  private configs = new Map<string, RateLimitConfig>();

  setLimit(key: string, config: RateLimitConfig): void {
    this.configs.set(key, config);
  }

  async checkLimit(key: string, tokens: number = 1): Promise<void> {
    const config = this.configs.get(key);
    if (!config) {
      return; // No limit configured
    }

    const now = Date.now();
    let entry = this.limits.get(key);

    // Reset if window expired
    if (!entry || now >= entry.resetAt) {
      entry = {
        count: 0,
        tokens: 0,
        resetAt: now + config.windowMs
      };
      this.limits.set(key, entry);
    }

    // Check request count
    if (entry.count >= config.maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      logger.warn('Rate limit exceeded', {
        key,
        count: entry.count,
        limit: config.maxRequests,
        retryAfter
      });
      throw new RateLimitError(key, retryAfter);
    }

    // Check token count
    if (config.maxTokens && entry.tokens + tokens > config.maxTokens) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      logger.warn('Token limit exceeded', {
        key,
        tokens: entry.tokens,
        limit: config.maxTokens,
        retryAfter
      });
      throw new RateLimitError(key, retryAfter);
    }

    // Update counts
    entry.count++;
    entry.tokens += tokens;
  }

  getUsage(key: string): { count: number; tokens: number; resetAt: number } | undefined {
    return this.limits.get(key);
  }

  reset(key: string): void {
    this.limits.delete(key);
  }

  resetAll(): void {
    this.limits.clear();
  }

  getStats(): Record<string, any> {
    const stats: Record<string, any> = {};

    for (const [key, entry] of this.limits.entries()) {
      const config = this.configs.get(key);
      stats[key] = {
        count: entry.count,
        tokens: entry.tokens,
        maxRequests: config?.maxRequests,
        maxTokens: config?.maxTokens,
        resetAt: new Date(entry.resetAt).toISOString(),
        utilization: config ? entry.count / config.maxRequests : 0
      };
    }

    return stats;
  }
}

// Global rate limiter
export const rateLimiter = new RateLimiter();

// Configure default limits for providers
rateLimiter.setLimit('anthropic', {
  maxRequests: 50,
  windowMs: 60000, // 1 minute
  maxTokens: 100000
});

rateLimiter.setLimit('openai', {
  maxRequests: 60,
  windowMs: 60000,
  maxTokens: 150000
});

rateLimiter.setLimit('ollama', {
  maxRequests: 100,
  windowMs: 60000
});
