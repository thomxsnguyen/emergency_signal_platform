import { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const logDir = path.join(__dirname, "../logs");

// Ensure logs directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Log levels
export enum LogLevel {
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
  DEBUG = "DEBUG",
}

// Format log message
function formatLog(level: LogLevel, message: string, meta?: any): string {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` | ${JSON.stringify(meta)}` : "";
  return `[${timestamp}] [${level}] ${message}${metaStr}\n`;
}

// Write log to file
function writeLog(level: LogLevel, message: string, meta?: any): void {
  const logFile = path.join(logDir, `${level.toLowerCase()}.log`);
  const logMessage = formatLog(level, message, meta);

  fs.appendFile(logFile, logMessage, (err) => {
    if (err) console.error("Failed to write log:", err);
  });

  // Also log to console
  console.log(logMessage.trim());
}

// Logger object
export const logger = {
  info: (message: string, meta?: any) => writeLog(LogLevel.INFO, message, meta),
  warn: (message: string, meta?: any) => writeLog(LogLevel.WARN, message, meta),
  error: (message: string, meta?: any) =>
    writeLog(LogLevel.ERROR, message, meta),
  debug: (message: string, meta?: any) =>
    writeLog(LogLevel.DEBUG, message, meta),
};

// Request logging middleware
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  // Log request
  logger.info("Incoming request", {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
  });

  // Log response
  res.on("finish", () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 400 ? LogLevel.ERROR : LogLevel.INFO;

    writeLog(level, "Request completed", {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    });
  });

  next();
}

// Error logging middleware
export function errorLogger(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  logger.error("Request error", {
    error: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
  });

  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
}
