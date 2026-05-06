import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.WEBHOOK_URL ?? "http://localhost:3000/api/webhook";
const secret = process.env.MIGHTY_WEBHOOK_SECRET;
const eventType = process.argv[2] ?? "MemberPurchased";

if (!secret) {
  console.error("MIGHTY_WEBHOOK_SECRET is not set in .env.local");
  process.exit(1);
}

const samplePayload = {
  event_id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  event_timestamp: new Date().toISOString(),
  event_type: eventType,
  payload: {
    id: 12345,
    email: "test@example.com",
    first_name: "Test",
    last_name: "User",
    plan_id: 999,
    plan_name: "LifeStarr Premier Monthly",
    amount: 39.95,
    currency: "USD",
    interval: "monthly",
    purchased_at: new Date().toISOString(),
  },
};

async function main() {
  console.log(`POST ${url}`);
  console.log(`event_id: ${samplePayload.event_id}`);
  console.log(`event_type: ${samplePayload.event_type}\n`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(samplePayload),
  });

  console.log(`status: ${res.status} ${res.statusText}`);
  console.log("body:", await res.text());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
