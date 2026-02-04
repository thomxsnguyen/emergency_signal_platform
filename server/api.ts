import axios from "axios";
import { pool } from "./database";
import {
  EarthquakeFeature,
  EarthquakeResponse,
  ProcessedEarthquake,
} from "./types";

// Earthquake API
export function processEarthquakeData(
  features: EarthquakeFeature[]
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

export async function fetchAndStoreEarthquakes(timeRange: string): Promise<void> {
  try {
    const earthquakesResponse = await axios.get(
      `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_${timeRange}.geojson`
    );

    const response: EarthquakeResponse = earthquakesResponse.data;
    const processed = processEarthquakeData(response.features);

    console.log(`[EARTHQUAKES] Got ${processed.length} earthquakes for ${timeRange}`);
    await storeEarthquakes(processed, timeRange);
  } catch (error) {
    console.error("Error fetching earthquake data:", error);
    throw error;
  }
}

export async function storeEarthquakes(
  earthquakes: ProcessedEarthquake[],
  timeRange: string
): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query("DELETE FROM earthquakes WHERE time_range = ?", [
      timeRange,
    ]);

    console.log(`[STORE] Storing ${earthquakes.length} earthquakes for ${timeRange}`);

    if (earthquakes.length > 0) {
      const values = earthquakes.map((e) => [
        e.id,
        e.timestamp,
        e.longitude,
        e.latitude,
        e.depth,
        e.magnitude,
        e.place,
        timeRange,
      ]);

      await connection.query(
        `INSERT INTO earthquakes (id, timestamp, longitude, latitude, depth, magnitude, place, time_range) VALUES ?`,
        [values]
      );

      console.log(`[STORE] Stored ${earthquakes.length} earthquakes to database`);

      // Update cache metadata
      await connection.query(
        `INSERT INTO cache_metadata (cache_key, record_count) VALUES (?, ?) ON DUPLICATE KEY UPDATE last_updated = CURRENT_TIMESTAMP, record_count = ?`,
        [timeRange, earthquakes.length, earthquakes.length]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getEarthquakes(timeRange: string): Promise<any[]> {
  const [rows] = await pool.query(
    "SELECT id, timestamp, longitude, latitude, depth, magnitude, place FROM earthquakes WHERE time_range = ? ORDER BY magnitude DESC",
    [timeRange]
  );
  console.log(`Retrieved ${rows.length} earthquakes for ${timeRange} from database`);
  return rows as any[];
}

// Cache
export async function isCacheValid(timeRange: string): Promise<boolean> {
  const [rows]: any = await pool.query(
    "SELECT last_updated FROM cache_metadata WHERE cache_key = ? AND last_updated > DATE_SUB(NOW(), INTERVAL 5 MINUTE)",
    [timeRange]
  );
  const isValid = rows.length > 0;
  console.log(
    `Cache check for ${timeRange}: ${isValid} (found ${rows.length} rows)`
  );
  return isValid;
}
