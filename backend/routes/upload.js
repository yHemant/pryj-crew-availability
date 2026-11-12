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
 * Convert an Excel serial time/duration to absolute hours [hh]:mm string.
 * Excel serial for time is in days (e.g. 2.12083333 = 50 hours, 54 minutes).
 */
function parseFortnightHours(serial) {
  if (serial == null || serial === '' || serial === '-') return '00:00';
  if (typeof serial === 'number') {
    const totalMinutes = Math.round(serial * 24 * 60);
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }
  if (typeof serial === 'string') {
    const s = serial.trim();
    if (s === '-' || s === '' || s === '0' || s === '00:00:00') return '00:00';
    const m = s.match(/^(\d+):(\d{2})/);
    if (m) return `${m[1]}:${m[2]}`;
    const num = parseFloat(s);
    if (!isNaN(num)) {
      const totalMinutes = Math.round(num * 24 * 60);
      const hrs = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    }
    return s;
  }
  return String(serial);
}

/**
 * Convert an Excel serial date number to clean 'YYYY-MM-DD HH:mm:00' timestamp.
 * Round to nearest minute to eliminate any 10-second leap-second offset.
 */
function excelSerialToTimestamp(serial) {
  if (serial == null || serial === '' || serial === '-') return null;
  if (typeof serial === 'number') {
    const totalMinutes = Math.round(serial * 24 * 60);
    const daySerial = Math.floor(totalMinutes / (24 * 60));
    const minOfDay = totalMinutes % (24 * 60);
    const hour = Math.floor(minOfDay / 60);
    const minute = minOfDay % 60;

    // 25569 days between 1899-12-30 and 1970-01-01
    const jsEpochDays = daySerial - 25569;
    const utcMs = jsEpochDays * 86400000;
    const d = new Date(utcMs);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const hh = String(hour).padStart(2, '0');
    const mm = String(minute).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm}:00`;
  }
  if (typeof serial === 'string') {
    const s = serial.trim();
    if (s === '-' || s === '') return null;
    return s;
  }
  return null;
}

/**
 * Safely stringify a cell value for TEXT columns.
 */
function safeString(val) {
  if (val == null) return null;
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
    // Read the workbook without auto-converting to Date objects to preserve exact serial numbers
    const workbook = XLSX.readFile(filePath, { cellDates: false });
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

        // Parse Fortnight hours into absolute [hh]:mm
        vals.fortnight_hrs = parseFortnightHours(vals.fortnight_hrs);

        // Convert date/time serial numbers to clean 'YYYY-MM-DD HH:mm:00' timestamps
        vals.avail_time = excelSerialToTimestamp(vals.avail_time);
        vals.called_time = excelSerialToTimestamp(vals.called_time);
        vals.ack_time = excelSerialToTimestamp(vals.ack_time);
        vals.sign_on_time = excelSerialToTimestamp(vals.sign_on_time);
        vals.last_signoff_time = excelSerialToTimestamp(vals.last_signoff_time);

        // Build the parameter array in column order
        const params = DB_COLUMNS.map((col) => {
          if (col === 'fortnight_hrs') return vals.fortnight_hrs;
          if (['avail_time', 'called_time', 'ack_time', 'sign_on_time', 'last_signoff_time'].includes(col)) {
            return vals[col];
          }
          return safeString(vals[col]);
        });

        await client.query(insertSQL, params);
        insertedCount++;
      }

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

