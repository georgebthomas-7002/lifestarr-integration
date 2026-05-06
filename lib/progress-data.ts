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
    description: "Mirror Mighty member state into HubSpot contacts and deals.",
    status: "done",
    items: [
      { status: "done", done: true, label: "Contact creation + matching by email" },
      { status: "done", done: true, label: "Deal creation in Customer Pipeline" },
      { status: "done", done: true, label: "Plan change → property update" },
      { status: "done", done: true, label: "Subscription cancel + remove tracking" },
      { status: "done", done: true, label: "Renewal date logging" },
      { status: "done", done: true, label: "9 LifeStarr custom contact properties" },
    ],
  },
  {
    id: "onboarding-automation",
    number: 2,
    name: "Onboarding Automation",
    description: "Automated welcome flow when new members join the community.",
    status: "in_progress",
    items: [
      { status: "done", done: true, label: "MemberJoined webhook captured" },
      { status: "done", done: true, label: "Contact created with mighty_match_status" },
      { status: "planned", done: false, label: "HubSpot welcome workflow (configure on Joe's side)" },
      { status: "planned", done: false, label: "Track-assignment automation" },
    ],
  },
  {
    id: "engagement-retention",
    number: 3,
    name: "Engagement & Retention Insights",
    description: "Rolling 30-day engagement score from Mighty community activity.",
    status: "done",
    items: [
      { status: "done", done: true, label: "6 engagement event handlers" },
      { status: "done", done: true, label: "30-day rolling window with decay" },
      { status: "done", done: true, label: "lifestarr_engagement_score property sync" },
      { status: "done", done: true, label: "engagement_scores DB table for historical analysis" },
    ],
  },
  {
    id: "content-event-automation",
    number: 4,
    name: "Content & Event Automation",
    description: "Reactive flows triggered by post/comment/RSVP activity.",
    status: "in_progress",
    items: [
      { status: "done", done: true, label: "PostCreated, CommentCreated, RsvpCreated handlers" },
      { status: "planned", done: false, label: "HubSpot list segments for active commenters" },
      {
        status: "planned",
        done: false,
        label: "Email digest automation for top engagers",
      },
    ],
  },
  {
    id: "premier-upsell",
    number: 5,
    name: "Premier Upsell Trigger",
    description: "Automatically flag highly-engaged Intro members for the Premier sequence.",
    status: "done",
    items: [
      { status: "done", done: true, label: "50-point engagement threshold" },
      { status: "done", done: true, label: "lifestarr_premier_ready property in HubSpot" },
      { status: "planned", done: false, label: "HubSpot sequence wired to property change (Joe)" },
    ],
  },
  {
    id: "ai-integration",
    number: 6,
    name: "AI Integration",
    description: "Deferred for V1 — revisit after baseline integration is stable.",
    status: "deferred",
    items: [
      { status: "deferred", done: false, label: "Member-context summaries via Claude" },
      { status: "deferred", done: false, label: "Auto-suggested Premier upsell timing" },
    ],
  },
  {
    id: "solopreneur-connector",
    number: 7,
    name: "Solopreneur Connector",
    description: "Surface high-affinity matches between members for connection requests.",
    status: "planned",
    items: [
      { status: "planned", done: false, label: "Member matching algorithm spec" },
      { status: "planned", done: false, label: "HubSpot custom object for connections" },
      { status: "planned", done: false, label: "Email intro automation" },
    ],
  },
];
