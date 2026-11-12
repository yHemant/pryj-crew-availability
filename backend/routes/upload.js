const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { pool } = require('../db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.xlsx' && ext !== '.xls') {
      return cb(new Error('Only .xlsx and .xls files are allowed'));
    }
    cb(null, true);
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB limit
});

/**
 * Convert an Excel serial date number to a JS Date.
 * Excel epoch: Jan 1, 1900 (with the famous 1900-leap-year bug).
 */
function excelSerialToJSDate(serial) {
  if (serial == null || serial === '') return null;

  // Already a Date object (cellDates: true was used)
  if (serial instanceof Date) {
    return new Date(Math.round(serial.getTime() / 60000) * 60000);
  }

  // If it's a string, try to parse it directly
  if (typeof serial === 'string') {
    const d = new Date(serial);
    return isNaN(d.getTime()) ? null : new Date(Math.round(d.getTime() / 60000) * 60000);
  }

  // Numeric Excel serial
  if (typeof serial === 'number') {
    const utcDays = Math.floor(serial - 25569);
    const utcValue = utcDays * 86400;
    const fractionalDay = serial - Math.floor(serial);
    const totalSeconds = Math.round(fractionalDay * 86400);
    const date = new Date(0);
    date.setUTCSeconds(utcValue + totalSeconds);
    return new Date(Math.round(date.getTime() / 60000) * 60000);
  }

  return null;
}

/**
 * Safely stringify a cell value for TEXT columns.
 */
function safeString(val) {
  if (val == null) return null;
  if (val instanceof Date) {
    return val.toISOString();
  }
  return String(val);
}

// Map from Excel column headers → database column names
const COLUMN_MAP = {
  'SNO.': 'sno',
  'CREW ID': 'crew_id',
  'CREW NAME': 'crew_name',
  'CREW DESIGNATION': 'crew_designation',
  'FORTNIGHT Hrs': 'fortnight_hrs',
  'AVAIL TIME': 'avail_time',
  'AVAIL STTN': 'avail_sttn',
  'STATUS': 'status',
  'CALLED TIME': 'called_time',
  'ACK TIME': 'ack_time',
  'SIGN ON TIME': 'sign_on_time',
  'LAST SIGNOFF TIME': 'last_signoff_time',
  'TRAIN NO': 'train_no',
  'FROM STTN': 'from_sttn',
  'TO STTN': 'to_sttn',
  'HQ': 'hq',
};

const DB_COLUMNS = [
  'sno', 'crew_id', 'crew_name', 'crew_designation', 'fortnight_hrs',
  'avail_time', 'avail_sttn', 'status', 'called_time', 'ack_time',
  'sign_on_time', 'last_signoff_time', 'train_no', 'from_sttn', 'to_sttn', 'hq',
];

/**
 * POST /api/upload
 * Protected route. Accepts an Excel file, truncates the DB, parses & inserts rows.
 */
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const filePath = req.file.path;

  try {
    // Read the workbook
    const workbook = XLSX.readFile(filePath, { cellDates: true });
    const sheetName = workbook.SheetNames[0]; // Sheet1
    const sheet = workbook.Sheets[sheetName];

    // Convert to JSON — skip the first 9 rows (headers start at row 10)
    const rawData = XLSX.utils.sheet_to_json(sheet, { range: 9, defval: null });

    if (!rawData || rawData.length === 0) {
      return res.status(400).json({ error: 'No data found after row 10 in the uploaded file.' });
    }

    // ── TRUNCATE existing data ──
    await pool.query('TRUNCATE TABLE crew_details');

    // ── Batch insert using a transaction ──
    const client = await pool.connect();
    let insertedCount = 0;

    try {
      await client.query('BEGIN');

      const insertSQL = `
        INSERT INTO crew_details
          (${DB_COLUMNS.join(', ')})
        VALUES
          (${DB_COLUMNS.map((_, i) => `$${i + 1}`).join(', ')})
      `;

      for (const row of rawData) {
        // Build a values object from the Excel row
        const vals = {};
        for (const [excelCol, dbCol] of Object.entries(COLUMN_MAP)) {
          vals[dbCol] = row[excelCol] !== undefined ? row[excelCol] : null;
        }

        // Skip empty rows (no crew_id)
        if (!vals.crew_id) continue;

        // Convert avail_time to a proper timestamp
        vals.avail_time = excelSerialToJSDate(vals.avail_time);

        // Build the parameter array in column order
        const params = DB_COLUMNS.map((col) => {
          if (col === 'avail_time') return vals[col]; // already a Date or null
          if (['called_time', 'ack_time', 'sign_on_time', 'last_signoff_time'].includes(col)) {
            // These may be dates in Excel; store as text
            if (vals[col] instanceof Date) return vals[col].toISOString();
            return safeString(vals[col]);
          }
          return safeString(vals[col]);
        });

        await client.query(insertSQL, params);
        insertedCount++;
      }

      // Ensure all timestamps are cleanly aligned to exact minutes
      await client.query(`
        UPDATE crew_details
        SET avail_time = date_trunc('minute', avail_time + INTERVAL '30 seconds')
        WHERE avail_time IS NOT NULL
      `);

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    // Clean up uploaded file
    try { fs.unlinkSync(filePath); } catch (_) { /* ignore */ }

    return res.json({
      message: 'File uploaded and processed successfully.',
      rowsInserted: insertedCount,
    });
  } catch (error) {
    // Clean up on failure
    try { fs.unlinkSync(filePath); } catch (_) { /* ignore */ }
    console.error('Upload processing error:', error);
    return res.status(500).json({ error: 'Failed to process file: ' + error.message });
  }
});

module.exports = router;

