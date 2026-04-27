const { createClient } = require("redis");
require("dotenv").config();

// Separate publisher client (redis client can't pub+sub simultaneously)
let publisher = null;

async function getPublisher() {
  if (!publisher) {
    publisher = createClient({ url: process.env.REDIS_URL });
    publisher.on("error", err => console.error("Publisher error:", err));
    await publisher.connect();
  }
  return publisher;
}

/**
 * Publish a slot event to the "slot-events" channel.
 * @param {"slot:created"|"slot:deleted"} event
 * @param {object} payload
 */
async function publishSlotEvent(event, payload) {
  const pub = await getPublisher();
  await pub.publish("slot-events", JSON.stringify({ event, payload, ts: Date.now() }));
}

module.exports = { publishSlotEvent };
