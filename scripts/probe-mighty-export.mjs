import XLSX from "xlsx";
import path from "node:path";
import os from "node:os";

const file = path.join(os.homedir(), "Downloads", "Network_LifeStarr_Central_members_May_07_2026_1720.xlsx");

const wb = XLSX.readFile(file);
const members = XLSX.utils.sheet_to_json(wb.Sheets["Members"], { defval: null });
const answers = XLSX.utils.sheet_to_json(wb.Sheets["Profile Question Answers"], { defval: null });

console.log("=== Members sheet ===");
console.log("Total rows:", members.length);
console.log("\nFirst row (full):");
console.log(JSON.stringify(members[0], null, 2));

console.log("\n=== Sample row with active plans + spaces (find one) ===");
const sampleWithPlan = members.find((r) => r["Active Subscription Plans"] && r["Active Subscription Plans"].length > 0);
if (sampleWithPlan) {
  console.log(JSON.stringify(sampleWithPlan, null, 2));
} else {
  console.log("No member has an active subscription plan? Showing row 5:");
  console.log(JSON.stringify(members[4], null, 2));
}

console.log("\n=== Plan distribution ===");
const planCounts = {};
members.forEach((r) => {
  const k = String(r["Active Subscription Plans"] ?? "(none)").slice(0, 80);
  planCounts[k] = (planCounts[k] || 0) + 1;
});
Object.entries(planCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log("  " + String(v).padStart(3) + "  " + k));

console.log("\n=== Membership Type distribution ===");
const typeCounts = {};
members.forEach((r) => {
  const k = r["Membership Type"] ?? "(none)";
  typeCounts[k] = (typeCounts[k] || 0) + 1;
});
Object.entries(typeCounts).forEach(([k, v]) => console.log("  " + String(v).padStart(3) + "  " + k));

console.log("\n=== Profile Question Answers sheet ===");
console.log("Total rows:", answers.length);
if (answers.length > 0) {
  console.log("Column headers:");
  Object.keys(answers[0]).forEach((h) => console.log("  " + h));
  console.log("\nFirst row:");
  console.log(JSON.stringify(answers[0], null, 2));
}

console.log("\n=== Email coverage ===");
const withEmail = members.filter((r) => r["Email Address"]);
console.log("Rows with Email Address populated:", withEmail.length, "/", members.length);

console.log("\n=== Sample Space Memberships value (raw) ===");
const sampleSpaces = members.find((r) => r["Space Memberships"]);
if (sampleSpaces) {
  console.log("'Space Memberships' is a:", typeof sampleSpaces["Space Memberships"]);
  console.log("First 600 chars:", String(sampleSpaces["Space Memberships"]).slice(0, 600));
}
