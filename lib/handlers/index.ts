import { handleMemberJoined } from "./member-joined";
import { handleMemberPlanChanged } from "./member-plan-changed";
import { handleMemberPurchased } from "./member-purchased";
import { handleMemberRemovedFromPlan } from "./member-removed-from-plan";
import { handleMemberSubscriptionCanceled } from "./member-subscription-canceled";
import { handleMemberSubscriptionRenewed } from "./member-subscription-renewed";

import type { HandlerResult, MightyWebhookPayload } from "@/lib/types";

export type WebhookHandler = (payload: MightyWebhookPayload) => Promise<HandlerResult>;

export const handlers: Record<string, WebhookHandler> = {
  MemberJoined: handleMemberJoined,
  MemberPurchased: handleMemberPurchased,
  MemberPlanChanged: handleMemberPlanChanged,
  MemberSubscriptionCanceled: handleMemberSubscriptionCanceled,
  MemberSubscriptionRenewed: handleMemberSubscriptionRenewed,
  MemberRemovedFromPlan: handleMemberRemovedFromPlan,
};
