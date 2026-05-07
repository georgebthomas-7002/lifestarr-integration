import type { LifestarrTrack } from "@/lib/hubspot-properties";

/**
 * Mapping of Mighty Networks space_id → human-readable space name.
 *
 * Populated as we observe real SpaceMemberAdded events in production.
 * Unmapped space_ids show up in HubSpot as their raw numeric id.
 *
 * To add a mapping:
 *   1. Look at /dashboard/activity for a recent SpaceMemberAdded event.
 *   2. Click the row, copy `payload.space_id`.
 *   3. Add an entry below: SPACE_NAMES["1234567"] = "Foundation Course";
 *   4. Push. Future events for that space will write the friendly name to
 *      `lifestarr_active_spaces`. Existing values can be retroactively
 *      cleaned up with a backfill script if desired.
 */
export const SPACE_NAMES: Record<string, string> = {
  // "1234567": "Foundation Course",
  // "2345678": "Growth Mastermind",
  // "3456789": "Reset Sprint",
};

/**
 * Optional map: space_id → LifestarrTrack. When a SpaceMemberAdded event
 * lands and the space_id is in this map, we ALSO set `lifestarr_track`
 * on the contact. Empty by default — wire as needed.
 */
export const SPACE_TO_TRACK: Record<string, LifestarrTrack> = {
  // "1234567": "foundation",
  // "2345678": "growth",
  // "3456789": "reset",
};

export function spaceLabel(spaceId: string | number | undefined): string {
  if (spaceId === undefined || spaceId === null) return "(unknown)";
  const id = String(spaceId);
  return SPACE_NAMES[id] ?? id;
}

export function spaceTrack(spaceId: string | number | undefined): LifestarrTrack | undefined {
  if (spaceId === undefined || spaceId === null) return undefined;
  return SPACE_TO_TRACK[String(spaceId)];
}
