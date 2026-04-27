const pool = require("../db");

/** Fetch all slots from the DB view */
async function getAllSlots() {
  const { rows } = await pool.query("SELECT * FROM slots_public");
  return rows;
}

/** Fetch a single slot by name from the DB view */
async function getSlotByName(name) {
  const { rows } = await pool.query(
    "SELECT * FROM slots_public WHERE name = $1",
    [name]
  );
  return rows[0] || null;
}

module.exports = { getAllSlots, getSlotByName };
