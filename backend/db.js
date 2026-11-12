const { Pool, Client } = require('pg');
require('dotenv').config();

const dbHost = process.env.DB_HOST || '127.0.0.1';
const dbPort = parseInt(process.env.DB_PORT, 10) || 5432;
const dbUser = process.env.DB_USER || 'postgres';
const dbPassword = process.env.DB_PASSWORD || 'postgres';
const dbName = process.env.DB_NAME || 'crew_availability';

const hasDatabaseUrl = !!process.env.DATABASE_URL;

if (hasDatabaseUrl) {
  const masked = process.env.DATABASE_URL.replace(/:([^:@]+)@/, ':****@');
  console.log(`🔌 Database: Connecting via DATABASE_URL (${masked})`);
} else {
  console.warn(`⚠️ Database: DATABASE_URL not detected! Falling back to ${dbHost}:${dbPort}/${dbName}`);
  if (process.env.NODE_ENV === 'production') {
    console.warn(`⚠️ Warning: In production, please set DATABASE_URL in Render's Environment Variables tab.`);
  }
}

const poolConfig = hasDatabaseUrl
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    }
  : {
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      connectionTimeoutMillis: 5000,
    };

const pool = new Pool(poolConfig);

let dbReady = false;
let dbError = null;

const getDBStatus = () => ({
  ready: dbReady,
  hasDatabaseUrl,
  error: dbError,
});

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
        connectionTimeoutMillis: 3000,
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
      console.warn('⚠️ Local database check note:', err.message);
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

  try {
    await pool.query(createTableQuery);
    dbReady = true;
    dbError = null;
    console.log('✅ Database connected & crew_details table ready.');
  } catch (err) {
    dbError = err.message;
    throw err;
  }
};

module.exports = { pool, initDB, getDBStatus };



