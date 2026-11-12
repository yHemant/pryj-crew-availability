const express = require('express');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const router = express.Router();

/**
 * POST /api/login
 * Validates credentials against .env vars and returns a JWT.
 */
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (
    username === process.env.ADMIN_USER &&
    password === process.env.ADMIN_PASS
  ) {
    const token = jwt.sign({ username }, process.env.JWT_SECRET, {
      expiresIn: '24h',
    });
    return res.json({ token, message: 'Login successful' });
  }

  return res.status(401).json({ error: 'Invalid credentials' });
});

module.exports = router;

