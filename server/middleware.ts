import { Request, Response, NextFunction } from "express";

// Validate time range parameter
export function validateTimeRange(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { timeRange } = req.query;
  const validRanges = ["hour", "day", "week", "month"];

  if (timeRange && !validRanges.includes(timeRange as string)) {
    return res.status(400).json({
      error: "Invalid time range",
      message: `Time range must be one of: ${validRanges.join(", ")}`,
      received: timeRange,
    });
  }

  next();
}

// Rate limiting middleware (simple implementation)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(maxRequests: number = 100, windowMs: number = 60000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || "unknown";
    const now = Date.now();
    const record = requestCounts.get(ip);

    if (!record || now > record.resetTime) {
      requestCounts.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      return res.status(429).json({
        error: "Too many requests",
        message: "Rate limit exceeded. Please try again later.",
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
      });
    }

    record.count++;
    next();
  };
}

// API key validation (optional security)
export function validateApiKey(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const apiKey = req.headers["x-api-key"];
  const validKey = process.env.API_KEY;

  // Skip validation if no API key is configured
  if (!validKey) {
    return next();
  }

  if (!apiKey || apiKey !== validKey) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or missing API key",
    });
  }

  next();
}
