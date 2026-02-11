import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { getFromCache, setCache } from "./cache";
import { logger, requestLogger, errorLogger } from "./logger";
import { validateTimeRange, rateLimit } from "./middleware";
import { initializeDatabase } from "./database";
import { processEarthquakeData } from "./api";
import { EarthquakeResponse } from "./types";
import authRouter from "./auth";

// Load environment variables - server/.env takes priority
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config(); // Load server/.env first (current directory)
dotenv.config({ path: path.resolve(__dirname, "..", ".env") }); // Also load root .env for Firebase config

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const USGS_BASE_URL =
  process.env.USGS_API_URL ||
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary";

// Middleware
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
    methods: ["GET", "POST"],
    credentials: true,
  }),
);
app.use(express.json());
app.use(requestLogger);
app.use(rateLimit(100, 60000)); // 100 requests per minute

// Configuration
const TIME_RANGE_CONFIG: Record<string, string> = {
  hour: "all_hour.geojson",
  day: "all_day.geojson",
  week: "all_week.geojson",
  month: "all_month.geojson",
} as const;

// Health check endpoint
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: Date.now(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Main earthquake data endpoint
app.get(
  "/api/earthquakes",
  validateTimeRange,
  async (req: Request, res: Response) => {
    const timeRange = (req.query.timeRange as string) || "hour";
    const cacheKey = `earthquakes_${timeRange}`;

    try {
      // Check cache
      const cachedData = getFromCache(cacheKey);
      if (cachedData) {
        logger.info(`Cache hit for time range: ${timeRange}`);
        return res.json({
          ...cachedData,
          cached: true,
          source: "cache",
        });
      }

      // Fetch from USGS API
      logger.info(`Cache miss for ${timeRange}, fetching from USGS API`);
      const endpoint = TIME_RANGE_CONFIG[timeRange];
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(`${USGS_BASE_URL}/${endpoint}`, {
        headers: {
          "User-Agent": "EarthquakePlatform/1.0",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`USGS API returned status ${response.status}`);
      }

      const data: EarthquakeResponse = await response.json();

      // Defensive checks before processing
      if (!data || typeof data !== "object") {
        throw new Error("Invalid response format: response is not an object");
      }

      if (!data.features || !Array.isArray(data.features)) {
        throw new Error("Invalid response format from USGS API: missing or invalid features array");
      }

      if (data.features.length === 0) {
        logger.warn(`No earthquake data available for ${timeRange}`);
        return res.json({
          earthquakes: [],
          count: 0,
          timeRange,
          cached: false,
          source: "usgs",
          fetchedAt: new Date().toISOString(),
        });
      }

      const earthquakes = processEarthquakeData(data.features);
      const result = {
        earthquakes,
        count: earthquakes.length,
        timeRange,
        cached: false,
        source: "usgs",
        fetchedAt: new Date().toISOString(),
      };

      // Store in cache
      setCache(cacheKey, result);
      logger.info(`Cached ${earthquakes.length} earthquakes for ${timeRange}`);

      res.json(result);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error(`Error fetching earthquake data for ${timeRange}:`, {
        error: errorMessage,
      });

      res.status(500).json({
        error: "Failed to fetch earthquake data",
        message:
          process.env.NODE_ENV === "development" ? errorMessage : undefined,
        timeRange,
      });
    }
  },
);

// Auth routes
app.use("/auth", authRouter);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: "Not Found",
    message: "The requested endpoint does not exist",
  });
});

// Error handling middleware
app.use(errorLogger);

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM signal received: closing HTTP server");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT signal received: closing HTTP server");
  process.exit(0);
});

// Start server
app.listen(PORT, async () => {
  try {
    await initializeDatabase();
    logger.info(`Server started successfully`, {
      port: PORT,
      environment: process.env.NODE_ENV || "development",
      nodeVersion: process.version,
    });
  } catch (error) {
    logger.error("Failed to initialize database:", error);
    process.exit(1);
  }
});
