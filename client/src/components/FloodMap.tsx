import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface Flood {
  id: string;
  timestamp: number;
  longitude: number;
  latitude: number;
  severity: string;
  area_affected: string;
  source: string;
}

interface FloodMapProps {
  floods: Flood[];
}

// Scale marker radius based on severity
function getMarkerRadius(severity: string): number {
  switch (severity) {
    case "major":
      return 12;
    case "moderate":
      return 8;
    case "minor":
      return 5;
    default:
      return 4;
  }
}

// Color based on severity
function getMarkerColor(severity: string): string {
  switch (severity) {
    case "major":
      return "#0000ff"; // Blue
    case "moderate":
      return "#3399ff"; // Light blue
    case "minor":
      return "#99ccff"; // Very light blue
    default:
      return "#cccccc"; // Gray
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function FloodMap({ floods }: FloodMapProps) {
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
        {floods.map((flood) => (
          <CircleMarker
            key={flood.id}
            center={[flood.latitude, flood.longitude]}
            radius={getMarkerRadius(flood.severity)}
            fillColor={getMarkerColor(flood.severity)}
            color={getMarkerColor(flood.severity)}
            weight={1}
            opacity={0.8}
            fillOpacity={0.6}
          >
            <Popup>
              <div>
                <strong>{flood.area_affected || "Unknown area"}</strong>
                <br />
                <b>Severity:</b> {flood.severity}
                <br />
                <b>Source:</b> {flood.source}
                <br />
                <b>Time:</b> {formatDate(flood.timestamp)}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}

export default FloodMap;
