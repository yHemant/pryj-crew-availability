const express = require('express');
const { pool } = require('../db');

const router = express.Router();

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
        avail_time, avail_sttn, status, called_time, ack_time,
        sign_on_time, last_signoff_time, train_no, from_sttn, to_sttn, hq
      FROM crew_details
      WHERE ${whereClause}
      ORDER BY avail_time ASC, crew_name ASC
    `;

    const { rows } = await pool.query(query, params);

    return res.json({
      date: targetDate,
      station: upperStation,
      type: upperType,
      bucket: normalizedBucket,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error('Details error:', error);
    return res.status(500).json({ error: 'Failed to fetch details: ' + error.message });
  }
});

module.exports = router;

