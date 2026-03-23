export interface RetryOptions {
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
    retryableErrors?: string[];
}
export declare class RetryStrategy {
    private options;
    constructor(options?: Partial<RetryOptions>);
    execute<T>(fn: () => Promise<T>, context?: Record<string, any>): Promise<T>;
    private isRetryable;
    private sleep;
}
export declare function withRetry(options?: Partial<RetryOptions>): (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
export declare function retryAsync<T>(fn: () => Promise<T>, options?: Partial<RetryOptions>): Promise<T>;
export declare function calculateBackoff(attempt: number, initialDelay?: number, maxDelay?: number, multiplier?: number): number;
export declare function calculateJitteredBackoff(attempt: number, initialDelay?: number, maxDelay?: number, multiplier?: number): number;
//# sourceMappingURL=retry.d.ts.map