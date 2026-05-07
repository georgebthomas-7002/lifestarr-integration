import { handlers } from "@/lib/handlers";
import type { HandlerResult, MightyWebhookPayload } from "@/lib/types";

export type DispatchOutcome =
  | { kind: "handled"; handlerName: string; result: HandlerResult }
  | { kind: "no_handler"; eventType: string };

/**
 * Mighty's actual event_type strings end in "Hook" (e.g. "MemberJoinedHook")
 * even though their docs and webhook UI call them "Member Joined".
 * Strip the suffix so handler-registry keys stay clean ("MemberJoined").
 */
export function normalizeEventType(eventType: string): string {
  return eventType.replace(/Hook$/, "");
}

export async function dispatch(payload: MightyWebhookPayload): Promise<DispatchOutcome> {
  const normalized = normalizeEventType(payload.event_type);
  const handler = handlers[normalized];
  if (!handler) {
    return { kind: "no_handler", eventType: normalized };
  }
  const result = await handler(payload);
  return { kind: "handled", handlerName: normalized, result };
}
