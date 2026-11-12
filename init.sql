-- =============================================================
-- PRYJ Crew Availability Dashboard — Database Initialization
-- =============================================================
-- Run this script once to create the database and table.
--
-- Usage:
--   psql -U postgres -f init.sql
-- =============================================================

-- Create the database (run as superuser)
-- If the database already exists, comment out this line.
CREATE DATABASE crew_availability;

-- Connect to the database
\c crew_availability;

-- Create the crew_details table
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_crew_avail_sttn ON crew_details (avail_sttn);
CREATE INDEX IF NOT EXISTS idx_crew_status     ON crew_details (status);
CREATE INDEX IF NOT EXISTS idx_crew_avail_time ON crew_details (avail_time);
CREATE INDEX IF NOT EXISTS idx_crew_hq         ON crew_details (hq);

-- Verify
SELECT 'Database and table created successfully!' AS result;

