import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.WEBHOOK_URL ?? "http://localhost:3000/api/webhook";

const samplePayload = {
  event_id: `bad-auth-${Date.now()}`,
  event_timestamp: new Date().toISOString(),
  event_type: "MemberPurchased",
  payload: { id: 1, email: "x@y.z" },
};

async function main() {
  console.log(`POST ${url} with WRONG bearer token`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer wrong-token-should-be-rejected",
    },
    body: JSON.stringify(samplePayload),
  });

  console.log(`status: ${res.status} (expected 401)`);
  console.log("body:", await res.text());

  if (res.status !== 401) {
    console.error("\nFAIL — webhook accepted a bad token");
    process.exit(1);
  }
  console.log("\nPASS — bad token correctly rejected");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
