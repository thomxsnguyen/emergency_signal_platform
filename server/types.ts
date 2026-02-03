export interface EarthquakeFeature {
  id: string;
  properties: {
    time: number;
    mag: number;
    place: string;
  };
  geometry: {
    coordinates: [number, number, number];
  };
}

export interface EarthquakeResponse {
  features: EarthquakeFeature[];
}

export interface ProcessedEarthquake {
  id: string;
  timestamp: number;
  longitude: number;
  latitude: number;
  depth: number;
  magnitude: number;
  place: string;
}
