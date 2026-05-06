import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.WEBHOOK_URL ?? "http://localhost:3000/api/webhook";
const secret = process.env.MIGHTY_WEBHOOK_SECRET;
const eventType = process.argv[2] ?? "MemberPurchased";
const emailOverride = process.argv[3];

if (!secret) {
  console.error("MIGHTY_WEBHOOK_SECRET is not set in .env.local");
  process.exit(1);
}

const baseEmail =
  emailOverride ??
  `lifestarr-test+${eventType.toLowerCase()}-${Date.now()}@sidekickstrategies.com`;

function buildPayload(eventType: string): {
  event_id: string;
  event_timestamp: string;
  event_type: string;
  payload: Record<string, unknown>;
} {
  const base = {
    event_id: `test-${eventType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    event_timestamp: new Date().toISOString(),
    event_type: eventType,
  };

  const member = {
    id: 12345,
    email: baseEmail,
    first_name: "Test",
    last_name: eventType,
  };

  switch (eventType) {
    case "MemberJoined":
      return {
        ...base,
        payload: { ...member, joined_at: new Date().toISOString() },
      };
    case "MemberPurchased":
      return {
        ...base,
        payload: {
          ...member,
          plan_id: 999,
          plan_name: "LifeStarr Premier Monthly",
          amount: 39.95,
          currency: "USD",
          interval: "monthly",
          purchased_at: new Date().toISOString(),
        },
      };
    case "MemberPlanChanged":
      return {
        ...base,
        payload: {
          ...member,
          plan_id: 1000,
          plan_name: "LifeStarr Premier Annual",
          interval: "annual",
        },
      };
    case "MemberSubscriptionRenewed":
      return {
        ...base,
        payload: {
          ...member,
          plan_id: 999,
          plan_name: "LifeStarr Premier Monthly",
          renewed_at: new Date().toISOString(),
        },
      };
    case "MemberSubscriptionCanceled":
      return {
        ...base,
        payload: { ...member, canceled_at: new Date().toISOString() },
      };
    case "MemberRemovedFromPlan":
      return {
        ...base,
        payload: { ...member, removed_at: new Date().toISOString() },
      };
    case "MemberCourseProgressStarted":
    case "MemberCourseProgressCompleted":
      return {
        ...base,
        payload: {
          ...member,
          course_id: 444,
          course_name: "LifeStarr Foundation Course",
          progress_at: new Date().toISOString(),
        },
      };
    case "PostCreated":
      return {
        ...base,
        payload: {
          author: { id: member.id, email: member.email },
          post_id: 7777,
          title: "How I started using LifeStarr",
          created_at: new Date().toISOString(),
        },
      };
    case "CommentCreated":
      return {
        ...base,
        payload: {
          author: { id: member.id, email: member.email },
          comment_id: 8888,
          post_id: 7777,
          created_at: new Date().toISOString(),
        },
      };
    case "RsvpCreated":
      return {
        ...base,
        payload: {
          ...member,
          event_id: 5555,
          event_name: "Weekly Q&A",
          rsvp_at: new Date().toISOString(),
        },
      };
    case "ReactionCreated":
      return {
        ...base,
        payload: {
          author: { id: member.id, email: member.email },
          reaction: "heart",
          target_id: 7777,
          created_at: new Date().toISOString(),
        },
      };
    default:
      return { ...base, payload: member };
  }
}

async function main() {
  const body = buildPayload(eventType);
  console.log(`POST ${url}`);
  console.log(`event_id: ${body.event_id}`);
  console.log(`event_type: ${body.event_type}`);
  console.log(`email: ${baseEmail}\n`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(body),
  });

  console.log(`status: ${res.status} ${res.statusText}`);
  const text = await res.text();
  try {
    console.log("body:", JSON.stringify(JSON.parse(text), null, 2));
  } catch {
    console.log("body:", text);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
