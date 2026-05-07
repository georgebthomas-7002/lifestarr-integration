/**
 * Single source of truth for the HubSpot custom properties LifeStarr Integration writes to.
 *
 * Used by:
 *   - scripts/setup-hubspot-properties.ts (creates/updates them in HubSpot via the Properties API)
 *   - lib/hubspot-client.ts (typed inputs for upsertContact / createDeal)
 *   - lib/handlers/* (set property values when events arrive)
 */

import { ALL_SPACE_IDS, SPACE_NAMES } from "@/lib/space-config";

export const LIFESTARR_PROPERTY_GROUP = "lifestarr";

export type EnumOption = { label: string; value: string };

export type ContactPropertyDef = {
  name: string;
  label: string;
  description: string;
  groupName: string;
  type: "string" | "number" | "datetime" | "date" | "enumeration" | "bool";
  fieldType:
    | "text"
    | "number"
    | "date"
    | "select"
    | "radio"
    | "booleancheckbox"
    | "checkbox"; // multi-select
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
    name: "lifestarr_profile_bio",
    label: "LifeStarr Profile Bio",
    description: "Bio the member set on their Mighty profile.",
    groupName: LIFESTARR_PROPERTY_GROUP,
    type: "string",
    fieldType: "text",
  },
  {
    name: "lifestarr_location",
    label: "LifeStarr Location",
    description: "Free-form location string from the Mighty profile (e.g. \"Indian Trail, NC\").",
    groupName: LIFESTARR_PROPERTY_GROUP,
    type: "string",
    fieldType: "text",
  },
  {
    name: "lifestarr_timezone",
    label: "LifeStarr Timezone",
    description: "IANA timezone the member set on their Mighty profile (e.g. \"America/New_York\").",
    groupName: LIFESTARR_PROPERTY_GROUP,
    type: "string",
    fieldType: "text",
  },
  {
    name: "lifestarr_profile_image_url",
    label: "LifeStarr Profile Image URL",
    description: "URL of the member's Mighty profile avatar.",
    groupName: LIFESTARR_PROPERTY_GROUP,
    type: "string",
    fieldType: "text",
  },
  {
    name: "lifestarr_mighty_profile_url",
    label: "LifeStarr Mighty Profile URL",
    description: "Direct link to the member's profile in the Mighty community.",
    groupName: LIFESTARR_PROPERTY_GROUP,
    type: "string",
    fieldType: "text",
  },
  {
    name: "lifestarr_referral_count",
    label: "LifeStarr Referral Count",
    description: "How many other members this person has referred to the LifeStarr community (from Mighty).",
    groupName: LIFESTARR_PROPERTY_GROUP,
    type: "number",
    fieldType: "number",
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
    name: "lifestarr_active_spaces",
    label: "LifeStarr Active Spaces (text)",
    description: "Comma-separated names of Mighty spaces the member currently belongs to. Human-readable mirror of lifestarr_spaces.",
    groupName: LIFESTARR_PROPERTY_GROUP,
    type: "string",
    fieldType: "text",
  },
  {
    name: "lifestarr_spaces",
    label: "LifeStarr Spaces",
    description:
      "Multi-select of Mighty spaces the member currently belongs to. Use this for filtering / list segmentation in HubSpot.",
    groupName: LIFESTARR_PROPERTY_GROUP,
    type: "enumeration",
    fieldType: "checkbox", // multi-select
    options: ALL_SPACE_IDS.map((id) => ({
      label: SPACE_NAMES[id] ?? id,
      value: id,
    })),
  },
  {
    name: "lifestarr_last_space_joined_at",
    label: "LifeStarr Last Space Joined Date",
    description: "Date of the most recent SpaceMemberAdded event for this member.",
    groupName: LIFESTARR_PROPERTY_GROUP,
    type: "date",
    fieldType: "date",
  },
  {
    name: "lifestarr_last_space_left_at",
    label: "LifeStarr Last Space Left Date",
    description: "Date of the most recent SpaceMemberRemoved event for this member.",
    groupName: LIFESTARR_PROPERTY_GROUP,
    type: "date",
    fieldType: "date",
  },
  {
    name: "lifestarr_space_membership_count",
    label: "LifeStarr Space Membership Count",
    description: "How many Mighty spaces the member is currently in.",
    groupName: LIFESTARR_PROPERTY_GROUP,
    type: "number",
    fieldType: "number",
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
  lifestarr_active_spaces?: string;
  /** HubSpot multi-select: semicolon-separated space ids, e.g. "20821655;22596625" */
  lifestarr_spaces?: string;
  lifestarr_last_space_joined_at?: string; // YYYY-MM-DD
  lifestarr_last_space_left_at?: string; // YYYY-MM-DD
  lifestarr_space_membership_count?: number;
  // Profile fields (set/refreshed by MemberJoined + MemberUpdated)
  lifestarr_profile_bio?: string | null;
  lifestarr_location?: string | null;
  lifestarr_timezone?: string | null;
  lifestarr_profile_image_url?: string | null;
  lifestarr_mighty_profile_url?: string;
  lifestarr_referral_count?: number;
  mighty_match_status?: MightyMatchStatus;
  lifecyclestage?: HubSpotLifecycleStage;
};
