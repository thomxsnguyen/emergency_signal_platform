import axios from "axios";
import { pool } from "./database";
import {
  EarthquakeFeature,
  EarthquakeResponse,
  ProcessedEarthquake,
} from "./types";
import {
  validateEarthquakeResponse,
  validateAndFilterEarthquakes,
} from "./validation";
import { logger } from "./logger";

// Earthquake API with comprehensive validation
export function processEarthquakeData(
  features: EarthquakeFeature[]
): ProcessedEarthquake[] {
  return features.map((feature) => {
    const [longitude, latitude, depth] = feature.geometry.coordinates;
    
    // Defensive parsing with null coalescing and sanitization
    return {
      id: String(feature.id || `unknown-${Date.now()}`).trim(),
      timestamp: Number(feature.properties.time) || Date.now(),
      longitude: Number(longitude) || 0,
      latitude: Number(latitude) || 0,
      depth: depth !== null ? Number(depth) : 0,
      magnitude: feature.properties.mag !== null ? Number(feature.properties.mag) : 0,
      place: String(feature.properties.place || "Unknown location").trim().substring(0, 255),
    };
  });
}

export async function fetchAndStoreEarthquakes(timeRange: string): Promise<void> {
  try {
    const earthquakesResponse = await axios.get(
      `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_${timeRange}.geojson`
    );

    // Validate response structure before processing
    const validationResult = validateEarthquakeResponse(earthquakesResponse.data);

    if (!validationResult.success) {
      logger.error("Data validation failed", {
        errorCount: validationResult.errorCount,
        errors: validationResult.errors,
      });
      throw new Error(
        `Validation failed with ${validationResult.errorCount} errors`
      );
    }

    const response: EarthquakeResponse = validationResult.data!;
    
    // Additional feature-level validation with filtering
    const featureValidation = validateAndFilterEarthquakes(response.features);
    
    if (featureValidation.errorCount > 0) {
      logger.warn("Some earthquake features failed validation", {
        total: response.features.length,
        valid: featureValidation.validCount,
        invalid: featureValidation.errorCount,
      });
    }

    const processed = processEarthquakeData(featureValidation.data!);

    logger.info(`[EARTHQUAKES] Validated and processed ${processed.length} earthquakes for ${timeRange}`, {
      validationErrors: featureValidation.errorCount,
    });
    
    await storeEarthquakes(processed, timeRange);
  } catch (error) {
    logger.error("Error fetching earthquake data:", error);
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
