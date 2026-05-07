import type { HandlerResult, MightyWebhookPayload } from "@/lib/types";

/**
 * Stub handlers for Mighty events we receive but deliberately don't act on.
 *
 * These come back as `Success` in the dashboard with a clear "intentionally
 * skipped" message — better than letting them sit as `no_handler_registered`,
 * which looks like an oversight to anyone reading the activity feed.
 *
 * If you decide one of these SHOULD do something (e.g. count toward engagement
 * scoring or sync content metadata to HubSpot), replace its registration in
 * lib/handlers/index.ts with a real handler.
 */

function makeNoOp(reason: string) {
  return async function (_payload: MightyWebhookPayload): Promise<HandlerResult> {
    return {
      success: true,
      message: `intentionally_not_scored: ${reason}`,
    };
  };
}

// PostUpdated fires when a member edits an existing community post — including
// when they edit their bio (Mighty stores the bio as an "About Me" post).
// Editing isn't fresh engagement, so we don't count it.
export const handlePostUpdated = makeNoOp("post edited, not new content");

// Reserved for similar Updated/Deleted variants Mighty might fire.
// Add registrations in lib/handlers/index.ts if/when they appear.
export const handleCommentUpdated = makeNoOp("comment edited, not new content");
export const handlePostDeleted = makeNoOp("post deleted — engagement removed");
export const handleCommentDeleted = makeNoOp("comment deleted — engagement removed");
