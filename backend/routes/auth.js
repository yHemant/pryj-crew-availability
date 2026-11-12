const express = require('express');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const router = express.Router();

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';
const JWT_SECRET = process.env.JWT_SECRET || 'pryj-crew-secret-key-fallback-2026';

/**
 * POST /api/login
 * Validates credentials against .env vars and returns a JWT.
 */
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = jwt.sign({ username }, JWT_SECRET, {
      expiresIn: '24h',
    });
    return res.json({ token, message: 'Login successful' });
  }

  return res.status(401).json({ error: 'Invalid credentials' });
});

module.exports = router;

