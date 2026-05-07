import {
  handleCommentCreated,
  handleMemberCourseProgressCompleted,
  handleMemberCourseProgressStarted,
  handlePostCreated,
  handleReactionCreated,
  handleRsvpCreated,
} from "./engagement";
import { handleMemberJoined } from "./member-joined";
import { handleMemberPlanChanged } from "./member-plan-changed";
import { handleMemberPurchased } from "./member-purchased";
import { handleMemberRemovedFromPlan } from "./member-removed-from-plan";
import { handleMemberSubscriptionCanceled } from "./member-subscription-canceled";
import { handleMemberSubscriptionRenewed } from "./member-subscription-renewed";
import { handleMemberUpdated } from "./member-updated";
import { handleSpaceMemberAdded, handleSpaceMemberRemoved } from "./space-membership";

import type { HandlerResult, MightyWebhookPayload } from "@/lib/types";

export type WebhookHandler = (payload: MightyWebhookPayload) => Promise<HandlerResult>;

export const handlers: Record<string, WebhookHandler> = {
  // Tier 1: lifecycle / monetization
  // (event_type values are normalized — Mighty's "MemberJoinedHook" → "MemberJoined")
  MemberJoined: handleMemberJoined,
  MemberUpdated: handleMemberUpdated,
  MemberPurchased: handleMemberPurchased,
  MemberPlanChanged: handleMemberPlanChanged,
  MemberSubscriptionCanceled: handleMemberSubscriptionCanceled,
  MemberSubscriptionRenewed: handleMemberSubscriptionRenewed,
  MemberRemovedFromPlan: handleMemberRemovedFromPlan,

  // Tier 2: engagement signals
  MemberCourseProgressStarted: handleMemberCourseProgressStarted,
  MemberCourseProgressCompleted: handleMemberCourseProgressCompleted,
  PostCreated: handlePostCreated,
  CommentCreated: handleCommentCreated,
  RsvpCreated: handleRsvpCreated,
  ReactionCreated: handleReactionCreated,

  // Tier 2: space membership (track-affinity signal)
  SpaceMemberAdded: handleSpaceMemberAdded,
  SpaceMemberRemoved: handleSpaceMemberRemoved,
};
