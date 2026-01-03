import { useState, useEffect } from "react";
import "./App.css";
import EarthquakeMap from "./components/EarthquakeMap";

interface Earthquake {
  id: string;
  timestamp: number;
  longitude: number;
  latitude: number;
  depth: number;
  magnitude: number;
  place: string;
}

function App() {
  const [timeRange, setTimeRange] = useState("hour");
  const [earthquakes, setEarthquakes] = useState<Earthquake[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setTimeRange(event.target.value);
  };

  useEffect(() => {
    const fetchEarthquakes = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `http://localhost:3001/api/earthquakes?timeRange=${timeRange}`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch earthquake data");
        }
        const data = await response.json();
        setEarthquakes(data.earthquakes);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchEarthquakes();
  }, [timeRange]);

  return (
    <div className="app-container">
      <h1>Earthquake Data</h1>
      <label htmlFor="time-range">Select Time Range:</label>
      <select id="time-range" value={timeRange} onChange={handleChange}>
        <option value="hour">Past Hour</option>
        <option value="day">Past Day</option>
        <option value="week">Past Week</option>
        <option value="month">Past Month</option>
      </select>

      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && (
        <div>
          <p>Found {earthquakes.length} earthquakes</p>
          <EarthquakeMap earthquakes={earthquakes} />
        </div>
      )}
    </div>
  );
}

export default App;
