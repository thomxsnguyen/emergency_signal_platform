import React from "react";
import "../styles/AboutModal.css";

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AboutModal({ isOpen, onClose }: AboutModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ✕
        </button>
        <h2>About Faultline</h2>
        <p>
          Faultline is a real-time earthquake monitoring and emergency alert
          system designed to provide rapid situational awareness during seismic
          events.
        </p>
        <h3>Our Mission</h3>
        <p>
          To deliver accurate, timely earthquake data and emergency
          notifications to organizations and authorities, enabling faster
          response and better disaster preparedness.
        </p>
        <h3>Features</h3>
        <ul>
          <li>Real-time earthquake monitoring</li>
          <li>Interactive world map visualization</li>
          <li>Historical data analysis</li>
          <li>Secure authentication</li>
          <li>Multi-user support</li>
        </ul>
      </div>
    </div>
  );
}
