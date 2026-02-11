import { z } from "zod";
import { logger } from "./logger";

// Zod schema for USGS earthquake feature validation
export const EarthquakeFeatureSchema = z.object({
  id: z.string().min(1, "Earthquake ID is required"),
  properties: z.object({
    time: z
      .number()
      .positive("Time must be positive")
      .refine((t) => t <= Date.now() + 86400000, {
        message: "Earthquake time cannot be more than 1 day in the future",
      }),
    mag: z
      .number()
      .nullable()
      .refine((m) => m === null || (m >= -2 && m <= 10), {
        message: "Magnitude must be between -2 and 10",
      }),
    place: z.string().nullable().default("Unknown location"),
  }),
  geometry: z.object({
    coordinates: z
      .tuple([
        z
          .number()
          .min(-180, "Longitude must be >= -180")
          .max(180, "Longitude must be <= 180"),
        z
          .number()
          .min(-90, "Latitude must be >= -90")
          .max(90, "Latitude must be <= 90"),
        z.number().nullable(), // depth can be null or negative
      ])
      .refine(
        (coords) => coords[2] === null || coords[2] >= -100,
        "Depth cannot be less than -100km"
      ),
  }),
});

export const EarthquakeResponseSchema = z.object({
  features: z.array(EarthquakeFeatureSchema),
  metadata: z
    .object({
      generated: z.number().optional(),
      count: z.number().optional(),
    })
    .optional(),
});

// Validation results interface
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors: string[];
  errorCount: number;
  validCount: number;
}

/**
 * Validates earthquake data with comprehensive error reporting
 * @param data - Raw data from USGS API
 * @returns Validation result with detailed error information
 */
export function validateEarthquakeResponse(
  data: unknown
): ValidationResult<z.infer<typeof EarthquakeResponseSchema>> {
  const errors: string[] = [];
  let validCount = 0;
  let errorCount = 0;

  try {
    // First validate the overall structure
    const result = EarthquakeResponseSchema.safeParse(data);

    if (!result.success) {
      // Extract detailed error messages
      result.error.issues.forEach((issue) => {
        const path = issue.path.join(".");
        errors.push(`${path}: ${issue.message}`);
        errorCount++;
      });

      logger.error("Earthquake data validation failed", {
        errorCount: result.error.issues.length,
        errors: errors.slice(0, 5), // Log first 5 errors
      });

      return {
        success: false,
        errors,
        errorCount,
        validCount: 0,
      };
    }

    validCount = result.data.features.length;

    logger.info("Earthquake data validated successfully", {
      validCount,
      errorCount: 0,
    });

    return {
      success: true,
      data: result.data,
      errors: [],
      errorCount: 0,
      validCount,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown validation error";
    errors.push(errorMessage);

    logger.error("Unexpected validation error", { error: errorMessage });

    return {
      success: false,
      errors,
      errorCount: 1,
      validCount: 0,
    };
  }
}

/**
 * Validates individual earthquake features with partial success support
 * Filters out invalid entries and returns only valid ones
 */
export function validateAndFilterEarthquakes(
  features: unknown[]
): ValidationResult<z.infer<typeof EarthquakeFeatureSchema>[]> {
  const validFeatures: z.infer<typeof EarthquakeFeatureSchema>[] = [];
  const errors: string[] = [];
  let errorCount = 0;

  features.forEach((feature, index) => {
    const result = EarthquakeFeatureSchema.safeParse(feature);

    if (result.success) {
      validFeatures.push(result.data);
    } else {
      errorCount++;
      result.error.issues.forEach((issue) => {
        errors.push(`Feature ${index}: ${issue.path.join(".")} - ${issue.message}`);
      });
    }
  });

  logger.info("Earthquake feature validation completed", {
    total: features.length,
    valid: validFeatures.length,
    invalid: errorCount,
    successRate: `${((validFeatures.length / features.length) * 100).toFixed(1)}%`,
  });

  return {
    success: validFeatures.length > 0,
    data: validFeatures,
    errors: errors.slice(0, 10), // Return first 10 errors
    errorCount,
    validCount: validFeatures.length,
  };
}
