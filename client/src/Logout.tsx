import React from "react";

interface LogoutProps {
  onLogout: () => void;
}

export default function Logout({ onLogout }: LogoutProps) {
  const handleLogout = () => {
    // Clear all auth-related data from localStorage
    localStorage.removeItem("token");
    localStorage.removeItem("idToken");
    localStorage.removeItem("user");

    // Call parent logout handler
    onLogout();
  };

  return (
    <button onClick={handleLogout} className="logout-button">
      Logout
    </button>
  );
}
