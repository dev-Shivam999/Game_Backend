const pool = require("../db");

async function unseed() {
    const client = await pool.connect();
    try {
        console.log("Undoing seeder (removing only sample data)...");

        // Instead of TRUNCATE (which deletes everything), 
        // we only delete the specific records we added in seed.js
        const seededSlotNames = ["Mega Fortune", "Classic Fruits", "Neon Nights"];

        await client.query("DELETE FROM slots WHERE name = ANY($1)", [seededSlotNames]);
        console.log("Sample data removed from PostgreSQL. Your original data remains untouched.");

        // Clear Redis cache (if possible)
        try {
            const redis = require("../redis");
            // Wait a moment for Redis to connect if it hasn't yet
            if (!redis.isOpen) {
                await redis.connect().catch(() => { });
            }
            if (redis.isOpen) {
                await redis.flushAll();
                console.log("Redis cache cleared.");
            }
        } catch (redisErr) {
            console.warn("Could not clear Redis cache:", redisErr.message);
        }
    } catch (err) {
        console.error("Error during unseeding:", err);
    } finally {
        try {
            const redis = require("../redis");
            if (redis.isOpen) {
                await redis.quit().catch(() => { });
            }
        } catch (e) { }
        client.release();
        await pool.end();
    }
}

unseed().catch(err => {
    console.error("Fatal error in unseeder:", err);
    process.exit(1);
});
