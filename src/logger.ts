type LogLevel = 'debug' | 'none';

class Logger {
  private level: LogLevel = 'none';
  private output: Array<unknown> = [];

  setLevel(level: LogLevel) {
    this.level = level;
  }

  debug(...args: unknown[]) {
    this.output.push(...args);
    if (this.level === 'debug') {
      console.error(...args);
    }
  }
}

export const logger = new Logger();

// Set from environment variable if present
if (process.env.DEBUG === 'true' || process.env.DEBUG === '1') {
  logger.setLevel('debug');
}

