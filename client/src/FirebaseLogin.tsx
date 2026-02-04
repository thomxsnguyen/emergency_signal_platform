import React, { useEffect, useState } from "react";
import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  type Auth,
  type User,
} from "firebase/auth";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";

// Firebase config - REPLACE with your Firebase project credentials
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo",
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "demo.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "demo.appspot.com",
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "demo",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "demo",
};

interface Props {
  onLogin: (token: string) => void;
}

let firebaseApp: FirebaseApp | null = null;
let auth: Auth | null = null;

export default function FirebaseLogin({ onLogin }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Initialize Firebase
    if (!firebaseApp) {
      try {
        firebaseApp = initializeApp(firebaseConfig);
        auth = getAuth(firebaseApp);
      } catch (err: any) {
        setError("Firebase initialization failed. Check your .env config.");
        console.error(err);
      }
    }
  }, []);

  const handleGoogleLogin = async () => {
    if (!auth) {
      setError("Firebase not initialized");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();

      // Send token to backend to get/create user and session token
      const res = await fetch(`${API_BASE_URL}/auth/firebase-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");

      // Store Firebase token and notify parent
      localStorage.setItem("token", data.token);
      localStorage.setItem("idToken", idToken);
      setUser(result.user);
      onLogin(data.token);
    } catch (err: any) {
      setError(err.message || "Login failed");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-form">
        <h2>Emergency Signal Platform</h2>
        <p>Sign in with your Google account</p>
        {error && <div className="error">{error}</div>}
        {user && <div className="success">Welcome, {user.displayName}!</div>}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="google-login-btn"
        >
          {loading ? "Signing in..." : "Sign in with Google"}
        </button>
      </div>
    </div>
  );
}
