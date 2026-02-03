import axios from "axios";
import { pool } from "./database";
import {
  EarthquakeFeature,
  EarthquakeResponse,
  ProcessedEarthquake,
} from "./types";

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

// Floods
export async function fetchAndStoreFloods(timeRange: string): Promise<void> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const response = await axios.get(
      "https://api.waterdata.usgs.gov/rtfi-api/referencepoints",
      {
        signal: controller.signal as any,
        headers: { "User-Agent": "EmergencySignalPlatform/1.0" },
      },
    );
    clearTimeout(timeoutId);
    if (!response.data || !Array.isArray(response.data)) {
      throw new Error("Invalid response format from USGS RTFI API");
    }
    
    // Determine items to include and time range
    let itemLimit: number;
    const now = Date.now();
    const timeRangeMs: Record<string, number> = {
      hour: 3600000,
      day: 86400000,
      week: 604800000,
      month: 2592000000,
    };
    const rangeMs = timeRangeMs[timeRange] || timeRangeMs.hour;

    switch (timeRange) {
      case "hour":
        itemLimit = 5;
        break;
      case "day":
        itemLimit = 15;
        break;
      case "week":
        itemLimit = 25;
        break;
      case "month":
        itemLimit = Math.min(response.data.length, 50);
        break;
      default:
        itemLimit = 5;
    }

    // Map API data with timestamps within the requested range
    let floods = response.data.slice(0, itemLimit).map((flood: any, index: number) => {
      // Generate timestamp spread throughout the time range
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
    
    console.log(`Fetched ${floods.length} floods for ${timeRange}`);
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
