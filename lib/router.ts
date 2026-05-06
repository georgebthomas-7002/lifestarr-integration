import { handlers } from "@/lib/handlers";
import type { HandlerResult, MightyWebhookPayload } from "@/lib/types";

export type DispatchOutcome =
  | { kind: "handled"; handlerName: string; result: HandlerResult }
  | { kind: "no_handler"; eventType: string };

export async function dispatch(payload: MightyWebhookPayload): Promise<DispatchOutcome> {
  const handler = handlers[payload.event_type];
  if (!handler) {
    return { kind: "no_handler", eventType: payload.event_type };
  }
  const result = await handler(payload);
  return { kind: "handled", handlerName: payload.event_type, result };
}
