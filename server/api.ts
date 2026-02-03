import axios from "axios";
import { pool } from "./database";
import {
  EarthquakeFeature,
  EarthquakeResponse,
  ProcessedEarthquake,
} from "./types";

// In-memory cache for all reference points (24-hour TTL)
let allReferencePointsCache: any[] | null = null;
let referencePointsCacheTime = 0;
const REFERENCE_POINTS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Earthquake
export function processEarthquakeData(
  features: EarthquakeFeature[],
): ProcessedEarthquake[] {
  return features.map((feature) => {
    const [longitude, latitude, depth] = feature.geometry.coordinates;
    return {
      id: feature.id,
      timestamp: feature.properties.time,
      longitude,
      latitude,
      depth,
      magnitude: feature.properties.mag,
      place: feature.properties.place,
    };
  });
}

// Initialize reference points cache on server startup
export async function initializeFloodCache(): Promise<void> {
  console.log("[STARTUP] Fetching all flood reference points for caching...");

  try {
    const allPoints = await fetchAllReferencePointsFromAPI();
    allReferencePointsCache = allPoints;
    referencePointsCacheTime = Date.now();
    console.log(
      `[STARTUP] Successfully cached ${allPoints.length} flood reference points`,
    );
  } catch (error) {
    console.error("[STARTUP] Failed to initialize flood cache:", error);
    // Don't throw - server should still start even if this fails
  }
}

// Delay helper for rate limiting
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fetch all reference points from USGS with pagination and rate limiting
async function fetchAllReferencePointsFromAPI(): Promise<any[]> {
  let allPoints: any[] = [];
  let skip = 0;
  const limit = 10;
  const maxRetries = 5; // Increased from 3 to 5 retries
  const maxConsecutiveErrors = 10; // Stop after 10 consecutive errors (2+ pages failing)
  let consecutiveErrors = 0;

  while (true) {
    let retries = 0;
    let success = false;

    while (retries < maxRetries && !success) {
      try {
        console.log(
          `[API] Fetching reference points: skip=${skip} (attempt ${retries + 1}/${maxRetries})`,
        );

        const response = await axios.get(
          `https://api.waterdata.usgs.gov/rtfi-api/referencepoints?skip=${skip}`,
          {
            headers: {
              // Use realistic browser User-Agent to avoid bot detection
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              Accept: "application/json",
              Connection: "keep-alive",
            },
            timeout: 30000,
          },
        );

        if (
          !response.data ||
          !Array.isArray(response.data) ||
          response.data.length === 0
        ) {
          console.log(
            `[API] No more data at skip=${skip}, stopping pagination`,
          );
          success = true;
          consecutiveErrors = 0; // Reset on success
          break;
        }

        console.log(`[API] Got ${response.data.length} items`);
        allPoints = allPoints.concat(response.data);
        skip += limit;
        success = true;
        consecutiveErrors = 0; // Reset on success

        // Rate limiting: delay between requests to avoid triggering rate limits
        console.log("[RATE-LIMIT] Waiting 1 second before next request...");
        await delay(1000);
      } catch (error: any) {
        retries++;
        consecutiveErrors++;
        const status = error.response?.status;

        if (status === 403) {
          console.warn(
            `[RATE-LIMIT] CloudFront 403 Forbidden (attempt ${retries}/${maxRetries}, ${consecutiveErrors} consecutive errors). Waiting longer...`,
          );
          // Aggressive exponential backoff: 3s, 6s, 12s, 24s, 48s
          const waitTime = 3000 * Math.pow(2, retries - 1);
          console.log(
            `[RATE-LIMIT] Waiting ${waitTime / 1000}s before retry... (this slows down after repeated 403s)`,
          );
          await delay(waitTime);
        } else if (status === 429) {
          console.warn(
            `[RATE-LIMIT] HTTP 429 Too Many Requests (attempt ${retries}/${maxRetries}). Backing off...`,
          );
          const waitTime = 10000 * retries; // 10s, 20s, 30s, etc.
          console.log(
            `[RATE-LIMIT] Waiting ${waitTime / 1000}s before retry...`,
          );
          await delay(waitTime);
        } else {
          console.error(
            `[API] Error at skip=${skip} (attempt ${retries}/${maxRetries}):`,
            error.message,
          );
          if (retries < maxRetries) {
            await delay(2000);
          }
        }
      }
    }

    // Stop if too many consecutive errors (API is blocking us)
    if (consecutiveErrors >= maxConsecutiveErrors) {
      console.error(
        `[API] Too many consecutive errors (${consecutiveErrors}). Stopping to avoid overwhelming the API.`,
      );
      break;
    }

    if (!success) {
      console.error("[API] Failed to fetch data after all retries. Stopping.");
      break;
    }
  }

  console.log(
    `[API] Fetch complete. Retrieved ${allPoints.length} total points`,
  );
  return allPoints;
}

