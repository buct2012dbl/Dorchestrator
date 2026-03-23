export interface RateLimitConfig {
    maxRequests: number;
    windowMs: number;
    maxTokens?: number;
}
export declare class RateLimiter {
    private limits;
    private configs;
    setLimit(key: string, config: RateLimitConfig): void;
    checkLimit(key: string, tokens?: number): Promise<void>;
    getUsage(key: string): {
        count: number;
        tokens: number;
        resetAt: number;
    } | undefined;
    reset(key: string): void;
    resetAll(): void;
    getStats(): Record<string, any>;
}
export declare const rateLimiter: RateLimiter;
//# sourceMappingURL=rate-limiter.d.ts.map