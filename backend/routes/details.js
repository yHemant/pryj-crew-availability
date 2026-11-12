const express = require('express');
const { pool } = require('../db');

const router = express.Router();

function formatFortnightHours(val) {
  if (val == null || val === '' || val === 'null' || val === 'undefined' || val === '-') {
    return '00:00';
  }
  const s = String(val).trim();
  if (s === '-' || s === '' || s === '0' || s === '00:00:00') return '00:00';

  // 1. If it's already in [hh]:mm format (e.g. "50:54" or "26:26" or "50:54:00")
  const match = s.match(/^(\d+):(\d{2})(?::\d{2})?$/);
  if (match) {
    const hrs = parseInt(match[1], 10);
    const mins = parseInt(match[2], 10);
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  // 2. If it was stored as an 1899/1900 Date string (from XLSX with cellDates: true)
  if (s.includes('1899-') || s.includes('1900-')) {
    const dt = new Date(s);
    if (!isNaN(dt.getTime())) {
      const baseMs = s.includes(':50')
        ? new Date('1899-12-29T18:38:50.000Z').getTime()
        : new Date('1899-12-30T00:00:00.000Z').getTime();
      const diffMs = dt.getTime() - baseMs;
      if (diffMs >= 0) {
        const totalMinutes = Math.round(diffMs / 60000);
        const hrs = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
      }
    }
  }

  // 3. If it's a numeric Excel serial days number (e.g. 2.12083333)
  const num = parseFloat(s);
  if (!isNaN(num)) {
    const totalMinutes = Math.round(num * 24 * 60);
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  return s;
}

/**
 * GET /api/crew/details?station=XXX&type=HQ|OS&bucket=0-4|4-8|8-16|16-24|TOTAL
 *
 * Returns the individual crew rows that make up a specific summary cell.
 * Replicates the exact same filtering logic used in /api/summary.
 */
router.get('/details', async (req, res) => {
  try {
    const { station, type, bucket } = req.query;

    if (!station || !type || !bucket) {
      return res.status(400).json({ error: 'Missing required query params: station, type, bucket' });
    }

    // 1. Determine target date (from query param or fallback to latest available)
    let targetDate = req.query.date;
    if (!targetDate) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      targetDate = `${year}-${month}-${day}`;
    }

    const checkRes = await pool.query(
      `SELECT 1 FROM crew_details WHERE DATE(avail_time) = $1 AND UPPER(TRIM(status)) IN ('REST', 'CALLED', 'BOOKED', 'LEAVE') LIMIT 1`,
      [targetDate]
    );
    if (checkRes.rows.length === 0) {
      const latestDateRes = await pool.query(`
        SELECT to_char(MAX(avail_time), 'YYYY-MM-DD') as max_dt
        FROM crew_details
        WHERE UPPER(TRIM(status)) IN ('REST', 'CALLED', 'BOOKED', 'LEAVE')
      `);
      if (latestDateRes.rows[0]?.max_dt) {
        targetDate = latestDateRes.rows[0].max_dt;
      }
    }

    // ── Build the WHERE clause dynamically ──
    const conditions = [];
    const params = [];
    let paramIdx = 1;

    // Station filter (support specific station or 'ALL' / 'TOTAL' for grand total)
    const upperStation = station.trim().toUpperCase();
    if (upperStation !== 'ALL' && upperStation !== 'TOTAL') {
      conditions.push(`UPPER(TRIM(avail_sttn)) = UPPER(TRIM($${paramIdx++}))`);
      params.push(station.trim());
    } else {
      conditions.push(`avail_sttn IS NOT NULL AND TRIM(avail_sttn) != ''`);
    }

    // Crew type filter (HQ vs OS)
    const upperType = type.trim().toUpperCase();
    if (upperType === 'HQ') {
      conditions.push(`UPPER(TRIM(avail_sttn)) = UPPER(TRIM(hq))`);
    } else if (upperType === 'OS') {
      conditions.push(`UPPER(TRIM(avail_sttn)) != UPPER(TRIM(hq))`);
    }

    // Date filter parameter
    const dateParam = `$${paramIdx++}`;
    params.push(targetDate);

    // Bucket + Status filter
    const statusBase = `UPPER(TRIM(status)) IN ('REST','CALLED','BOOKED')`;
    const normalizedBucket = bucket.trim().toUpperCase();

    switch (normalizedBucket) {
      case '0-4':
        conditions.push(`(
          DATE(avail_time) = ${dateParam}
          AND EXTRACT(HOUR FROM avail_time) >= 0
          AND EXTRACT(HOUR FROM avail_time) < 4
          AND ${statusBase}
        )`);
        break;

      case '4-8':
        // Normal 4-8 range on target date + LEAVE exception on target date
        conditions.push(`(
          (
            DATE(avail_time) = ${dateParam}
            AND EXTRACT(HOUR FROM avail_time) >= 4
            AND EXTRACT(HOUR FROM avail_time) < 8
            AND ${statusBase}
          )
          OR (
            UPPER(TRIM(status)) = 'LEAVE'
            AND DATE(avail_time) = ${dateParam}
          )
        )`);
        break;

      case '8-16':
        conditions.push(`(
          DATE(avail_time) = ${dateParam}
          AND EXTRACT(HOUR FROM avail_time) >= 8
          AND EXTRACT(HOUR FROM avail_time) < 16
          AND ${statusBase}
        )`);
        break;

      case '16-24':
        conditions.push(`(
          DATE(avail_time) = ${dateParam}
          AND EXTRACT(HOUR FROM avail_time) >= 16
          AND EXTRACT(HOUR FROM avail_time) < 24
          AND ${statusBase}
        )`);
        break;

      case 'TOTAL':
        // Union of all buckets matching the summary table on target date:
        conditions.push(`(
          (
            DATE(avail_time) = ${dateParam}
            AND EXTRACT(HOUR FROM avail_time) >= 0
            AND EXTRACT(HOUR FROM avail_time) < 24
            AND ${statusBase}
          )
          OR (
            UPPER(TRIM(status)) = 'LEAVE'
            AND DATE(avail_time) = ${dateParam}
          )
        )`);
        break;

      default:
        return res.status(400).json({ error: `Invalid bucket: ${bucket}` });
    }

    const whereClause = conditions.join(' AND ');

    const query = `
      SELECT
        sno, crew_id, crew_name, crew_designation, fortnight_hrs,
        to_char(avail_time, 'YYYY-MM-DD HH24:MI:SS') AS avail_time,
        avail_sttn, status, called_time, ack_time,
        sign_on_time, last_signoff_time, train_no, from_sttn, to_sttn, hq
      FROM crew_details
      WHERE ${whereClause}
      ORDER BY avail_time ASC, crew_name ASC
    `;

    const { rows } = await pool.query(query, params);

    const formattedRows = rows.map((r) => ({
      ...r,
      fortnight_hrs: formatFortnightHours(r.fortnight_hrs),
    }));

    return res.json({
      date: targetDate,
      station: upperStation,
      type: upperType,
      bucket: normalizedBucket,
      count: formattedRows.length,
      data: formattedRows,
    });
  } catch (error) {
    console.error('Details error:', error);
    return res.status(500).json({ error: 'Failed to fetch details: ' + error.message });
  }
});

module.exports = router;

