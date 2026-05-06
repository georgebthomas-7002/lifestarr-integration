export type MightyEventType =
  | "MemberJoined"
  | "MemberPurchased"
  | "MemberPlanChanged"
  | "MemberSubscriptionCanceled"
  | "MemberSubscriptionRenewed"
  | "MemberRemovedFromPlan"
  | "MemberCourseProgressStarted"
  | "MemberCourseProgressCompleted"
  | "PostCreated"
  | "CommentCreated"
  | "RsvpCreated"
  | "ReactionCreated";

export type MightyWebhookPayload = {
  event_id: string;
  event_timestamp: string;
  event_type: MightyEventType | (string & {});
  payload: Record<string, unknown>;
};

export type HandlerResult = {
  success: boolean;
  message?: string;
  hubspotContactId?: string;
  hubspotDealId?: string;
  needsReview?: boolean;
  reviewReason?: string;
};
