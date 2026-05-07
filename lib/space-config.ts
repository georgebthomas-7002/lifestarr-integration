import type { LifestarrTrack } from "@/lib/hubspot-properties";

/**
 * Full Mighty space_id → human-readable name map for LifeStarr Central.
 * Source: George's list, 2026-05-07.
 *
 * Used by:
 *   - lib/handlers/member-joined.ts + member-left.ts to write friendly names
 *     to lifestarr_active_spaces (text) and space ids to lifestarr_spaces
 *     (multi-select)
 *   - lib/hubspot-properties.ts to define the multi-select option list
 */
export const SPACE_NAMES: Record<string, string> = {
  // START HERE
  "12946345": "Where Do I Begin?",
  "19169062": "Introduce Yourself",
  "15793153": "About LifeStarr Tiers",
  "21508353": "Crazy Book Deal Picture Upload",
  "19918517": "Community Guidelines",
  "18320480": "GET HELP",

  // THE FOUNDATION FORMULA
  "21675314": "Foundation Formula Orientation",
  "20821655": "The Foundation Path",
  "22596625": "The Decision Coach",
  "20821469": "The Shared Journey",
  "20821647": "The Focus Library",
  "20821651": "The Build Kit",
  "20821657": "Momentum Pods",

  // GROWTH BLUEPRINT
  "21675412": "About The Growth Blueprint Track",
  "20821668": "Growth BP Success Cycle Masterclass",
  "20821660": "Growth Blueprint Community",
  "20821661": "Growth Blueprint Content & Courses",
  "20821663": "Growth Templates",
  "20821669": "Momentum Circles",

  // THE RESET FRAMEWORK
  "21675763": "About The Reset Framework Track",
  "20821686": "Reset FW Success Cycle Masterclass",
  "20821675": "Reset Framework Community",
  "20821680": "Reset Content & Courses",
  "20821683": "Reset Templates",
  "20821692": "The Reset Brainstorming Meetup",

  // GENERAL BUSINESS HELP
  "21571503": "StarrAI General Business Help",

  // COMMUNITY
  "17463014": "Community Conversations",
  "19169122": "Community Tool Shed",
  "21781680": "LifeStarr App Updates",
  "20085710": "Solo Connector (Directory)",
  "18320461": "The Water Cooler",

  // EVENTS
  "15815292": "Success Sessions Events",
  "15728064": "Problem Solvers Events",
  "20539640": "Monday Meet-Up",
  "21392953": "Member-Hosted Events",
  "21395036": "APP - Ask & Learn (30 min)",
  "21393881": "Special Events",

  // COURSES & WORKSHOPS
  "22721978": "Solopreneur AI Content System",
  "13726198": "Success Sessions Library",
  "13731574": "Prospecting on Purpose Course",
  "13451704": "Financial Mastery for Solopreneurs",
  "13731479": "Big Rocks Workshop",
  "17520246": "Human-Powered & AI-Assisted",
  "13040178": "HubSpot Starter Course",

  // RESOURCES
  "21049018": "Solopreneur Connector Create Listing",
  "14050026": "Aspiring Solopreneur Podcast",
  "14250145": "Success Secrets Blog",
  "16164401": "SoloSnack Newsletters",

  // LIFESTARR TIERS
  "18257656": "Upgrade to LifeStarr PREMIER",
  "21684136": "About LifeStarr INTRO",
};

/**
 * Optional: spaces whose membership signals a specific LifeStarr track.
 * When MemberJoined fires for one of these spaces, also set lifestarr_track.
 * Conservative — only the explicit track-entry spaces are mapped. Other
 * track-related spaces (lessons / templates / community) don't trigger
 * a track assignment because a member can browse them without committing.
 */
export const SPACE_TO_TRACK: Record<string, LifestarrTrack> = {
  "21675314": "foundation", // Foundation Formula Orientation
  "20821655": "foundation", // The Foundation Path
  "21675412": "growth", // About The Growth Blueprint Track
  "21675763": "reset", // About The Reset Framework Track
};

/**
 * All space ids known to LifeStarr Central, in stable display order.
 * Used to populate the multi-select options on lifestarr_spaces in HubSpot.
 */
export const ALL_SPACE_IDS: string[] = Object.keys(SPACE_NAMES);

export function spaceLabel(spaceId: string | number | undefined): string {
  if (spaceId === undefined || spaceId === null) return "(unknown)";
  const id = String(spaceId);
  return SPACE_NAMES[id] ?? id;
}

export function spaceTrack(spaceId: string | number | undefined): LifestarrTrack | undefined {
  if (spaceId === undefined || spaceId === null) return undefined;
  return SPACE_TO_TRACK[String(spaceId)];
}
