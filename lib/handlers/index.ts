import type { HandlerResult, MightyWebhookPayload } from "@/lib/types";

export type WebhookHandler = (payload: MightyWebhookPayload) => Promise<HandlerResult>;

export const handlers: Record<string, WebhookHandler> = {};
