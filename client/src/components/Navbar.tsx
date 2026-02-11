import React, { useState } from "react";
import "../styles/Navbar.css";

interface NavbarProps {
  onAboutClick: () => void;
}

export default function Navbar({ onAboutClick }: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Logo */}
        <div className="navbar-logo">
          <svg
            className="logo-icon"
            viewBox="0 0 40 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="20"
              cy="20"
              r="18"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M10 20 Q 20 10, 30 20 Q 20 30, 10 20"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
            />
            <circle cx="20" cy="20" r="3" fill="currentColor" />
          </svg>
          <span className="logo-text">Faultline</span>
        </div>

        {/* Menu toggle for mobile */}
        <button
          className="navbar-toggle"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle navigation"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        {/* Nav links */}
        <div className={`navbar-menu ${isOpen ? "active" : ""}`}>
          <button className="nav-link" onClick={onAboutClick}>
            About Us
          </button>
        </div>
      </div>
    </nav>
  );
}
