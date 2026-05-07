/**
 * Backfill HubSpot contacts from a Mighty member export.
 *
 * Usage:
 *   node scripts/backfill-from-mighty-export.mjs --dry-run         # default
 *   node scripts/backfill-from-mighty-export.mjs --execute
 *   node scripts/backfill-from-mighty-export.mjs --file=path.xlsx  # override default path
 *
 * Dry-run produces docs/backfill-report-YYYY-MM-DD.md and writes nothing
 * to HubSpot. Execute does the actual updates with ~200ms pacing to stay
 * under HubSpot's rate limit comfortably.
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import XLSX from "xlsx";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";

// We can't import TS files from .mjs without tsx. So inline the small bits we need.
// @hubspot/api-client is CJS; import via default and destructure.
import pkg from "@hubspot/api-client";
const { Client } = pkg;
const FilterOperatorEnum = { Eq: "EQ" };

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=");
      return [k, v ?? true];
    }
    return [a, true];
  }),
);

const EXECUTE = !!args.execute;
const FILE = args.file ?? path.join(os.homedir(), "Downloads", "Network_LifeStarr_Central_members_May_07_2026_1720.xlsx");
const PACE_MS = parseInt(args.pace ?? "200", 10);

if (!process.env.HUBSPOT_API_TOKEN) {
  console.error("HUBSPOT_API_TOKEN not set. Aborting.");
  process.exit(1);
}

// ---- inline space-name → id reverse map (mirrors lib/space-config.ts) ----
const SPACE_NAMES = {
  "12946345": "Where Do I Begin?",
  "19169062": "Introduce Yourself",
  "15793153": "About LifeStarr Tiers",
  "21508353": "Crazy Book Deal Picture Upload",
  "19918517": "Community Guidelines",
  "18320480": "GET HELP",
  "21675314": "Foundation Formula Orientation",
  "20821655": "The Foundation Path",
  "22596625": "The Decision Coach",
  "20821469": "The Shared Journey",
  "20821647": "The Focus Library",
  "20821651": "The Build Kit",
  "20821657": "Momentum Pods",
  "21675412": "About The Growth Blueprint Track",
  "20821668": "Growth BP Success Cycle Masterclass",
  "20821660": "Growth Blueprint Community",
  "20821661": "Growth Blueprint Content & Courses",
  "20821663": "Growth Templates",
  "20821669": "Momentum Circles",
  "21675763": "About The Reset Framework Track",
  "20821686": "Reset FW Success Cycle Masterclass",
  "20821675": "Reset Framework Community",
  "20821680": "Reset Content & Courses",
  "20821683": "Reset Templates",
  "20821692": "The Reset Brainstorming Meetup",
  "21571503": "StarrAI General Business Help",
  "17463014": "Community Conversations",
  "19169122": "Community Tool Shed",
  "21781680": "LifeStarr App Updates",
  "20085710": "Solo Connector (Directory)",
  "18320461": "The Water Cooler",
  "15815292": "Success Sessions Events",
  "15728064": "Problem Solvers Events",
  "20539640": "Monday Meet-Up",
  "21392953": "Member-Hosted Events",
  "21395036": "APP - Ask & Learn (30 min)",
  "21393881": "Special Events",
  "22721978": "Solopreneur AI Content System",
  "13726198": "Success Sessions Library",
  "13731574": "Prospecting on Purpose Course",
  "13451704": "Financial Mastery for Solopreneurs",
  "13731479": "Big Rocks Workshop",
  "17520246": "Human-Powered & AI-Assisted",
  "13040178": "HubSpot Starter Course",
  "21049018": "Solopreneur Connector Create Listing",
  "14050026": "Aspiring Solopreneur Podcast",
  "14250145": "Success Secrets Blog",
  "16164401": "SoloSnack Newsletters",
  "18257656": "Upgrade to LifeStarr PREMIER",
  "21684136": "About LifeStarr INTRO",
};

// inverse map: aggressively-normalized name → id (strips emojis,
// punctuation, and extra whitespace so "The Water Cooler 🎥" in the export
// resolves to "The Water Cooler" in our config).
function normalize(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
const NAME_TO_ID = Object.fromEntries(
  Object.entries(SPACE_NAMES).map(([id, name]) => [normalize(name), id]),
);

const SPACE_TO_TRACK = {
  "21675314": "foundation",
  "20821655": "foundation",
  "21675412": "growth",
  "21675763": "reset",
};

function lookupSpaceId(name) {
  return NAME_TO_ID[normalize(name)];
}

// ---- read the export ----
console.log(EXECUTE ? "EXECUTE MODE — will write to HubSpot" : "DRY RUN — no writes");
console.log("Reading:", FILE);

const wb = XLSX.readFile(FILE, { cellDates: true });
const members = XLSX.utils.sheet_to_json(wb.Sheets["Members"], { defval: null });
console.log("Total members in export:", members.length);

// ---- HubSpot client ----
const hs = new Client({
  accessToken: process.env.HUBSPOT_API_TOKEN,
  numberOfApiCallRetries: 6,
});

async function findContactByEmail(email) {
  const res = await hs.crm.contacts.searchApi.doSearch({
    filterGroups: [{ filters: [{ propertyName: "email", operator: FilterOperatorEnum.Eq, value: email }] }],
    properties: ["email", "mighty_member_id", "lifestarr_plan", "hubspot_owner_id", "lifecyclestage"],
    limit: 1,
    sorts: [],
    after: "0",
  });
  return res.results[0] ?? null;
}

// ---- transform a row → HubSpot property updates ----
function transformRow(row) {
  const email = row["Email Address"];
  const memberId = row["Member ID"];
  const firstName = row["First Name"] ?? undefined;
  const lastName = row["Last Name"] ?? undefined;

  const subs = String(row["Active Subscription Plans"] ?? "");
  const isPremier = /PREMIER/i.test(subs);
  const isIntro = /INTRO/i.test(subs);
  const plan = isPremier ? "premier_monthly" : isIntro ? "intro" : "none";

  const joinDate = row["Join Date"] instanceof Date ? row["Join Date"] : null;
  const joinedISO = joinDate ? joinDate.toISOString().slice(0, 10) : undefined;

  // Spaces: parse comma-separated names, map to ids
  const spaceNamesRaw = String(row["Space Memberships"] ?? "");
  const spaceNames = spaceNamesRaw ? spaceNamesRaw.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const matchedIds = [];
  const unmatchedNames = [];
  for (const n of spaceNames) {
    const id = lookupSpaceId(n);
    if (id) matchedIds.push(id);
    else unmatchedNames.push(n);
  }
  const trackFromSpaces = matchedIds.map((id) => SPACE_TO_TRACK[id]).find(Boolean);

  const props = {};
  if (firstName) props.firstname = firstName;
  if (lastName) props.lastname = lastName;
  if (memberId !== undefined && memberId !== null) props.mighty_member_id = String(memberId);

  props.lifestarr_plan = plan;
  if (plan !== "none") props.lifestarr_plan_status = "active";
  props.lifestarr_central_account_created = "true";
  if (joinedISO) props.lifestarr_central_intro_account_created_date = joinedISO;
  if (plan === "premier_monthly") {
    props.lifestarr_premier_start_date = joinedISO;
    props.lifecyclestage = "customer";
  } else if (plan === "intro") {
    props.lifecyclestage = "salesqualifiedlead";
  }

  if (row["Short Bio"]) props.lifestarr_profile_bio = row["Short Bio"];
  if (row["Full Location"]) props.lifestarr_location = row["Full Location"];
  if (row["Time Zone"]) props.lifestarr_timezone = row["Time Zone"];
  if (row["Avatar URL"]) props.lifestarr_profile_image_url = row["Avatar URL"];
  if (typeof row["Members Referred"] === "number") {
    props.lifestarr_referral_count = String(row["Members Referred"]);
  }

  if (matchedIds.length > 0) {
    props.lifestarr_spaces = matchedIds.join(";");
    props.lifestarr_space_membership_count = String(matchedIds.length);
  }
  if (trackFromSpaces) props.lifestarr_track = trackFromSpaces;

  // mighty_match_status — we know the contact existed in HubSpot before
  // (otherwise we wouldn't be backfilling), so this is a clean match.
  props.mighty_match_status = "matched";

  // Owner — only set if not already set (Joe as default)
  // We'll decide per-row whether to include this based on existing.

  return { email, memberId, plan, props, unmatchedNames, spaceCount: matchedIds.length };
}

// ---- run ----
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const start = Date.now();

const buckets = {
  noEmail: [],
  notInHubSpot: [],
  alreadyIntegrated: [],
  backfillCandidates: [],
  errors: [],
};

const allUnmatchedSpaces = new Map(); // name → count

let i = 0;
for (const row of members) {
  i++;
  if (i % 50 === 0) console.log(`  ${i}/${members.length} processed (${Math.round((Date.now() - start) / 1000)}s)`);

  const transformed = transformRow(row);
  for (const n of transformed.unmatchedNames) {
    allUnmatchedSpaces.set(n, (allUnmatchedSpaces.get(n) ?? 0) + 1);
  }

  if (!transformed.email) {
    buckets.noEmail.push(transformed);
    continue;
  }

  let existing;
  try {
    existing = await findContactByEmail(transformed.email);
  } catch (err) {
    buckets.errors.push({ ...transformed, error: err.message });
    continue;
  }

  if (!existing) {
    buckets.notInHubSpot.push(transformed);
    continue;
  }

  if (existing.properties?.mighty_member_id) {
    buckets.alreadyIntegrated.push({ ...transformed, contactId: existing.id });
    continue;
  }

  const item = { ...transformed, contactId: existing.id, currentOwner: existing.properties?.hubspot_owner_id ?? null };

  // Add owner to props ONLY if the contact has no current owner. Don't reassign.
  if (!existing.properties?.hubspot_owner_id) {
    const ownerEnv = process.env.HUBSPOT_DEFAULT_CONTACT_OWNER_ID;
    if (ownerEnv) item.props.hubspot_owner_id = ownerEnv;
  }

  buckets.backfillCandidates.push(item);

  if (EXECUTE) {
    try {
      await hs.crm.contacts.basicApi.update(existing.id, { properties: item.props });
    } catch (err) {
      item.error = err.message;
      buckets.errors.push(item);
    }
    await sleep(PACE_MS);
  }
}

const elapsed = Math.round((Date.now() - start) / 1000);
console.log(`\nDone in ${elapsed}s.`);

// ---- write the report ----
const today = new Date().toISOString().slice(0, 10);
const reportPath = `docs/backfill-report-${today}.md`;

const planDist = (rows) => {
  const c = {};
  for (const r of rows) c[r.plan] = (c[r.plan] ?? 0) + 1;
  return c;
};

const md = [
  `# Mighty → HubSpot backfill ${EXECUTE ? "execution" : "dry-run"} report`,
  ``,
  `**Date:** ${today}`,
  `**Source file:** \`${FILE}\``,
  `**Mode:** ${EXECUTE ? "EXECUTE (HubSpot was updated)" : "DRY RUN (no writes)"}`,
  ``,
  `## Summary`,
  ``,
  `| Bucket | Count |`,
  `|---|---|`,
  `| Total rows in export | ${members.length} |`,
  `| Backfill candidates (in HubSpot, no mighty_member_id yet) | ${buckets.backfillCandidates.length} |`,
  `| Already integrated (had mighty_member_id) | ${buckets.alreadyIntegrated.length} |`,
  `| Not in HubSpot at all | ${buckets.notInHubSpot.length} |`,
  `| No email in export | ${buckets.noEmail.length} |`,
  `| Errors during search/update | ${buckets.errors.length} |`,
  ``,
  `## Plan distribution among backfill candidates`,
  ``,
  Object.entries(planDist(buckets.backfillCandidates))
    .map(([k, v]) => `- **${k}**: ${v}`)
    .join("\n"),
  ``,
  `## Unmatched space names (not in our SPACE_NAMES map)`,
  ``,
  allUnmatchedSpaces.size === 0
    ? "_(none — every space name in the export resolved to a known space_id)_"
    : Array.from(allUnmatchedSpaces.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => `- "${name}" (${count} members)`)
        .join("\n"),
  ``,
  `## Sample of first 10 backfill candidates`,
  ``,
  buckets.backfillCandidates.slice(0, 10).map((c) => {
    return [
      `### ${c.email}  ${c.plan === "premier_monthly" ? "👑" : c.plan === "intro" ? "🆓" : ""}`,
      `- HubSpot contact: ${c.contactId}`,
      `- Mighty member id: ${c.memberId}`,
      `- Plan: \`${c.plan}\``,
      `- Spaces: ${c.spaceCount}`,
      `- Currently owned by: ${c.currentOwner ?? "(no owner — would assign Joe)"}`,
      `- Properties to set: ${Object.keys(c.props).join(", ")}`,
    ].join("\n");
  }).join("\n\n"),
  ``,
  `## Full list of backfill candidates (${buckets.backfillCandidates.length})`,
  ``,
  `| Email | Plan | Spaces | HubSpot id |`,
  `|---|---|---|---|`,
  ...buckets.backfillCandidates.map((c) => `| ${c.email} | ${c.plan} | ${c.spaceCount} | ${c.contactId} |`),
  ``,
  `## Mighty members NOT in HubSpot (${buckets.notInHubSpot.length})`,
  ``,
  `These would be **fresh creates** if you decide to want them in HubSpot. Out of scope for this backfill — separate decision.`,
  ``,
  buckets.notInHubSpot.length === 0
    ? "_(none — every Mighty member matched a HubSpot contact)_"
    : `| Email | Plan |\n|---|---|\n${buckets.notInHubSpot.map((c) => `| ${c.email} | ${c.plan} |`).join("\n")}`,
  ``,
  buckets.errors.length === 0
    ? ""
    : `## Errors\n\n${buckets.errors.map((e) => `- \`${e.email}\` — ${e.error}`).join("\n")}`,
].join("\n");

await fs.mkdir("docs", { recursive: true });
await fs.writeFile(reportPath, md, "utf8");
console.log(`\nReport written to ${reportPath}`);

console.log("\n--- Final summary ---");
console.log("  Backfill candidates:", buckets.backfillCandidates.length);
console.log("  Already integrated:", buckets.alreadyIntegrated.length);
console.log("  Not in HubSpot:", buckets.notInHubSpot.length);
console.log("  No email:", buckets.noEmail.length);
console.log("  Errors:", buckets.errors.length);
