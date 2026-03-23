export class AppError extends Error {
    code;
    statusCode;
    isOperational;
    context;
    constructor(message, code, statusCode = 500, isOperational = true, context) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.context = context;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}
export class ValidationError extends AppError {
    constructor(message, context) {
        super(message, 'VALIDATION_ERROR', 400, true, context);
    }
}
export class NotFoundError extends AppError {
    constructor(resource, id) {
        super(`${resource}${id ? ` with id ${id}` : ''} not found`, 'NOT_FOUND', 404, true, { resource, id });
    }
}
export class ProviderError extends AppError {
    constructor(provider, message, context) {
        super(`Provider ${provider} error: ${message}`, 'PROVIDER_ERROR', 502, true, { provider, ...context });
    }
}
export class RateLimitError extends AppError {
    constructor(provider, retryAfter) {
        super(`Rate limit exceeded for ${provider}`, 'RATE_LIMIT', 429, true, { provider, retryAfter });
    }
}
export class TimeoutError extends AppError {
    constructor(operation, timeout) {
        super(`Operation ${operation} timed out after ${timeout}ms`, 'TIMEOUT', 408, true, { operation, timeout });
    }
}
export class AgentError extends AppError {
    constructor(agentId, message, context) {
        super(`Agent ${agentId} error: ${message}`, 'AGENT_ERROR', 500, true, { agentId, ...context });
    }
}
export class ToolError extends AppError {
    constructor(toolId, message, context) {
        super(`Tool ${toolId} error: ${message}`, 'TOOL_ERROR', 500, true, { toolId, ...context });
    }
}
export function isOperationalError(error) {
    if (error instanceof AppError) {
        return error.isOperational;
    }
    return false;
}
export function formatError(error) {
    if (error instanceof AppError) {
        return {
            name: error.name,
            message: error.message,
            code: error.code,
            statusCode: error.statusCode,
            context: error.context,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        };
    }
    return {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
}
//# sourceMappingURL=errors.js.map