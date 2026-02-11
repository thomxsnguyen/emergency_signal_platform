import { pool } from "./database";
import { logger } from "./logger";

export interface ValidationMetrics {
  timestamp: number;
  totalRequests: number;
  validationErrors: number;
  parsingErrors: number;
  successRate: number;
}

/**
 * Track validation metrics for measuring error reduction
 */
export async function logValidationMetrics(
  totalFeatures: number,
  validFeatures: number,
  errorCount: number
): Promise<void> {
  try {
    const connection = await pool.getConnection();

    // Create metrics table if it doesn't exist
    await connection.query(`
      CREATE TABLE IF NOT EXISTS validation_metrics (
        id INT AUTO_INCREMENT PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        total_features INT NOT NULL,
        valid_features INT NOT NULL,
        error_count INT NOT NULL,
        success_rate DECIMAL(5, 2) NOT NULL,
        INDEX idx_timestamp (timestamp)
      )
    `);

    const successRate = totalFeatures > 0 
      ? ((validFeatures / totalFeatures) * 100) 
      : 0;

    await connection.query(
      `INSERT INTO validation_metrics (total_features, valid_features, error_count, success_rate) 
       VALUES (?, ?, ?, ?)`,
      [totalFeatures, validFeatures, errorCount, successRate]
    );

    connection.release();

    logger.info("Validation metrics logged", {
      totalFeatures,
      validFeatures,
      errorCount,
      successRate: `${successRate.toFixed(2)}%`,
    });
  } catch (error) {
    logger.error("Failed to log validation metrics", { error });
  }
}

/**
 * Get validation metrics summary for reporting
 */
export async function getValidationMetricsSummary(): Promise<{
  avgSuccessRate: number;
  totalErrors: number;
  totalRecords: number;
}> {
  try {
    const [rows]: any = await pool.query(`
      SELECT 
        AVG(success_rate) as avg_success_rate,
        SUM(error_count) as total_errors,
        SUM(total_features) as total_records
      FROM validation_metrics
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);

    return {
      avgSuccessRate: rows[0]?.avg_success_rate || 0,
      totalErrors: rows[0]?.total_errors || 0,
      totalRecords: rows[0]?.total_records || 0,
    };
  } catch (error) {
    logger.error("Failed to get validation metrics summary", { error });
    return { avgSuccessRate: 0, totalErrors: 0, totalRecords: 0 };
  }
}
