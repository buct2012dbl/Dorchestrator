export declare class AppError extends Error {
    code: string;
    statusCode: number;
    isOperational: boolean;
    context?: Record<string, any> | undefined;
    constructor(message: string, code: string, statusCode?: number, isOperational?: boolean, context?: Record<string, any> | undefined);
}
export declare class ValidationError extends AppError {
    constructor(message: string, context?: Record<string, any>);
}
export declare class NotFoundError extends AppError {
    constructor(resource: string, id?: string);
}
export declare class ProviderError extends AppError {
    constructor(provider: string, message: string, context?: Record<string, any>);
}
export declare class RateLimitError extends AppError {
    constructor(provider: string, retryAfter?: number);
}
export declare class TimeoutError extends AppError {
    constructor(operation: string, timeout: number);
}
export declare class AgentError extends AppError {
    constructor(agentId: string, message: string, context?: Record<string, any>);
}
export declare class ToolError extends AppError {
    constructor(toolId: string, message: string, context?: Record<string, any>);
}
export declare function isOperationalError(error: Error): boolean;
export declare function formatError(error: Error): Record<string, any>;
//# sourceMappingURL=errors.d.ts.map