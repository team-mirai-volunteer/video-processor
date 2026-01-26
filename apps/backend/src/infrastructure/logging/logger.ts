/**
 * GCP Structured Logging implementation
 *
 * Cloud Loggingが認識するJSON形式でログを出力する。
 * console.log + JSON形式を採用し、Cloud Run推奨のstdout出力方式を使用。
 *
 * @see https://cloud.google.com/logging/docs/structured-logging
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

interface LogContext {
  [key: string]: unknown;
}

interface StructuredLog {
  severity: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  stack_trace?: string;
  httpRequest?: {
    requestMethod: string;
    requestUrl: string;
    status: number;
    userAgent?: string;
    latency?: string;
  };
}

interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error, context?: LogContext): void;
  critical(message: string, error?: Error, context?: LogContext): void;
}

class GcpLogger implements Logger {
  private readonly isProduction = process.env.NODE_ENV === 'production';

  private log(severity: LogLevel, message: string, context?: LogContext, error?: Error): void {
    // DEBUGは本番環境では出力しない
    if (severity === 'DEBUG' && this.isProduction) {
      return;
    }

    const entry: StructuredLog = {
      severity,
      message,
      timestamp: new Date().toISOString(),
    };

    if (context && Object.keys(context).length > 0) {
      entry.context = context;
    }

    // Error Reporting 統合: スタックトレースを message に含める
    if (error?.stack) {
      entry.message = `${message}\n${error.stack}`;
      entry.stack_trace = error.stack;
    }

    // stdout に JSON 出力 → Cloud Logging Agent が収集
    console.log(JSON.stringify(entry));
  }

  debug(message: string, context?: LogContext): void {
    this.log('DEBUG', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('INFO', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('WARNING', message, context);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.log('ERROR', message, context, error);
  }

  critical(message: string, error?: Error, context?: LogContext): void {
    this.log('CRITICAL', message, context, error);
  }
}

// シングルトンとしてエクスポート
export const logger = new GcpLogger();

// コンポーネント名を固定したロガーを作成するヘルパー
export function createLogger(component: string): Logger {
  return {
    debug: (msg, ctx) => logger.debug(`[${component}] ${msg}`, ctx),
    info: (msg, ctx) => logger.info(`[${component}] ${msg}`, ctx),
    warn: (msg, ctx) => logger.warn(`[${component}] ${msg}`, ctx),
    error: (msg, err, ctx) => logger.error(`[${component}] ${msg}`, err, ctx),
    critical: (msg, err, ctx) => logger.critical(`[${component}] ${msg}`, err, ctx),
  };
}

export type { Logger };