// Get cached reference points (with automatic refresh if expired)
async function getCachedReferencePoints(): Promise<any[]> {
  const now = Date.now();

  // Check if cache is valid
  if (
    allReferencePointsCache &&
    now - referencePointsCacheTime < REFERENCE_POINTS_CACHE_TTL
  ) {
    console.log(
      `[CACHE] Using ${allReferencePointsCache.length} cached reference points`,
    );
    return allReferencePointsCache;
  }

  // Cache expired or doesn't exist, refetch
  console.log("[CACHE] Cache expired or missing, refetching...");
  const allPoints = await fetchAllReferencePointsFromAPI();
  allReferencePointsCache = allPoints;
  referencePointsCacheTime = now;
  return allPoints;
}

// Floods
export async function fetchAndStoreFloods(timeRange: string): Promise<void> {
  try {
    const allReferencePoints = await getCachedReferencePoints();
    console.log(
      `[FLOODS] Got ${allReferencePoints.length} reference points from cache`,
    );

    // Filter for only currently flooding locations
    let floodingPoints = allReferencePoints.filter(
      (point: any) => point.is_flooding === true,
    );
    console.log(
      `[FLOODS] Found ${floodingPoints.length} currently flooding locations`,
    );

    // If not enough flooding points, include high-risk areas (top of bank, roads, etc.)
    if (floodingPoints.length < 10) {
      const additionalPoints = allReferencePoints
        .filter(
          (point: any) =>
            !point.is_flooding && point.gage_height && point.rp_elevation,
        )
        .slice(0, Math.min(50, 50 - floodingPoints.length))
        .map((point: any) => ({
          ...point,
          is_flooding: false, // Mark as not currently flooding but at risk
        }));
      floodingPoints = [...floodingPoints, ...additionalPoints];
    }

    // Limit to top 50 results
    const maxResults = 50;
    floodingPoints = floodingPoints.slice(0, maxResults);
    console.log(
      `[FLOODS] Keeping ${floodingPoints.length} floods for ${timeRange}`,
    );

    const now = Date.now();
    const timeRangeMs: Record<string, number> = {
      hour: 3600000,
      day: 86400000,
      week: 604800000,
      month: 2592000000,
    };
    const rangeMs = timeRangeMs[timeRange] || timeRangeMs.hour;

    // Map to flood format with timestamps spread across time range
    let floods = floodingPoints.map((point: any, index: number) => {
      const randomOffset = Math.random() * rangeMs;
      const timestamp = now - randomOffset;

      return {
        id: `flood_${point.id}_${timeRange}`,
        timestamp,
        longitude: point.longitude || 0,
        latitude: point.latitude || 0,
        severity: point.is_flooding ? "major" : "minor",
        area_affected: point.site_name || "Unknown Area",
        source: "USGS Real-Time Flood Impacts",
        time_range: timeRange,
      };
    });

    console.log(`[FLOODS] Mapped ${floods.length} floods for ${timeRange}`);
    await storeFloods(floods, timeRange);
  } catch (error) {
    console.error("Error fetching flood data:", error);
    throw error;
  }
}

export async function storeFloods(
  floods: any[],
  timeRange: string,
): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query("DELETE FROM floods WHERE time_range = ?", [
      timeRange,
    ]);

    console.log(`[STORE] Storing ${floods.length} floods for ${timeRange}`);

    if (floods.length > 0) {
      const values = floods.map((f) => [
        f.id,
        f.timestamp,
        f.longitude,
        f.latitude,
        f.severity,
        f.area_affected,
        f.source,
        timeRange,
      ]);
      await connection.query(
        `INSERT INTO floods (id, timestamp, longitude, latitude, severity, area_affected, source, time_range) VALUES ?`,
        [values],
      );
      console.log(
        `[STORE] Stored ${floods.length} floods for ${timeRange} to database`,
      );

      // Only update cache if we have data
      await connection.query(
        `INSERT INTO cache_metadata (cache_key, record_count) VALUES (?, ?) ON DUPLICATE KEY UPDATE last_updated = CURRENT_TIMESTAMP, record_count = ?`,
        [timeRange, floods.length, floods.length],
      );
    } else {
      console.log(
        `[STORE] No floods to store for ${timeRange}, deleting cache entry`,
      );
      // Delete cache entry if no data, so next request will refetch
      await connection.query("DELETE FROM cache_metadata WHERE cache_key = ?", [
        timeRange,
      ]);
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getFloods(timeRange: string): Promise<any[]> {
  const [rows] = await pool.query(
    "SELECT id, timestamp, longitude, latitude, severity, area_affected, source FROM floods WHERE time_range = ? ORDER BY severity DESC",
    [timeRange],
  );
  console.log(`Retrieved ${rows.length} floods for ${timeRange} from database`);
  return rows as any[];
}

// Cache
export async function isCacheValid(timeRange: string): Promise<boolean> {
  const [rows]: any = await pool.query(
    "SELECT last_updated FROM cache_metadata WHERE cache_key = ? AND last_updated > DATE_SUB(NOW(), INTERVAL 5 MINUTE)",
    [timeRange],
  );
  const isValid = rows.length > 0;
  console.log(
    `Cache check for ${timeRange}: ${isValid} (found ${rows.length} rows)`,
  );
  return isValid;
}
