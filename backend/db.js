const { Pool, Client } = require('pg');
require('dotenv').config();

const dbHost = process.env.DB_HOST || '127.0.0.1';
const dbPort = parseInt(process.env.DB_PORT, 10) || 5432;
const dbUser = process.env.DB_USER || 'postgres';
const dbPassword = process.env.DB_PASSWORD || 'postgres';
const dbName = process.env.DB_NAME || 'crew_availability';

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    }
  : {
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbName,
    };

const pool = new Pool(poolConfig);

/**
 * Initialize database — ensure database exists and crew_details table is ready.
 */
const initDB = async () => {
  // If running locally without DATABASE_URL, ensure database exists
  if (!process.env.DATABASE_URL) {
    try {
      const adminClient = new Client({
        host: dbHost,
        port: dbPort,
        user: dbUser,
        password: dbPassword,
        database: 'postgres',
      });
      await adminClient.connect();
      const dbCheck = await adminClient.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [dbName]
      );
      if (dbCheck.rows.length === 0) {
        console.log(`Creating database '${dbName}'...`);
        await adminClient.query(`CREATE DATABASE "${dbName}"`);
        console.log(`✅ Database '${dbName}' created.`);
      }
      await adminClient.end();
    } catch (err) {
      console.warn('⚠️ Local database check warning:', err.message);
    }
  }

  // 2. Initialize table & indexes
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS crew_details (
      id            SERIAL PRIMARY KEY,
      sno           VARCHAR(50),
      crew_id       VARCHAR(100),
      crew_name     VARCHAR(255),
      crew_designation VARCHAR(100),
      fortnight_hrs VARCHAR(100),
      avail_time    TIMESTAMP,
      avail_sttn    VARCHAR(100),
      status        VARCHAR(50),
      called_time   TEXT,
      ack_time      TEXT,
      sign_on_time  TEXT,
      last_signoff_time TEXT,
      train_no      VARCHAR(100),
      from_sttn     VARCHAR(100),
      to_sttn       VARCHAR(100),
      hq            VARCHAR(100)
    );

    CREATE INDEX IF NOT EXISTS idx_crew_avail_sttn ON crew_details (avail_sttn);
    CREATE INDEX IF NOT EXISTS idx_crew_status ON crew_details (status);
    CREATE INDEX IF NOT EXISTS idx_crew_avail_time ON crew_details (avail_time);
    CREATE INDEX IF NOT EXISTS idx_crew_hq ON crew_details (hq);
  `;
  await pool.query(createTableQuery);
  console.log('✅ Database initialized — crew_details table ready.');
};

module.exports = { pool, initDB };


