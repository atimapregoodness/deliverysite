import winston from "winston";
import "winston-daily-rotate-file";
import path from "path";
import fs from "fs";

const { createLogger, format, transports } = winston;
const { combine, timestamp, label, printf, colorize, errors, json } = format;

// Ensure log directory exists
const logDir = "logs";
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

/**
 * Custom log format for console
 */
const consoleFormat = printf(
  ({ level, message, label, timestamp, stack, ...metadata }) => {
    let log = `${timestamp} [${label}] ${level}: ${message}`;

    if (stack) {
      log += `\n${stack}`;
    }

    if (Object.keys(metadata).length > 0) {
      log += `\n${JSON.stringify(metadata, null, 2)}`;
    }

    return log;
  }
);

/**
 * Custom log format for files
 */
const fileFormat = printf(
  ({ level, message, label, timestamp, stack, ...metadata }) => {
    const logEntry = {
      timestamp,
      level,
      label,
      message,
      ...metadata,
    };

    if (stack) {
      logEntry.stack = stack;
    }

    return JSON.stringify(logEntry);
  }
);

/**
 * Create a custom logger instance
 */
class Logger {
  constructor() {
    this.logger = this.createWinstonLogger();
  }

  createWinstonLogger() {
    const isProduction = process.env.NODE_ENV === "production";
    const isDevelopment = process.env.NODE_ENV === "development";

    // Transport for daily rotating file for all logs
    const dailyRotateFileTransport = new transports.DailyRotateFile({
      filename: path.join(logDir, "application-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "30d",
      format: combine(timestamp(), errors({ stack: true }), fileFormat),
    });

    // Transport for error logs only
    const errorFileTransport = new transports.DailyRotateFile({
      level: "error",
      filename: path.join(logDir, "error-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "30d",
      format: combine(timestamp(), errors({ stack: true }), fileFormat),
    });

    // Transport for console
    const consoleTransport = new transports.Console({
      level: isDevelopment ? "debug" : "info",
      format: combine(
        colorize(),
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        label({ label: "DELIVERY-TRACKER" }),
        errors({ stack: true }),
        consoleFormat
      ),
    });

    const transportConfig = isProduction
      ? [dailyRotateFileTransport, errorFileTransport]
      : [dailyRotateFileTransport, errorFileTransport, consoleTransport];

    return createLogger({
      level: isProduction ? "info" : "debug",
      defaultMeta: {
        service: "delivery-tracker",
      },
      transports: transportConfig,
      exceptionHandlers: [
        new transports.File({
          filename: path.join(logDir, "exceptions.log"),
        }),
      ],
      rejectionHandlers: [
        new transports.File({
          filename: path.join(logDir, "rejections.log"),
        }),
      ],
      exitOnError: false,
    });
  }

  /**
   * Log info message
   */
  info(message, meta = {}) {
    this.logger.info(message, meta);
  }

  /**
   * Log error message
   */
  error(message, meta = {}) {
    this.logger.error(message, meta);
  }

  /**
   * Log warning message
   */
  warn(message, meta = {}) {
    this.logger.warn(message, meta);
  }

  /**
   * Log debug message
   */
  debug(message, meta = {}) {
    this.logger.debug(message, meta);
  }

  /**
   * Log verbose message
   */
  verbose(message, meta = {}) {
    this.logger.verbose(message, meta);
  }

  /**
   * Log HTTP requests
   */
  http(message, meta = {}) {
    this.logger.http(message, meta);
  }

  /**
   * Log delivery creation
   */
  deliveryCreated(delivery, admin) {
    this.info("Delivery created", {
      deliveryId: delivery.deliveryId,
      trackingCode: delivery.trackingCode,
      recipient: delivery.recipient.name,
      createdBy: admin?.username || "system",
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log delivery status update
   */
  deliveryStatusUpdated(deliveryId, oldStatus, newStatus, updatedBy) {
    this.info("Delivery status updated", {
      deliveryId,
      oldStatus,
      newStatus,
      updatedBy: updatedBy?.username || "system",
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log location update
   */
  locationUpdated(deliveryId, coordinates, driver) {
    this.debug("Location updated", {
      deliveryId,
      coordinates,
      driver: driver?.username || "system",
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log breakdown reported
   */
  breakdownReported(deliveryId, breakdown, reportedBy) {
    this.warn("Breakdown reported", {
      deliveryId,
      breakdownType: breakdown.type,
      severity: breakdown.severity,
      description: breakdown.description,
      reportedBy: reportedBy?.username || "system",
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log user authentication
   */
  userAuthenticated(user, method = "local") {
    this.info("User authenticated", {
      userId: user._id,
      username: user.username,
      role: user.role,
      method,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log user registration
   */
  userRegistered(user) {
    this.info("User registered", {
      userId: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log security event
   */
  securityEvent(event, user, details = {}) {
    this.warn("Security event", {
      event,
      userId: user?._id,
      username: user?.username,
      ip: details.ip,
      userAgent: details.userAgent,
      timestamp: new Date().toISOString(),
      ...details,
    });
  }

  /**
   * Log system performance
   */
  performance(operation, duration, meta = {}) {
    this.debug(`Performance: ${operation}`, {
      operation,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      ...meta,
    });
  }

  /**
   * Create a child logger with additional context
   */
  child(context) {
    const childLogger = this.logger.child(context);
    return {
      info: (message, meta) => childLogger.info(message, meta),
      error: (message, meta) => childLogger.error(message, meta),
      warn: (message, meta) => childLogger.warn(message, meta),
      debug: (message, meta) => childLogger.debug(message, meta),
      verbose: (message, meta) => childLogger.verbose(message, meta),
      http: (message, meta) => childLogger.http(message, meta),
    };
  }

  /**
   * Log database operations
   */
  database(operation, collection, duration, meta = {}) {
    this.debug(`Database ${operation}`, {
      operation,
      collection,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      ...meta,
    });
  }

  /**
   * Log email operations
   */
  email(operation, recipient, status, meta = {}) {
    this.info(`Email ${operation}`, {
      operation,
      recipient,
      status,
      timestamp: new Date().toISOString(),
      ...meta,
    });
  }

  /**
   * Log socket.io events
   */
  socketEvent(event, socketId, data = {}) {
    this.debug(`Socket event: ${event}`, {
      event,
      socketId,
      timestamp: new Date().toISOString(),
      data: this.sanitizeData(data),
    });
  }

  /**
   * Sanitize sensitive data for logging
   */
  sanitizeData(data) {
    const sensitiveFields = [
      "password",
      "token",
      "authorization",
      "cookie",
      "secret",
    ];

    const sanitize = (obj) => {
      if (typeof obj !== "object" || obj === null) return obj;

      const sanitized = Array.isArray(obj) ? [] : {};

      for (const [key, value] of Object.entries(obj)) {
        if (sensitiveFields.includes(key.toLowerCase())) {
          sanitized[key] = "***REDACTED***";
        } else if (typeof value === "object" && value !== null) {
          sanitized[key] = sanitize(value);
        } else {
          sanitized[key] = value;
        }
      }

      return sanitized;
    };

    return sanitize(data);
  }

  /**
   * Log API requests
   */
  apiRequest(method, url, statusCode, duration, user, ip) {
    const level = statusCode >= 400 ? "warn" : "info";

    this.logger.log(level, "API Request", {
      method,
      url,
      statusCode,
      duration: `${duration}ms`,
      userId: user?._id,
      username: user?.username,
      ip,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log API responses
   */
  apiResponse(method, url, statusCode, responseSize, duration) {
    this.http("API Response", {
      method,
      url,
      statusCode,
      responseSize: `${responseSize} bytes`,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  }
}

// Create and export singleton instance
const logger = new Logger();

export default logger;
