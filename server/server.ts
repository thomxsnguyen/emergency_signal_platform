import express from "express";
import cors from "cors";
import { getFromCache, setCache } from "./cache";

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const USGS_BASE_URL =
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary";

// Map time range to USGS API endpoint
const timeRangeMap: Record<string, string> = {
  hour: "all_hour.geojson",
  day: "all_day.geojson",
  week: "all_week.geojson",
  month: "all_month.geojson",
};

app.get("/api/earthquakes", async (req, res) => {
  try {
    const timeRange = (req.query.timeRange as string) || "hour";
    const endpoint = timeRangeMap[timeRange] || timeRangeMap.hour;
    const cacheKey = `earthquakes_${timeRange}`;

    // Check cache first
    const cachedData = getFromCache(cacheKey);
    if (cachedData) {
      console.log(`Cache hit for ${timeRange}`);
      return res.json(cachedData);
    }

    console.log(`Cache miss for ${timeRange}, fetching from USGS...`);
    const response = await fetch(`${USGS_BASE_URL}/${endpoint}`);
    const data = await response.json();

    const earthquakes = data.features.map((feature: any) => {
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

    const result = { earthquakes, count: earthquakes.length };

    // Store in cache
    setCache(cacheKey, result);

    res.json(result);
  } catch (error) {
    console.error("Error fetching earthquake data:", error);
    res.status(500).json({ error: "Failed to fetch earthquake data" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
