const fs = require("fs");
const path = require("path");
const pool = require("../db");

async function run() {
  const client = await pool.connect();
  try {
    // Track applied migrations
    await client.query(`
      CREATE TABLE IF NOT EXISTS slots_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT NOW()
      )
    `);

    const files = fs.readdirSync(__dirname)
      .filter(f => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const { rows } = await client.query(
        "SELECT 1 FROM slots_migrations WHERE filename = $1", [file]
      );
      if (rows.length) {
        console.log(`  skip  ${file}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(__dirname, file), "utf8");
      await client.query(sql);
      await client.query("INSERT INTO slots_migrations (filename) VALUES ($1)", [file]);
      console.log(`  apply ${file}`);
    }
    console.log("Migrations done.");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
