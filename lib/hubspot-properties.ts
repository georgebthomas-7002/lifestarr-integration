/**
 * Single source of truth for the HubSpot custom properties LifeStarr Integration writes to.
 *
 * Used by:
 *   - scripts/setup-hubspot-properties.ts (creates/updates them in HubSpot via the Properties API)
 *   - lib/hubspot-client.ts (typed inputs for upsertContact / createDeal)
 *   - lib/handlers/* (set property values when events arrive)
 */

export const LIFESTARR_PROPERTY_GROUP = "lifestarr";

export type EnumOption = { label: string; value: string };

export type ContactPropertyDef = {
  name: string;
  label: string;
  description: string;
  groupName: string;
  type: "string" | "number" | "datetime" | "date" | "enumeration" | "bool";
  fieldType: "text" | "number" | "date" | "select" | "radio" | "booleancheckbox";
  options?: EnumOption[];
};

export const LIFESTARR_PLAN_VALUES = ["intro", "premier_monthly", "premier_annual", "none"] as const;
export type LifestarrPlan = (typeof LIFESTARR_PLAN_VALUES)[number];

export const LIFESTARR_PLAN_STATUS_VALUES = [
  "active",
  "canceled",
  "removed",
  "past_due",
] as const;
export type LifestarrPlanStatus = (typeof LIFESTARR_PLAN_STATUS_VALUES)[number];

export const LIFESTARR_TRACK_VALUES = [
  "foundation",
  "growth",
  "reset",
  "unassigned",
] as const;
export type LifestarrTrack = (typeof LIFESTARR_TRACK_VALUES)[number];

export const MIGHTY_MATCH_STATUS_VALUES = [
  "matched",
  "new_contact_unverified",
  "duplicate_review_needed",
] as const;
export type MightyMatchStatus = (typeof MIGHTY_MATCH_STATUS_VALUES)[number];

const enumOptions = (values: readonly string[]): EnumOption[] =>
  values.map((v) => ({ label: humanize(v), value: v }));

function humanize(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const CONTACT_PROPERTIES: ContactPropertyDef[] = [
  {
    name: "mighty_member_id",
    label: "Mighty Member ID",
    description: "Unique numeric Mighty Networks member id. Source of truth for identity matching.",
    groupName: LIFESTARR_PROPERTY_GROUP,
    type: "string",
    fieldType: "text",
  },
  {
    name: "lifestarr_plan",
    label: "LifeStarr Plan",
    description: "Current Mighty plan tier the member is on.",
    groupName: LIFESTARR_PROPERTY_GROUP,
    type: "enumeration",
    fieldType: "select",
    options: enumOptions(LIFESTARR_PLAN_VALUES),
  },
  {
    name: "lifestarr_plan_status",
    label: "LifeStarr Plan Status",
    description: "Lifecycle state of the member's current plan.",
    groupName: LIFESTARR_PROPERTY_GROUP,
    type: "enumeration",
    fieldType: "select",
    options: enumOptions(LIFESTARR_PLAN_STATUS_VALUES),
  },
  {
    name: "lifestarr_central_intro_account_created_date",
    label: "LifeStarr Central Intro Account Created Date",
    description: "Date the member created their LifeStarr Central (Intro) account in Mighty.",
    groupName: LIFESTARR_PROPERTY_GROUP,
    type: "date",
    fieldType: "date",
  },
  {
    name: "lifestarr_central_account_created",
    label: "LifeStarr Central Account Created",
    description: "Yes once the member has created a LifeStarr Central account.",
    groupName: LIFESTARR_PROPERTY_GROUP,
    type: "bool",
    fieldType: "booleancheckbox",
    options: [
      { label: "Yes", value: "true" },
      { label: "No", value: "false" },
    ],
  },
  {
    name: "lifestarr_premier_start_date",
    label: "LifeStarr Premier Start Date",
    description: "Date the member first activated a Premier plan.",
    groupName: LIFESTARR_PROPERTY_GROUP,
    type: "date",
    fieldType: "date",
  },
  {
    name: "lifestarr_premier_renewal_date",
    label: "LifeStarr Premier Renewal Date",
    description: "Most recent Premier renewal/billing date from Mighty.",
    groupName: LIFESTARR_PROPERTY_GROUP,
    type: "date",
    fieldType: "date",
  },
  {
    name: "lifestarr_engagement_score",
    label: "LifeStarr Engagement Score",
    description: "Rolling 30-day engagement score derived from Mighty activity.",
    groupName: LIFESTARR_PROPERTY_GROUP,
    type: "number",
    fieldType: "number",
  },
  {
    name: "lifestarr_premier_ready",
    label: "LifeStarr Premier Ready",
    description: "True when engagement score crosses the upsell threshold.",
    groupName: LIFESTARR_PROPERTY_GROUP,
    type: "bool",
    fieldType: "booleancheckbox",
    options: [
      { label: "Yes", value: "true" },
      { label: "No", value: "false" },
    ],
  },
  {
    name: "lifestarr_track",
    label: "LifeStarr Track",
    description: "Member's assigned program track.",
    groupName: LIFESTARR_PROPERTY_GROUP,
    type: "enumeration",
    fieldType: "select",
    options: enumOptions(LIFESTARR_TRACK_VALUES),
  },
  {
    name: "mighty_match_status",
    label: "Mighty Match Status",
    description: "Quality of identity match between Mighty and HubSpot for this contact.",
    groupName: LIFESTARR_PROPERTY_GROUP,
    type: "enumeration",
    fieldType: "select",
    options: enumOptions(MIGHTY_MATCH_STATUS_VALUES),
  },
];

/**
 * HubSpot's standard lifecycle stages. We don't create this property —
 * it ships with every HubSpot account — but we set its value on certain events.
 */
export type HubSpotLifecycleStage =
  | "subscriber"
  | "lead"
  | "marketingqualifiedlead"
  | "salesqualifiedlead"
  | "opportunity"
  | "customer"
  | "evangelist"
  | "other";

export type LifestarrContactProps = {
  mighty_member_id?: string;
  lifestarr_plan?: LifestarrPlan;
  lifestarr_plan_status?: LifestarrPlanStatus;
  lifestarr_central_intro_account_created_date?: string; // YYYY-MM-DD
  lifestarr_central_account_created?: boolean;
  lifestarr_premier_start_date?: string; // YYYY-MM-DD
  lifestarr_premier_renewal_date?: string; // YYYY-MM-DD
  lifestarr_engagement_score?: number;
  lifestarr_premier_ready?: boolean;
  lifestarr_track?: LifestarrTrack;
  mighty_match_status?: MightyMatchStatus;
  lifecyclestage?: HubSpotLifecycleStage;
};
