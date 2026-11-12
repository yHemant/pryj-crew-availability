const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function setup() {
  console.log('Connecting to PostgreSQL server...');
  const adminClient = new Client({
    user: 'postgres',
    host: '127.0.0.1',
    port: 5432,
    database: 'postgres',
  });

  await adminClient.connect();
  console.log('Connected to default postgres database.');

  // Check if crew_availability database exists
  const checkRes = await adminClient.query(
    "SELECT 1 FROM pg_database WHERE datname = 'crew_availability'"
  );

  if (checkRes.rows.length === 0) {
    console.log("Creating database 'crew_availability'...");
    await adminClient.query('CREATE DATABASE crew_availability');
    console.log("✅ Database 'crew_availability' created!");
  } else {
    console.log("Database 'crew_availability' already exists.");
  }
  await adminClient.end();

  // Now connect to crew_availability database and run init.sql
  console.log("Connecting to 'crew_availability' database...");
  const appClient = new Client({
    user: 'postgres',
    host: '127.0.0.1',
    port: 5432,
    database: 'crew_availability',
  });

  await appClient.connect();
  console.log("Connected to 'crew_availability' database.");

  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS crew_details (
      id                SERIAL PRIMARY KEY,
      sno               VARCHAR(50),
      crew_id           VARCHAR(100),
      crew_name         VARCHAR(255),
      crew_designation  VARCHAR(100),
      fortnight_hrs     VARCHAR(100),
      avail_time        TIMESTAMP,
      avail_sttn        VARCHAR(100),
      status            VARCHAR(50),
      called_time       TEXT,
      ack_time          TEXT,
      sign_on_time      TEXT,
      last_signoff_time TEXT,
      train_no          VARCHAR(100),
      from_sttn         VARCHAR(100),
      to_sttn           VARCHAR(100),
      hq                VARCHAR(100)
    );

    CREATE INDEX IF NOT EXISTS idx_crew_avail_sttn ON crew_details (avail_sttn);
    CREATE INDEX IF NOT EXISTS idx_crew_status     ON crew_details (status);
    CREATE INDEX IF NOT EXISTS idx_crew_avail_time ON crew_details (avail_time);
    CREATE INDEX IF NOT EXISTS idx_crew_hq         ON crew_details (hq);
  `;

  await appClient.query(createTableQuery);
  console.log("✅ Table 'crew_details' and indexes created successfully!");

  // Verify table
  const testRes = await appClient.query('SELECT COUNT(*) FROM crew_details');
  console.log(`Current crew_details row count: ${testRes.rows[0].count}`);

  await appClient.end();
  console.log('✅ PostgreSQL setup complete!');
}

setup().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});

