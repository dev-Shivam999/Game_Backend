const express = require("express");
const multer  = require("multer");
const path    = require("path");
const fs      = require("fs");
const pool    = require("../db");
const redis   = require("../redis");
const { getAllSlots, getSlotByName } = require("../views/slotsView");
const { publishSlotEvent }           = require("../producers/slotProducer");

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "../uploads")),
  filename:    (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

// helper: delete old file from disk safely
function removeFile(urlPath) {
  if (!urlPath) return;
  const abs = path.join(__dirname, "..", urlPath);
  fs.unlink(abs, () => {});
}

// helper: invalidate all cache keys for a slot
async function bustCache(slot) {
  await redis.del("slots:all");
  if (slot?.name) await redis.del(`slots:${slot.name}`);
  if (slot?.id)   await redis.del(`slots:id:${slot.id}`);
}

// ── GET /api/slots ────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const cached = await redis.get("slots:all");
    if (cached) return res.json(JSON.parse(cached));
    const rows = await getAllSlots();
    await redis.setEx("slots:all", 60, JSON.stringify(rows));
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/slots/:name ──────────────────────────────────────────────────────
router.get("/:name", async (req, res) => {
  const { name } = req.params;
  try {
    const cacheKey = `slots:${name}`;
    const cached   = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const slot = await getSlotByName(name);
    if (!slot) return res.status(404).json({ error: "Slot not found" });

    // attach symbols — include id so client can delete individual ones
    const { rows: symbols } = await pool.query(
      "SELECT id, image_url, color_hint FROM slot_symbols WHERE slot_id = $1 ORDER BY sort_order",
      [slot.id]
    );
    slot.symbols = symbols;

    await redis.setEx(cacheKey, 60, JSON.stringify(slot));
    res.json(slot);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/slots ───────────────────────────────────────────────────────────
router.post(
  "/",
  upload.fields([{ name: "banner_image" }, { name: "slot_image" }, { name: "symbols" }]),
  async (req, res) => {
    const { name } = req.body;
    const bannerFile = req.files?.banner_image?.[0];
    const slotFile   = req.files?.slot_image?.[0];

    if (!name || !bannerFile || !slotFile)
      return res.status(400).json({ error: "name, banner_image, and slot_image are required" });

    const bannerUrl = `/uploads/${bannerFile.filename}`;
    const slotUrl   = `/uploads/${slotFile.filename}`;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { rows } = await client.query(
        "INSERT INTO slots (name, banner_image, slot_image) VALUES ($1, $2, $3) RETURNING *",
        [name, bannerUrl, slotUrl]
      );
      const slot = rows[0];

      // insert any extra symbol images uploaded under field "symbols"
      const symbolFiles = req.files?.symbols || [];
      for (let i = 0; i < symbolFiles.length; i++) {
        await client.query(
          "INSERT INTO slot_symbols (slot_id, image_url, sort_order) VALUES ($1, $2, $3)",
          [slot.id, `/uploads/${symbolFiles[i].filename}`, i]
        );
      }

      await client.query("COMMIT");
      await bustCache(slot);
      await publishSlotEvent("slot:created", slot);
      res.status(201).json(slot);
    } catch (err) {
      await client.query("ROLLBACK");
      if (err.code === "23505") return res.status(409).json({ error: "Slot name already exists" });
      res.status(500).json({ error: err.message });
    } finally { client.release(); }
  }
);

// ── PUT /api/slots/:id ────────────────────────────────────────────────────────
router.put(
  "/:id",
  upload.fields([{ name: "banner_image" }, { name: "slot_image" }, { name: "symbols" }]),
  async (req, res) => {
    const { id }   = req.params;
    const { name } = req.body;

    const client = await pool.connect();
    try {
      // fetch existing
      const { rows: existing } = await client.query("SELECT * FROM slots WHERE id = $1", [id]);
      if (!existing.length) return res.status(404).json({ error: "Slot not found" });
      const old = existing[0];

      await client.query("BEGIN");

      let bannerUrl = old.banner_image;
      let slotUrl   = old.slot_image;

      if (req.files?.banner_image?.[0]) {
        removeFile(old.banner_image);
        bannerUrl = `/uploads/${req.files.banner_image[0].filename}`;
      }
      if (req.files?.slot_image?.[0]) {
        removeFile(old.slot_image);
        slotUrl = `/uploads/${req.files.slot_image[0].filename}`;
      }

      const newName = name?.trim() || old.name;

      const { rows } = await client.query(
        `UPDATE slots SET name = $1, banner_image = $2, slot_image = $3
         WHERE id = $4 RETURNING *`,
        [newName, bannerUrl, slotUrl, id]
      );
      const updated = rows[0];

      // if new symbol files uploaded, append them
      const symbolFiles = req.files?.symbols || [];
      for (let i = 0; i < symbolFiles.length; i++) {
        const { rows: existing_syms } = await client.query(
          "SELECT COUNT(*) FROM slot_symbols WHERE slot_id = $1", [id]
        );
        const offset = parseInt(existing_syms[0].count);
        await client.query(
          "INSERT INTO slot_symbols (slot_id, image_url, sort_order) VALUES ($1, $2, $3)",
          [id, `/uploads/${symbolFiles[i].filename}`, offset + i]
        );
      }

      await client.query("COMMIT");
      await bustCache(old);       // bust old name cache
      await bustCache(updated);   // bust new name cache
      await publishSlotEvent("slot:updated", updated);
      res.json(updated);
    } catch (err) {
      await client.query("ROLLBACK");
      if (err.code === "23505") return res.status(409).json({ error: "Slot name already exists" });
      res.status(500).json({ error: err.message });
    } finally { client.release(); }
  }
);

// ── DELETE /api/slots/:id/symbols/:symId ── must be before DELETE /:id ───────
router.delete("/:id/symbols/:symId", async (req, res) => {
  const { id, symId } = req.params;
  try {
    const { rows } = await pool.query(
      "DELETE FROM slot_symbols WHERE id = $1 AND slot_id = $2 RETURNING *",
      [symId, id]
    );
    if (!rows.length) return res.status(404).json({ error: "Symbol not found" });
    removeFile(rows[0].image_url);
    const { rows: slot } = await pool.query("SELECT * FROM slots WHERE id = $1", [id]);
    if (slot.length) await bustCache(slot[0]);
    res.json({ message: "Symbol deleted" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /api/slots/:id ─────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query("DELETE FROM slots WHERE id = $1 RETURNING *", [id]);
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    removeFile(rows[0].banner_image);
    removeFile(rows[0].slot_image);
    await bustCache(rows[0]);
    await publishSlotEvent("slot:deleted", rows[0]);
    res.json({ message: "Deleted", slot: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
