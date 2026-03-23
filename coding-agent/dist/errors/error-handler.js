import { isOperationalError, formatError } from './errors.js';
import { logger } from '../monitoring/logger.js';
export class ErrorHandler {
    static instance;
    constructor() {
        this.setupProcessHandlers();
    }
    static getInstance() {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler();
        }
        return ErrorHandler.instance;
    }
    setupProcessHandlers() {
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception', { error: formatError(error) });
            if (!isOperationalError(error)) {
                logger.error('Non-operational error, shutting down...');
                process.exit(1);
            }
        });
        process.on('unhandledRejection', (reason) => {
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
    handle(error, context) {
        logger.error('Error occurred', {
            error: formatError(error),
            context
        });
        if (!isOperationalError(error)) {
            logger.error('Non-operational error detected');
        }
    }
    async handleAsync(error, context) {
        this.handle(error, context);
    }
    gracefulShutdown() {
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
export function withErrorHandling(fn, context) {
    return (async (...args) => {
        try {
            return await fn(...args);
        }
        catch (error) {
            errorHandler.handle(error, context);
            throw error;
        }
    });
}
// Wrapper for sync functions with error handling
export function withErrorHandlingSync(fn, context) {
    return ((...args) => {
        try {
            return fn(...args);
        }
        catch (error) {
            errorHandler.handle(error, context);
            throw error;
        }
    });
}
//# sourceMappingURL=error-handler.js.map