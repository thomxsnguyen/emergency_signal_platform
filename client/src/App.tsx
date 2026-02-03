import { useState, useEffect, useCallback } from "react";
import "./App.css";
import EarthquakeMap from "./components/EarthquakeMap";
import FloodMap from "./components/FloodMap";
import ErrorBoundary from "./components/ErrorBoundary";

// Constants
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const TIME_RANGES = [
  { value: "hour", label: "Past Hour" },
  { value: "day", label: "Past Day" },
  { value: "week", label: "Past Week" },
  { value: "month", label: "Past Month" },
] as const;

// Type definitions
interface Earthquake {
  id: string;
  timestamp: number;
  longitude: number;
  latitude: number;
  depth: number;
  magnitude: number;
  place: string;
}

interface Flood {
  id: string;
  timestamp: number;
  longitude: number;
  latitude: number;
  severity: string;
  area_affected: string;
  source: string;
}

interface ApiResponse {
  earthquakes?: Earthquake[];
  floods?: Flood[];
  count: number;
  cached?: boolean;
  source?: string;
}

interface FetchState {
  loading: boolean;
  error: string | null;
  earthquakes: Earthquake[];
  floods: Flood[];
}

function App() {
  const [timeRange, setTimeRange] = useState<string>("hour");
  const [fetchState, setFetchState] = useState<FetchState>({
    loading: false,
    error: null,
    earthquakes: [],
    floods: [],
  });
  const [activeTab, setActiveTab] = useState<"earthquakes" | "floods">("earthquakes");

  const fetchData = useCallback(async (range: string) => {
    setFetchState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      // Fetch earthquakes
      const eqController = new AbortController();
      const eqTimeoutId = setTimeout(() => eqController.abort(), 10000);

      const eqResponse = await fetch(
        `${API_BASE_URL}/api/earthquakes?timeRange=${range}`,
        {
          signal: eqController.signal,
          headers: { "Content-Type": "application/json" },
        }
      );

      clearTimeout(eqTimeoutId);

      if (!eqResponse.ok) {
        throw new Error(
          `Server responded with ${eqResponse.status}: ${eqResponse.statusText}`
        );
      }

      const eqData: ApiResponse = await eqResponse.json();

      // Fetch floods
      const floodController = new AbortController();
      const floodTimeoutId = setTimeout(() => floodController.abort(), 10000);

      const floodResponse = await fetch(
        `${API_BASE_URL}/api/floods?timeRange=${range}`,
        {
          signal: floodController.signal,
          headers: { "Content-Type": "application/json" },
        }
      );

      clearTimeout(floodTimeoutId);

      if (!floodResponse.ok) {
        throw new Error(
          `Server responded with ${floodResponse.status}: ${floodResponse.statusText}`
        );
      }

      const floodData: ApiResponse = await floodResponse.json();

      setFetchState({
        loading: false,
        error: null,
        earthquakes: eqData.earthquakes || [],
        floods: floodData.floods || [],
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.name === "AbortError"
            ? "Request timed out. Please try again."
            : err.message
          : "An unexpected error occurred";

      setFetchState({
        loading: false,
        error: errorMessage,
        earthquakes: [],
        floods: [],
      });

      console.error("Error fetching data:", err);
    }
  }, []);

  useEffect(() => {
    fetchData(timeRange);
  }, [timeRange, fetchData]);

  const handleTimeRangeChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    setTimeRange(event.target.value);
  };

  const handleRetry = () => {
    fetchData(timeRange);
  };

  return (
    <ErrorBoundary>
      <div className="app-container">
        <header className="app-header">
          <div className="official-banner">
            <p className="banner-text">
              An official website of the United States government
            </p>
          </div>
          <div className="header-content">
            <div className="header-seal">
              <div className="seal-circle">
                <span className="seal-text">USGS</span>
              </div>
            </div>
            <div className="header-titles">
              <h1>U.S. Geological Survey</h1>
              <h2 className="system-title">Emergency Hazards Program</h2>
              <p className="subtitle">
                Real-Time Disaster Monitoring & Notification System
              </p>
            </div>
          </div>
        </header>

        <div className="controls">
          <label htmlFor="time-range" className="time-range-label">
            Select Time Range:
          </label>
          <select
            id="time-range"
            value={timeRange}
            onChange={handleTimeRangeChange}
            disabled={fetchState.loading}
            className="time-range-select"
          >
            {TIME_RANGES.map((range) => (
              <option key={range.value} value={range.value}>
                {range.label}
              </option>
            ))}
          </select>
          <div className="tabs">
            <button
              className={`tab ${activeTab === "earthquakes" ? "active" : ""}`}
              onClick={() => setActiveTab("earthquakes")}
            >
              Earthquakes ({fetchState.earthquakes.length})
            </button>
            <button
              className={`tab ${activeTab === "floods" ? "active" : ""}`}
              onClick={() => setActiveTab("floods")}
            >
              Floods ({fetchState.floods.length})
            </button>
          </div>
        </div>

        {fetchState.loading && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading earthquake data...</p>
          </div>
        )}

        {fetchState.error && (
          <div className="error-state">
            <p className="error-message">⚠️ {fetchState.error}</p>
            <button onClick={handleRetry} className="retry-button">
              Retry
            </button>
          </div>
        )}

        {!fetchState.loading && !fetchState.error && (
          <div className="content">
            <div className="alert-box">
              <div className="alert-icon">⚠️</div>
              <div className="alert-content">
                <strong>Emergency Alert System</strong>
                <p>
                  Displaying real-time disaster monitoring data. Check for updates
                  regularly.
                </p>
              </div>
            </div>
            <div className="stats">
              {activeTab === "earthquakes" && (
                <>
                  <div className="stat-card">
                    <div className="stat-value">{fetchState.earthquakes.length}</div>
                    <div className="stat-label">Earthquakes Detected</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">
                      {TIME_RANGES.find((r) => r.value === timeRange)?.label}
                    </div>
                    <div className="stat-label">Time Period</div>
                  </div>
                </>
              )}
              {activeTab === "floods" && (
                <>
                  <div className="stat-card">
                    <div className="stat-value">{fetchState.floods.length}</div>
                    <div className="stat-label">Flood Events Detected</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">
                      {TIME_RANGES.find((r) => r.value === timeRange)?.label}
                    </div>
                    <div className="stat-label">Time Period</div>
                  </div>
                </>
              )}
            </div>
            {activeTab === "earthquakes" && (
              <EarthquakeMap earthquakes={fetchState.earthquakes} />
            )}
            {activeTab === "floods" && (
              <FloodMap floods={fetchState.floods} />
            )}
          </div>
        )}
        <footer className="app-footer">
          <div className="footer-content">
            <p>
              &copy; {new Date().getFullYear()} U.S. Geological Survey |
              Department of the Interior
            </p>
            <div className="footer-links">
              <a href="#">Privacy Policy</a>
              <a href="#">Accessibility</a>
              <a href="#">FOIA</a>
              <a href="#">Contact Us</a>
            </div>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
}

export default App;
