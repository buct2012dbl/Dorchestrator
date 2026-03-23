export declare enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}
export interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
    context?: Record<string, any>;
    error?: any;
}
export declare class Logger {
    private level;
    private logFile?;
    private buffer;
    private flushInterval;
    constructor(level?: LogLevel, logFile?: string);
    private ensureLogDirectory;
    private startFlushInterval;
    debug(message: string, context?: Record<string, any>): void;
    info(message: string, context?: Record<string, any>): void;
    warn(message: string, context?: Record<string, any>): void;
    error(message: string, context?: Record<string, any>): void;
    private log;
    private logToConsole;
    private flush;
    close(): Promise<void>;
    setLevel(level: LogLevel): void;
    getLevel(): LogLevel;
}
export declare const logger: Logger;
//# sourceMappingURL=logger.d.ts.map