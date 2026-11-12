const express = require('express');
const { pool } = require('../db');

const router = express.Router();

/**
 * GET /api/summary
 *
 * Dynamically groups crew data by AVAIL STTN (station) and returns
 * counts broken into HQ/OS × time-bucket matrix.
 *
 * Time Buckets (based on AVAIL TIME hour-of-day):
 *   0-4   : hour >= 0  AND hour < 4
 *   4-8   : hour >= 4  AND hour < 8   (+ LEAVE exception)
 *   8-16  : hour >= 8  AND hour < 16
 *   16-24 : hour >= 16 AND hour < 24
 *
 * Status filter: only REST, CALLED, BOOKED.
 * LEAVE exception (4-8 only): also count rows where STATUS = 'LEAVE'
 *   AND avail_time >= start-of-today.
 */
router.get('/summary', async (req, res) => {
  try {
    // 1. Determine target date (from query param or default to today's local date)
    let targetDate = req.query.date;
    if (!targetDate) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      targetDate = `${year}-${month}-${day}`;
    }

    // 2. Fetch all available dates present in the data for active statuses
    const datesRes = await pool.query(`
      SELECT DISTINCT to_char(avail_time, 'YYYY-MM-DD') as dt
      FROM crew_details
      WHERE avail_time IS NOT NULL
        AND UPPER(TRIM(status)) IN ('REST', 'CALLED', 'BOOKED', 'LEAVE')
      ORDER BY dt DESC
    `);
    const availableDates = datesRes.rows.map(r => r.dt).filter(Boolean);

    // If targetDate has no active records but dates exist in the DB, fallback to the latest date
    const checkRes = await pool.query(
      `SELECT 1 FROM crew_details WHERE DATE(avail_time) = $1 AND UPPER(TRIM(status)) IN ('REST', 'CALLED', 'BOOKED', 'LEAVE') LIMIT 1`,
      [targetDate]
    );
    if (checkRes.rows.length === 0 && availableDates.length > 0) {
      targetDate = availableDates[0];
    }

    // 3. Main summary aggregation query filtered strictly by today's date
    const query = `
      SELECT
        UPPER(TRIM(avail_sttn)) AS station,
        CASE
          WHEN UPPER(TRIM(avail_sttn)) = UPPER(TRIM(hq)) THEN 'HQ'
          ELSE 'OS'
        END AS crew_type,

        /* ── 0-4 bucket (all earlier active crew + today 00:00 - 04:00) ── */
        COUNT(*) FILTER (WHERE
          (
            DATE(avail_time) < $1
            OR (
              DATE(avail_time) = $1
              AND EXTRACT(HOUR FROM avail_time) >= 0
              AND EXTRACT(HOUR FROM avail_time) < 4
            )
          )
          AND UPPER(TRIM(status)) IN ('REST','CALLED','BOOKED')
        ) AS "bucket_0_4",

        /* ── 4-8 bucket (today only + LEAVE exception on today's date) ── */
        COUNT(*) FILTER (WHERE
          (
            DATE(avail_time) = $1
            AND EXTRACT(HOUR FROM avail_time) >= 4
            AND EXTRACT(HOUR FROM avail_time) < 8
            AND UPPER(TRIM(status)) IN ('REST','CALLED','BOOKED')
          )
          OR (
            UPPER(TRIM(status)) = 'LEAVE'
            AND DATE(avail_time) = $1
          )
        ) AS "bucket_4_8",

        /* ── 8-16 bucket (today only) ── */
        COUNT(*) FILTER (WHERE
          DATE(avail_time) = $1
          AND EXTRACT(HOUR FROM avail_time) >= 8
          AND EXTRACT(HOUR FROM avail_time) < 16
          AND UPPER(TRIM(status)) IN ('REST','CALLED','BOOKED')
        ) AS "bucket_8_16",

        /* ── 16-24 bucket (today only) ── */
        COUNT(*) FILTER (WHERE
          DATE(avail_time) = $1
          AND EXTRACT(HOUR FROM avail_time) >= 16
          AND EXTRACT(HOUR FROM avail_time) < 24
          AND UPPER(TRIM(status)) IN ('REST','CALLED','BOOKED')
        ) AS "bucket_16_24"

      FROM crew_details
      WHERE avail_sttn IS NOT NULL AND TRIM(avail_sttn) != ''
      GROUP BY UPPER(TRIM(avail_sttn)), crew_type
      ORDER BY station, crew_type;
    `;

    const { rows } = await pool.query(query, [targetDate]);

    // Reshape into a station-keyed object for the frontend:
    // { station: { HQ: { "0-4": n, ... , total: n }, OS: { ... } } }
    const stationMap = {};

    for (const row of rows) {
      const station = row.station;
      if (!stationMap[station]) {
        stationMap[station] = {
          station,
          HQ: { '0-4': 0, '4-8': 0, '8-16': 0, '16-24': 0, total: 0 },
          OS: { '0-4': 0, '4-8': 0, '8-16': 0, '16-24': 0, total: 0 },
        };
      }

      const type = row.crew_type; // 'HQ' or 'OS'
      const b04  = parseInt(row.bucket_0_4, 10)  || 0;
      const b48  = parseInt(row.bucket_4_8, 10)  || 0;
      const b816 = parseInt(row.bucket_8_16, 10) || 0;
      const b1624= parseInt(row.bucket_16_24, 10)|| 0;

      stationMap[station][type] = {
        '0-4':  b04,
        '4-8':  b48,
        '8-16': b816,
        '16-24': b1624,
        total: b04 + b48 + b816 + b1624,
      };
    }

    const summary = Object.values(stationMap);

    // Also compute a grand-total row
    const grandTotal = {
      station: 'TOTAL',
      HQ: { '0-4': 0, '4-8': 0, '8-16': 0, '16-24': 0, total: 0 },
      OS: { '0-4': 0, '4-8': 0, '8-16': 0, '16-24': 0, total: 0 },
    };

    for (const s of summary) {
      for (const type of ['HQ', 'OS']) {
        for (const bucket of ['0-4', '4-8', '8-16', '16-24']) {
          grandTotal[type][bucket] += s[type][bucket];
        }
        grandTotal[type].total += s[type].total;
      }
    }

    return res.json({
      date: targetDate,
      availableDates,
      summary,
      grandTotal,
    });
  } catch (error) {
    console.error('Summary error:', error);
    return res.status(500).json({ error: 'Failed to generate summary: ' + error.message });
  }
});

module.exports = router;

