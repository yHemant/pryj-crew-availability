const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { initDB } = require('./db');

// Route imports
const authRoutes    = require('./routes/auth');
const uploadRoutes  = require('./routes/upload');
const summaryRoutes = require('./routes/summary');
const detailsRoutes = require('./routes/details');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ──
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── API Routes ──
app.use('/api', authRoutes);      // POST /api/login
app.use('/api', uploadRoutes);    // POST /api/upload
app.use('/api', summaryRoutes);   // GET  /api/summary
app.use('/api/crew', detailsRoutes); // GET  /api/crew/details

// ── Health check ──
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const fs = require('fs');

// ── Serve React build if built ──
const distPath = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else if (process.env.NODE_ENV === 'production') {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ── Start ──
(async () => {
  try {
    await initDB();
    app.listen(PORT, () => {
      console.log(`🚀 PRYJ Crew Availability Backend running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
})();

