import { appendFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

export enum LogLevel {
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

export class Logger {
  private level: LogLevel;
  private logFile?: string;
  private buffer: LogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(level: LogLevel = LogLevel.INFO, logFile?: string) {
    this.level = level;
    this.logFile = logFile;

    if (logFile) {
      this.ensureLogDirectory();
      this.startFlushInterval();
    }
  }

  private async ensureLogDirectory(): Promise<void> {
    if (!this.logFile) return;

    const dir = dirname(this.logFile);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }

  private startFlushInterval(): void {
    this.flushInterval = setInterval(() => {
      this.flush();
    }, 5000); // Flush every 5 seconds
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, context);
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    if (level < this.level) return;

    const entry: LogEntry = {
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

  private logToConsole(entry: LogEntry): void {
    const colors = {
      DEBUG: '\x1b[36m', // Cyan
      INFO: '\x1b[32m',  // Green
      WARN: '\x1b[33m',  // Yellow
      ERROR: '\x1b[31m'  // Red
    };

    const reset = '\x1b[0m';
    const color = colors[entry.level as keyof typeof colors] || '';

    let output = `${color}[${entry.timestamp}] ${entry.level}${reset}: ${entry.message}`;

    if (entry.context && Object.keys(entry.context).length > 0) {
      output += `\n  ${JSON.stringify(entry.context, null, 2)}`;
    }

    console.log(output);
  }

  private async flush(): Promise<void> {
    if (!this.logFile || this.buffer.length === 0) return;

    const entries = this.buffer.splice(0);
    const lines = entries.map(e => JSON.stringify(e)).join('\n') + '\n';

    try {
      await appendFile(this.logFile, lines);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  async close(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    await this.flush();
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }
}

// Global logger instance
const logLevel = process.env.LOG_LEVEL
  ? LogLevel[process.env.LOG_LEVEL as keyof typeof LogLevel]
  : LogLevel.WARN;

const logFile = process.env.LOG_FILE
  ? resolve(process.cwd(), process.env.LOG_FILE)
  : undefined;

export const logger = new Logger(logLevel, logFile);

// Graceful shutdown
process.on('beforeExit', async () => {
  await logger.close();
});
