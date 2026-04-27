-- Migration 001: create slots table + view + indexes

CREATE TABLE IF NOT EXISTS slots (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(100) UNIQUE NOT NULL,
  banner_image VARCHAR(255) NOT NULL,
  slot_image   VARCHAR(255) NOT NULL,
  created_at   TIMESTAMP DEFAULT NOW()
);

-- View: public-facing slot data (no internal fields)
CREATE OR REPLACE VIEW slots_public AS
  SELECT id, name, banner_image, slot_image, created_at
  FROM slots
  ORDER BY created_at DESC;

-- Index for fast name lookups
CREATE INDEX IF NOT EXISTS idx_slots_name ON slots(name);
