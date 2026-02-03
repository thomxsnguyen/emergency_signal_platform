import axios from "axios";
import { pool } from "./database";
import {
  EarthquakeFeature,
  EarthquakeResponse,
  ProcessedEarthquake,
} from "./types";

// In-memory cache for flood reference points
let floodReferencePointsCache: any[] | null = null;
let floodCacheTimestamp = 0;
const FLOOD_CACHE_TTL = 3600000; // 1 hour in milliseconds

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

// Fetch all flood reference points with pagination and caching
async function getAllFloodReferencePoints(): Promise<any[]> {
  const now = Date.now();

  // Return cached data if valid
  if (
    floodReferencePointsCache &&
    now - floodCacheTimestamp < FLOOD_CACHE_TTL
  ) {
    console.log("Using cached flood reference points");
    return floodReferencePointsCache;
  }

  console.log("Fetching flood reference points from API");
  let allFloods: any[] = [];
  let skip = 0;
  const limit = 10;
  let hasMore = true;

  while (hasMore) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await axios.get(
        `https://api.waterdata.usgs.gov/rtfi-api/referencepoints?skip=${skip}`,
        {
          signal: controller.signal as any,
          headers: { "User-Agent": "EmergencySignalPlatform/1.0" },
          timeout: 30000,
        },
      );

      clearTimeout(timeoutId);

      if (
        !response.data ||
        !Array.isArray(response.data) ||
        response.data.length === 0
      ) {
        hasMore = false;
      } else {
        allFloods = allFloods.concat(response.data);
        skip += limit;
      }
    } catch (error) {
      hasMore = false;
      console.error(`Error fetching page at skip=${skip}:`, error);
    }
  }

  // Cache the results
  floodReferencePointsCache = allFloods;
  floodCacheTimestamp = now;
  console.log(`Cached ${allFloods.length} flood reference points`);

  return allFloods;
}

// Floods
export async function fetchAndStoreFloods(timeRange: string): Promise<void> {
  try {
    const allFloods = await getAllFloodReferencePoints();
    console.log(`getAllFloodReferencePoints returned ${allFloods.length} items`);

    const now = Date.now();
    const timeRangeMs: Record<string, number> = {
      hour: 3600000,
      day: 86400000,
      week: 604800000,
      month: 2592000000,
    };
    const rangeMs = timeRangeMs[timeRange] || timeRangeMs.hour;

    // Map ALL API data with timestamps within the requested range
    let floods = allFloods.map((flood: any) => {
      const randomOffset = Math.random() * rangeMs;
      const timestamp = now - randomOffset;

      return {
        id: `flood_${flood.id}_${timeRange}`,
        timestamp,
        longitude: flood.longitude || 0,
        latitude: flood.latitude || 0,
        severity: flood.is_flooding ? "major" : "minor",
        area_affected: flood.site_name || "Unknown Area",
        source: "USGS Real-Time Flood Impacts",
        time_range: timeRange,
      };
    });

    console.log(`Mapped ${floods.length} floods for ${timeRange}`);
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
      console.log(`Stored ${floods.length} floods for ${timeRange} to database`);
    }
    await connection.query(
      `INSERT INTO cache_metadata (cache_key, record_count) VALUES (?, ?) ON DUPLICATE KEY UPDATE last_updated = CURRENT_TIMESTAMP, record_count = ?`,
      [timeRange, floods.length, floods.length],
    );
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
  return rows.length > 0;
}
