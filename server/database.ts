import mysql from "mysql2/promise";

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "earthquake_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// Create connection pool
export const pool = mysql.createPool(dbConfig);

// Initialize database schema
export async function initializeDatabase() {
  try {
    const connection = await pool.getConnection();

    // Create earthquakes table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS earthquakes (
        id VARCHAR(255) PRIMARY KEY,
        timestamp BIGINT NOT NULL,
        longitude DECIMAL(10, 6) NOT NULL,
        latitude DECIMAL(10, 6) NOT NULL,
        depth DECIMAL(10, 2),
        magnitude DECIMAL(3, 1),
        place VARCHAR(255),
        time_range VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_timestamp (timestamp),
        INDEX idx_time_range (time_range),
        INDEX idx_magnitude (magnitude)
      )
    `);

    // Create cache metadata table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS cache_metadata (
        cache_key VARCHAR(100) PRIMARY KEY,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        record_count INT DEFAULT 0
      )
    `);

    // Create floods table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS floods (
        id VARCHAR(255) PRIMARY KEY,
        timestamp BIGINT NOT NULL,
        longitude DECIMAL(10, 6) NOT NULL,
        latitude DECIMAL(10, 6) NOT NULL,
        severity VARCHAR(50),
        area_affected VARCHAR(255),
        source VARCHAR(255),
        time_range VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_timestamp (timestamp),
        INDEX idx_time_range (time_range),
        INDEX idx_severity (severity)
      )
    `);

    connection.release();
    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Database initialization error:", error);
    throw error;
  }
}

// Store earthquakes in database
export async function storeEarthquakes(
  earthquakes: any[],
  timeRange: string
): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Delete old data for this time range
    await connection.query("DELETE FROM earthquakes WHERE time_range = ?", [
      timeRange,
    ]);

    // Insert new data
    if (earthquakes.length > 0) {
      const values = earthquakes.map((eq) => [
        eq.id,
        eq.timestamp,
        eq.longitude,
        eq.latitude,
        eq.depth,
        eq.magnitude,
        eq.place,
        timeRange,
      ]);

      await connection.query(
        `INSERT INTO earthquakes 
         (id, timestamp, longitude, latitude, depth, magnitude, place, time_range) 
         VALUES ?`,
        [values]
      );
    }

    // Update cache metadata
    await connection.query(
      `INSERT INTO cache_metadata (cache_key, record_count) 
       VALUES (?, ?) 
       ON DUPLICATE KEY UPDATE 
       last_updated = CURRENT_TIMESTAMP, 
       record_count = ?`,
      [timeRange, earthquakes.length, earthquakes.length]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Retrieve earthquakes from database
export async function getEarthquakes(timeRange: string): Promise<any[]> {
  const [rows] = await pool.query(
    `SELECT id, timestamp, longitude, latitude, depth, magnitude, place 
     FROM earthquakes 
     WHERE time_range = ? 
     ORDER BY magnitude DESC`,
    [timeRange]
  );
  return rows as any[];
}

// Check if cache is valid (less than 5 minutes old)
export async function isCacheValid(timeRange: string): Promise<boolean> {
  const [rows]: any = await pool.query(
    `SELECT last_updated 
     FROM cache_metadata 
     WHERE cache_key = ? 
     AND last_updated > DATE_SUB(NOW(), INTERVAL 5 MINUTE)`,
    [timeRange]
  );
  return rows.length > 0;
}
