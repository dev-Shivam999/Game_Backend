-- Migration 002: slot_symbols table for per-slot reel images

CREATE TABLE IF NOT EXISTS slot_symbols (
  id         SERIAL PRIMARY KEY,
  slot_id    INTEGER NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  image_url  VARCHAR(255) NOT NULL,
  color_hint VARCHAR(20) DEFAULT '#ffd700',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slot_symbols_slot_id ON slot_symbols(slot_id);

-- View: symbols joined with slot name
CREATE OR REPLACE VIEW slot_symbols_view AS
  SELECT ss.id, ss.slot_id, s.name AS slot_name,
         ss.image_url, ss.color_hint, ss.sort_order
  FROM slot_symbols ss
  JOIN slots s ON s.id = ss.slot_id
  ORDER BY ss.slot_id, ss.sort_order;
