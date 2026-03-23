export declare class ErrorHandler {
    private static instance;
    private constructor();
    static getInstance(): ErrorHandler;
    private setupProcessHandlers;
    handle(error: Error, context?: Record<string, any>): void;
    handleAsync(error: Error, context?: Record<string, any>): Promise<void>;
    private gracefulShutdown;
}
export declare const errorHandler: ErrorHandler;
export declare function withErrorHandling<T extends (...args: any[]) => Promise<any>>(fn: T, context?: Record<string, any>): T;
export declare function withErrorHandlingSync<T extends (...args: any[]) => any>(fn: T, context?: Record<string, any>): T;
//# sourceMappingURL=error-handler.d.ts.map