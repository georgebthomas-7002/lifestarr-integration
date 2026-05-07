/**
 * Hardcoded build-progress data for the Build Progress dashboard page.
 * Move to the database in V2 if Joe / George want to edit it from the UI.
 */

export type ProgressStatus = "done" | "in_progress" | "planned" | "deferred";

export type ProgressItem = {
  status: ProgressStatus;
  done: boolean;
  label: string;
};

export type ProgressYes = {
  id: string;
  number: number;
  name: string;
  description: string;
  status: ProgressStatus;
  items: ProgressItem[];
};

export const PROGRESS_YESES: ProgressYes[] = [
  {
    id: "hubspot-crm-sync",
    number: 1,
    name: "HubSpot CRM Sync",
    description:
      "Mirror Mighty member state into HubSpot contacts and deals — identity, plan, profile, and 21 LifeStarr custom properties.",
    status: "done",
    items: [
      { status: "done", done: true, label: "Contact creation + matching by email" },
      { status: "done", done: true, label: "Race-condition recovery on parallel creates" },
      { status: "done", done: true, label: "Deal creation in Customer Pipeline at Closed Won" },
      { status: "done", done: true, label: "Plan mapping (intro / premier_monthly / premier_annual)" },
      { status: "done", done: true, label: "Subscription cancel + remove tracking" },
      { status: "done", done: true, label: "Renewal date logging" },
      { status: "done", done: true, label: "21 custom contact properties (lifestarr_*)" },
      { status: "done", done: true, label: "Profile field sync (bio, location, timezone, avatar)" },
      { status: "done", done: true, label: "Owner = Joe (write-once, no reassignment)" },
      { status: "done", done: true, label: "community_membership + contact_type tagging (append-only)" },
      { status: "done", done: true, label: "Backfilled 433 existing community members from Mighty CSV" },
      { status: "done", done: true, label: "HubSpot rate-limit retries (numberOfApiCallRetries=6)" },
    ],
  },
  {
    id: "onboarding-automation",
    number: 2,
    name: "Onboarding Automation",
    description:
      "Sync Mighty member identity + assign HubSpot lifecycle/owner. Welcome flow itself is Joe's HubSpot workflow.",
    status: "in_progress",
    items: [
      { status: "done", done: true, label: "MemberJoined webhook captured (per-space firing handled)" },
      { status: "done", done: true, label: "Contact created with mighty_match_status" },
      { status: "done", done: true, label: "Lifecycle stage = SQL on Intro, Customer on Premier" },
      { status: "done", done: true, label: "Profile fields sync on MemberJoined + MemberUpdated" },
      { status: "done", done: true, label: "Track auto-assignment for the 4 entry spaces" },
      { status: "planned", done: false, label: "Welcome email workflow (Joe / HubSpot)" },
      { status: "planned", done: false, label: "Marketing Contact workflow (Joe / HubSpot — API-restricted)" },
    ],
  },
  {
    id: "engagement-retention",
    number: 3,
    name: "Engagement & Retention Insights",
    description:
      "Rolling 30-day engagement score from Mighty community activity. Powers the Premier upsell trigger.",
    status: "done",
    items: [
      { status: "done", done: true, label: "6 engagement event handlers (course / post / comment / RSVP / reaction)" },
      { status: "done", done: true, label: "30-day rolling window with decay" },
      { status: "done", done: true, label: "lifestarr_engagement_score property sync" },
      { status: "done", done: true, label: "engagement_scores DB table for historical analysis" },
      { status: "done", done: true, label: "member_id fallback when payload has no email (PostCreated etc.)" },
      { status: "done", done: true, label: "Edit/delete events explicitly no-op'd (don't double-count)" },
    ],
  },
  {
    id: "content-event-automation",
    number: 4,
    name: "Content & Event Automation",
    description:
      "Reactive flows triggered by post / comment / RSVP / space-membership activity.",
    status: "in_progress",
    items: [
      { status: "done", done: true, label: "PostCreated, CommentCreated, RsvpCreated handlers" },
      { status: "done", done: true, label: "Space membership tracking (multi-select, 46 spaces)" },
      { status: "done", done: true, label: "MemberLeft handler (per-space exit)" },
      { status: "done", done: true, label: "PostUpdated / CommentUpdated / *Deleted intentionally not scored" },
      { status: "planned", done: false, label: "HubSpot list segments for active commenters / power users (Joe)" },
      { status: "planned", done: false, label: "Email digest automation for top engagers (Joe)" },
    ],
  },
  {
    id: "premier-upsell",
    number: 5,
    name: "Premier Upsell Trigger",
    description:
      "Automatically flag highly-engaged Intro members for the Premier sequence. Marketing automation is Joe's.",
    status: "done",
    items: [
      { status: "done", done: true, label: "50-point engagement threshold" },
      { status: "done", done: true, label: "lifestarr_premier_ready property in HubSpot" },
      { status: "done", done: true, label: "Lifecycle stage flips to Customer on Premier purchase" },
      { status: "done", done: true, label: "Plan mapping prioritizes name keywords over plan.type (Premier currently has type=free in Mighty)" },
      { status: "planned", done: false, label: "HubSpot upsell sequence wired to property change (Joe)" },
    ],
  },
  {
    id: "ai-integration",
    number: 6,
    name: "AI Integration",
    description:
      "Deferred for V1 — revisit once Joe has reports surfacing patterns worth automating.",
    status: "deferred",
    items: [
      { status: "deferred", done: false, label: "Member-context summaries via Claude" },
      { status: "deferred", done: false, label: "Auto-suggested Premier upsell timing" },
      { status: "deferred", done: false, label: "AI-drafted re-engagement emails" },
    ],
  },
  {
    id: "solopreneur-connector",
    number: 7,
    name: "Solopreneur Connector",
    description:
      "Surface high-affinity matches between members for connection requests.",
    status: "planned",
    items: [
      { status: "planned", done: false, label: "Member matching algorithm spec" },
      { status: "planned", done: false, label: "HubSpot custom object for connections" },
      { status: "planned", done: false, label: "Email intro automation" },
    ],
  },
];
