/**
 * Definitions of the integration cards shown on the dashboard Status Grid.
 *
 * `eventType` is the value we filter on in the integrations table.
 * For Tier-1 events it matches the Mighty event_type 1-to-1.
 * For the engagement card it's a synthetic key — process-outcome.ts updates
 * this row whenever any of the 6 engagement events fire.
 */

export const ENGAGEMENT_BUNDLE_EVENT_TYPE = "engagement_bundle";

export const ENGAGEMENT_EVENT_TYPES = [
  "MemberCourseProgressStarted",
  "MemberCourseProgressCompleted",
  "PostCreated",
  "CommentCreated",
  "RsvpCreated",
  "ReactionCreated",
] as const;

export type IntegrationCardConfig = {
  eventType: string;
  name: string;
  description: string;
  defaultStatus: "live" | "paused" | "building" | "not_started";
};

export const INTEGRATION_CARDS: IntegrationCardConfig[] = [
  {
    eventType: "MemberJoined",
    name: "Member Joined → HubSpot Contact",
    description: "Creates or matches a HubSpot contact when someone joins the Mighty community or a Mighty space.",
    defaultStatus: "live",
  },
  {
    eventType: "MemberUpdated",
    name: "Member Updated → HubSpot Profile Sync",
    description: "Refreshes name, bio, location, timezone, and avatar on profile edits.",
    defaultStatus: "live",
  },
  {
    eventType: "MemberLeft",
    name: "Member Left → HubSpot Space Update",
    description: "Removes the space from the contact's active spaces and decrements membership count.",
    defaultStatus: "live",
  },
  {
    eventType: "MemberPurchased",
    name: "Member Purchased → HubSpot Deal",
    description: "Creates a Closed Won deal in the Customer Pipeline on Premier purchase.",
    defaultStatus: "live",
  },
  {
    eventType: "MemberPlanChanged",
    name: "Member Plan Changed → HubSpot Property",
    description: "Updates lifestarr_plan when a member upgrades, downgrades, or switches interval.",
    defaultStatus: "live",
  },
  {
    eventType: "MemberSubscriptionCanceled",
    name: "Subscription Canceled → HubSpot Workflow Trigger",
    description: "Sets lifestarr_plan_status=canceled. Drives win-back automation in HubSpot.",
    defaultStatus: "live",
  },
  {
    eventType: "MemberSubscriptionRenewed",
    name: "Subscription Renewed → HubSpot Renewal Log",
    description: "Logs renewal date for retention analytics.",
    defaultStatus: "live",
  },
  {
    eventType: "MemberRemovedFromPlan",
    name: "Removed From Plan → HubSpot Lifecycle Update",
    description: "Marks the member as removed and drops their plan back to none.",
    defaultStatus: "live",
  },
  {
    eventType: ENGAGEMENT_BUNDLE_EVENT_TYPE,
    name: "Engagement Scoring → Premier Upsell Trigger",
    description:
      "Rolling 30-day score from courses, posts, comments, RSVPs, reactions. Flips lifestarr_premier_ready at 50.",
    defaultStatus: "live",
  },
];
