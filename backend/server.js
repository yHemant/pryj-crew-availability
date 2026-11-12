const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { pool, initDB, getDBStatus } = require('./db');

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
app.use('/api', authRoutes);          // POST /api/login
app.use('/api', uploadRoutes);        // POST /api/upload
app.use('/api', summaryRoutes);       // GET  /api/summary
app.use('/api/crew', detailsRoutes);  // GET  /api/crew/details

// ── Health check ──
app.get('/api/health', (req, res) => {
  const dbStatus = getDBStatus();
  res.json({
    status: dbStatus.ready ? 'ok' : 'initializing',
    database: dbStatus,
    timestamp: new Date().toISOString(),
  });
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

// ── Start HTTP server immediately so Render detects port binding ──
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 PRYJ Crew Availability Backend running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// ── Initialize Database asynchronously with retries for cold start ──
(async () => {
  const maxRetries = 5;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`⏳ Connecting to database (attempt ${attempt}/${maxRetries})...`);
      await initDB();
      return; // Connected successfully!
    } catch (err) {
      console.error(`❌ Database connection attempt ${attempt} failed:`, err.message);
      if (attempt < maxRetries) {
        console.log(`🔁 Retrying in 3 seconds (allowing database to wake up)...`);
        await new Promise((r) => setTimeout(r, 3000));
      } else {
        console.error('💥 All database connection attempts failed!');
        console.error('👉 Please verify your DATABASE_URL in Render Environment Variables.');
        if (!process.env.DATABASE_URL) {
          console.error('👉 DATABASE_URL is missing! Render needs a remote PostgreSQL connection string (e.g. from Neon).');
        }
      }
    }
  }
})();


