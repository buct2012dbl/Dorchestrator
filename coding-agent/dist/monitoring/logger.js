import { appendFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (LogLevel = {}));
export class Logger {
    level;
    logFile;
    buffer = [];
    flushInterval = null;
    constructor(level = LogLevel.INFO, logFile) {
        this.level = level;
        this.logFile = logFile;
        if (logFile) {
            this.ensureLogDirectory();
            this.startFlushInterval();
        }
    }
    async ensureLogDirectory() {
        if (!this.logFile)
            return;
        const dir = dirname(this.logFile);
        if (!existsSync(dir)) {
            await mkdir(dir, { recursive: true });
        }
    }
    startFlushInterval() {
        this.flushInterval = setInterval(() => {
            this.flush();
        }, 5000); // Flush every 5 seconds
    }
    debug(message, context) {
        this.log(LogLevel.DEBUG, message, context);
    }
    info(message, context) {
        this.log(LogLevel.INFO, message, context);
    }
    warn(message, context) {
        this.log(LogLevel.WARN, message, context);
    }
    error(message, context) {
        this.log(LogLevel.ERROR, message, context);
    }
    log(level, message, context) {
        if (level < this.level)
            return;
        const entry = {
            timestamp: new Date().toISOString(),
            level: LogLevel[level],
            message,
            context,
            error: context?.error
        };
        // Console output with colors
        this.logToConsole(entry);
        // Buffer for file output
        if (this.logFile) {
            this.buffer.push(entry);
        }
    }
    logToConsole(entry) {
        const colors = {
            DEBUG: '\x1b[36m', // Cyan
            INFO: '\x1b[32m', // Green
            WARN: '\x1b[33m', // Yellow
            ERROR: '\x1b[31m' // Red
        };
        const reset = '\x1b[0m';
        const color = colors[entry.level] || '';
        let output = `${color}[${entry.timestamp}] ${entry.level}${reset}: ${entry.message}`;
        if (entry.context && Object.keys(entry.context).length > 0) {
            output += `\n  ${JSON.stringify(entry.context, null, 2)}`;
        }
        console.log(output);
    }
    async flush() {
        if (!this.logFile || this.buffer.length === 0)
            return;
        const entries = this.buffer.splice(0);
        const lines = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
        try {
            await appendFile(this.logFile, lines);
        }
        catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }
    async close() {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }
        await this.flush();
    }
    setLevel(level) {
        this.level = level;
    }
    getLevel() {
        return this.level;
    }
}
// Global logger instance
const logLevel = process.env.LOG_LEVEL
    ? LogLevel[process.env.LOG_LEVEL]
    : LogLevel.WARN;
const logFile = process.env.LOG_FILE
    ? resolve(process.cwd(), process.env.LOG_FILE)
    : undefined;
export const logger = new Logger(logLevel, logFile);
// Graceful shutdown
process.on('beforeExit', async () => {
    await logger.close();
});
//# sourceMappingURL=logger.js.map