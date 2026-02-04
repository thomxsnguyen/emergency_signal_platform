import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "./database";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";
const TOKEN_EXPIRY = "1h";

// Register
router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const connection = await pool.getConnection();
    try {
      await connection.query(
        `INSERT INTO users (email, password_hash) VALUES (?, ?)`,
        [email, password_hash],
      );
    } finally {
      connection.release();
    }

    return res.status(201).json({ ok: true });
  } catch (error: any) {
    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "User already exists" });
    }
    console.error("Register error:", error);
    return res.status(500).json({ error: "Registration failed" });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const [rows]: any = await pool.query(
      `SELECT id, email, password_hash FROM users WHERE email = ? LIMIT 1`,
      [email],
    );

    if (!rows || rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: TOKEN_EXPIRY,
    });

    // Update last_login
    await pool.query(`UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?`, [user.id]);

    return res.json({ token, user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Login failed" });
  }
});

// Me - protected route
router.get("/me", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing token" });
    }
    const token = auth.slice("Bearer ".length);
    const payload: any = jwt.verify(token, JWT_SECRET);
    const [rows]: any = await pool.query(`SELECT id, email FROM users WHERE id = ?`, [payload.sub]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: "User not found" });
    return res.json({ user: rows[0] });
  } catch (error: any) {
    return res.status(401).json({ error: "Invalid token" });
  }
});

export default router;
