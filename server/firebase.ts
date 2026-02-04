import admin from "firebase-admin";
import { Request, Response, NextFunction } from "express";
import path from "path";
import { createRequire } from "module";

// Initialize Firebase Admin SDK
// Make sure you have FIREBASE_SERVICE_ACCOUNT_JSON environment variable set
// Or place a service-account-key.json in the server directory
const require = createRequire(import.meta.url);
const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "./service-account-key.json";
const resolvedServiceAccountPath = path.isAbsolute(serviceAccountPath)
  ? serviceAccountPath
  : path.resolve(process.cwd(), serviceAccountPath);

try {
  const serviceAccount = require(resolvedServiceAccountPath);
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("[Firebase] Initialized successfully");
  }
} catch (error: any) {
  console.warn(
    "[Firebase] Could not initialize - ensure service account key is available",
  );
  if (error?.message) {
    console.warn(`[Firebase] ${error.message}`);
  }
}

// Middleware to verify Firebase token
export async function verifyFirebaseToken(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!admin.apps.length) {
      return res.status(500).json({ error: "Firebase not initialized" });
    }
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing token" });
    }

    const token = auth.slice("Bearer ".length);
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error: any) {
    console.error("[Firebase] Token verification failed:", error.message);
    return res.status(401).json({ error: "Invalid token" });
  }
}

// Get or create user in DB from Firebase user
export async function getOrCreateUser(firebaseUser: any) {
  const { pool } = await import("./database");
  const email = firebaseUser.email;
  const firebaseUid = firebaseUser.uid;

  if (!email) {
    throw new Error("Firebase user missing email");
  }

  const [rows]: any = await pool.query(
    "SELECT id FROM users WHERE email = ? LIMIT 1",
    [email],
  );

  if (rows && rows.length > 0) {
    return rows[0];
  }

  // Create new user
  const result: any = await pool.query(
    "INSERT INTO users (email, firebase_uid, password_hash) VALUES (?, ?, ?)",
    [
      email,
      firebaseUid,
      "", // Firebase-authenticated users don't have password hashes
    ],
  );

  return { id: result[0].insertId };
}

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}
