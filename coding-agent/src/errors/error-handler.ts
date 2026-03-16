import { isOperationalError, formatError } from './errors.js';
import { logger } from '../monitoring/logger.js';

export class ErrorHandler {
  private static instance: ErrorHandler;

  private constructor() {
    this.setupProcessHandlers();
  }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  private setupProcessHandlers(): void {
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception', { error: formatError(error) });

      if (!isOperationalError(error)) {
        logger.error('Non-operational error, shutting down...');
        process.exit(1);
      }
    });

    process.on('unhandledRejection', (reason: any) => {
      logger.error('Unhandled Rejection', { reason });

      if (reason instanceof Error && !isOperationalError(reason)) {
        logger.error('Non-operational error, shutting down...');
        process.exit(1);
      }
    });

    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      this.gracefulShutdown();
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully...');
      this.gracefulShutdown();
    });
  }

  handle(error: Error, context?: Record<string, any>): void {
    logger.error('Error occurred', {
      error: formatError(error),
      context
    });

    if (!isOperationalError(error)) {
      logger.error('Non-operational error detected');
    }
  }

  async handleAsync(error: Error, context?: Record<string, any>): Promise<void> {
    this.handle(error, context);
  }

  private gracefulShutdown(): void {
    // Give ongoing operations time to complete
    setTimeout(() => {
      logger.info('Forcing shutdown after timeout');
      process.exit(0);
    }, 10000);

    // Attempt graceful shutdown
    logger.info('Cleaning up resources...');
    process.exit(0);
  }
}

export const errorHandler = ErrorHandler.getInstance();

// Wrapper for async functions with error handling
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: Record<string, any>
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      errorHandler.handle(error as Error, context);
      throw error;
    }
  }) as T;
}

// Wrapper for sync functions with error handling
export function withErrorHandlingSync<T extends (...args: any[]) => any>(
  fn: T,
  context?: Record<string, any>
): T {
  return ((...args: Parameters<T>) => {
    try {
      return fn(...args);
    } catch (error) {
      errorHandler.handle(error as Error, context);
      throw error;
    }
  }) as T;
}
