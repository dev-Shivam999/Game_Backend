const pool = require("../db");

async function seed() {
    const client = await pool.connect();
    try {
        console.log("Starting database seeding...");

        // 1. We no longer clear everything! 
        // This ensures your old data stays safe.
        console.log("Adding sample data (without touching existing data)...");

        // 2. Insert Slots
        const slots = [
            {
                name: "Mega Fortune",
                banner_image: "/uploads/1777284355089-hot_honey_22_vip_9b8b907d51.jpg",
                slot_image: "/uploads/1777284285405-spin-back-layer1.jpg"
            },
            {
                name: "Classic Fruits",
                banner_image: "/uploads/1777286828216-backgroundFollowPickerBG.jpg",
                slot_image: "/uploads/1777283268430-lam.png"
            },
            {
                name: "Neon Nights",
                banner_image: "/uploads/1777283268427-back.png",
                slot_image: "/uploads/1777283268431-neck.png"
            }
        ];

        for (const slot of slots) {
            // Use ON CONFLICT to avoid errors if data already exists
            const res = await client.query(
                `INSERT INTO slots (name, banner_image, slot_image) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (name) DO UPDATE SET banner_image = EXCLUDED.banner_image, slot_image = EXCLUDED.slot_image
         RETURNING id`,
                [slot.name, slot.banner_image, slot.slot_image]
            );
            const slotId = res.rows[0].id;

            // 3. Insert Symbols for each slot
            // We clear symbols for THIS slot only to refresh them, or just use ON CONFLICT
            await client.query("DELETE FROM slot_symbols WHERE slot_id = $1", [slotId]);

            const symbols = [
                { image: "/uploads/1777284285408-symbol7.png", color: "#FFD700", order: 1 },
                { image: "/uploads/1777284285408-symbol8.png", color: "#C0C0C0", order: 2 },
                { image: "/uploads/1777286828220-downloa8.png", color: "#FF4500", order: 3 },
                { image: "/uploads/1777286828221-download1.png", color: "#32CD32", order: 4 },
                { image: "/uploads/1777286828221-download2.png", color: "#1E90FF", order: 5 }
            ];

            for (const symbol of symbols) {
                await client.query(
                    "INSERT INTO slot_symbols (slot_id, image_url, color_hint, sort_order) VALUES ($1, $2, $3, $4)",
                    [slotId, symbol.image, symbol.color, symbol.order]
                );
            }
        }

        console.log("Database seeding completed successfully!");
    } catch (err) {
        console.error("Error during seeding:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

seed().catch(err => {
    console.error("Fatal error in seeder:", err);
    process.exit(1);
});
