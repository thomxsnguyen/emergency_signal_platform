import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

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

export const pool = mysql.createPool(dbConfig);

// ============================================
// DATABASE INITIALIZATION
// ============================================

export async function initializeDatabase() {
  try {
    const connection = await pool.getConnection();

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

    await connection.query(`
      CREATE TABLE IF NOT EXISTS cache_metadata (
        cache_key VARCHAR(100) PRIMARY KEY,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        record_count INT DEFAULT 0
      )
    `);

    // Users table for authentication
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255),
        firebase_uid VARCHAR(255),
        roles VARCHAR(255) DEFAULT 'user',
        is_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP NULL
      )
    `);

    // Ensure `firebase_uid` column exists for existing databases created before migration
    // MySQL doesn't support ALTER ... ADD COLUMN IF NOT EXISTS reliably across versions,
    // so check INFORMATION_SCHEMA and add the column only if missing.
    const [cols]: any = await connection.query(
      `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'firebase_uid'`,
      [dbConfig.database],
    );
    const exists = cols && cols[0] && cols[0].cnt > 0;
    if (!exists) {
      await connection.query(
        `ALTER TABLE users ADD COLUMN firebase_uid VARCHAR(255)`,
      );
    }

    connection.release();
    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Database initialization error:", error);
    throw error;
  }
}
