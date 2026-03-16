export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public isOperational: boolean = true,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 400, true, context);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      `${resource}${id ? ` with id ${id}` : ''} not found`,
      'NOT_FOUND',
      404,
      true,
      { resource, id }
    );
  }
}

export class ProviderError extends AppError {
  constructor(provider: string, message: string, context?: Record<string, any>) {
    super(
      `Provider ${provider} error: ${message}`,
      'PROVIDER_ERROR',
      502,
      true,
      { provider, ...context }
    );
  }
}

export class RateLimitError extends AppError {
  constructor(provider: string, retryAfter?: number) {
    super(
      `Rate limit exceeded for ${provider}`,
      'RATE_LIMIT',
      429,
      true,
      { provider, retryAfter }
    );
  }
}

export class TimeoutError extends AppError {
  constructor(operation: string, timeout: number) {
    super(
      `Operation ${operation} timed out after ${timeout}ms`,
      'TIMEOUT',
      408,
      true,
      { operation, timeout }
    );
  }
}

export class AgentError extends AppError {
  constructor(agentId: string, message: string, context?: Record<string, any>) {
    super(
      `Agent ${agentId} error: ${message}`,
      'AGENT_ERROR',
      500,
      true,
      { agentId, ...context }
    );
  }
}

export class ToolError extends AppError {
  constructor(toolId: string, message: string, context?: Record<string, any>) {
    super(
      `Tool ${toolId} error: ${message}`,
      'TOOL_ERROR',
      500,
      true,
      { toolId, ...context }
    );
  }
}

export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

export function formatError(error: Error): Record<string, any> {
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
