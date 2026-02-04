import { useState, useEffect, useCallback } from "react";
import "./App.css";
import EarthquakeMap from "./components/EarthquakeMap";
import ErrorBoundary from "./components/ErrorBoundary";
import Login from "./Login";
import FirebaseLogin from "./FirebaseLogin";
import Logout from "./Logout";

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

interface ApiResponse {
  earthquakes?: Earthquake[];
  count: number;
  cached?: boolean;
  source?: string;
}

interface FetchState {
  loading: boolean;
  error: string | null;
  earthquakes: Earthquake[];
}

function App() {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token"),
  );
  const [timeRange, setTimeRange] = useState<string>("hour");
  const [fetchState, setFetchState] = useState<FetchState>({
    loading: false,
    error: null,
    earthquakes: [],
  });

  const fetchData = useCallback(async (range: string) => {
    setFetchState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(
        `${API_BASE_URL}/api/earthquakes?timeRange=${range}`,
        {
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
        },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `Server responded with ${response.status}: ${response.statusText}`,
        );
      }

      const data: ApiResponse = await response.json();

      setFetchState({
        loading: false,
        error: null,
        earthquakes: data.earthquakes || [],
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
      });

      console.error("Error fetching data:", err);
    }
  }, []);

  useEffect(() => {
    if (token) fetchData(timeRange);
  }, [timeRange, fetchData, token]);

  const handleLogin = (t: string) => {
    setToken(t);
    // after login, fetch data
    fetchData(timeRange);
  };

  const handleLogout = () => {
    setToken(null);
  };

  const handleTimeRangeChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    setTimeRange(event.target.value);
  };

  const handleRetry = () => {
    fetchData(timeRange);
  };

  if (!token) {
    return <FirebaseLogin onLogin={handleLogin} />;
  }

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
            <div className="header-actions">
              <Logout onLogout={handleLogout} />
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
            <h3 className="tab-title">
              Earthquakes ({fetchState.earthquakes.length})
            </h3>
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
                  Displaying real-time disaster monitoring data. Check for
                  updates regularly.
                </p>
              </div>
            </div>
            <div className="stats">
              <div className="stat-card">
                <div className="stat-value">
                  {fetchState.earthquakes.length}
                </div>
                <div className="stat-label">Earthquakes Detected</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">
                  {TIME_RANGES.find((r) => r.value === timeRange)?.label}
                </div>
                <div className="stat-label">Time Period</div>
              </div>
            </div>
            <EarthquakeMap earthquakes={fetchState.earthquakes} />
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
