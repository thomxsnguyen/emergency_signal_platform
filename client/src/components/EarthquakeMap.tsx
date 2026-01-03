import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface Earthquake {
  id: string;
  timestamp: number;
  longitude: number;
  latitude: number;
  depth: number;
  magnitude: number;
  place: string;
}

interface EarthquakeMapProps {
  earthquakes: Earthquake[];
}

// Scale marker radius based on magnitude
function getMarkerRadius(magnitude: number): number {
  if (magnitude === null || magnitude < 0) return 3;
  return Math.max(3, magnitude * 3);
}

// Color based on magnitude severity
function getMarkerColor(magnitude: number): string {
  if (magnitude >= 7) return "#ff0000"; // Red - major
  if (magnitude >= 5) return "#ff6600"; // Orange - moderate
  if (magnitude >= 3) return "#ffcc00"; // Yellow - light
  return "#00cc00"; // Green - minor
}

// Format timestamp to readable date
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function EarthquakeMap({ earthquakes }: EarthquakeMapProps) {
  return (
    <div className="map-wrapper">
      <MapContainer
        center={[20, 0]}
        zoom={2}
        style={{ height: "70vh", width: "95vw", maxWidth: "100%" }}
        scrollWheelZoom={true}
        minZoom={2}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {earthquakes.map((eq) => (
          <CircleMarker
            key={eq.id}
            center={[eq.latitude, eq.longitude]}
            radius={getMarkerRadius(eq.magnitude)}
            fillColor={getMarkerColor(eq.magnitude)}
            color={getMarkerColor(eq.magnitude)}
            weight={1}
            opacity={0.8}
            fillOpacity={0.6}
          >
            <Popup>
              <div>
                <strong>{eq.place || "Unknown location"}</strong>
                <br />
                <b>Magnitude:</b> {eq.magnitude ?? "N/A"}
                <br />
                <b>Depth:</b> {eq.depth?.toFixed(1) ?? "N/A"} km
                <br />
                <b>Time:</b> {formatDate(eq.timestamp)}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}

export default EarthquakeMap;
