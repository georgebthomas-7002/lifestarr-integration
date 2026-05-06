import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

export type WebhookEventStatus =
  | "pending"
  | "success"
  | "failed"
  | "retrying"
  | "needs_review"
  | "no_handler_registered";

export type IntegrationStatus = "live" | "paused" | "building" | "not_started";

export const webhookEvents = pgTable("webhook_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: text("event_id").notNull().unique(),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  status: text("status").$type<WebhookEventStatus>().default("pending").notNull(),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0).notNull(),
  handlerName: text("handler_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const integrations = pgTable("integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  eventType: text("event_type").notNull(),
  description: text("description").notNull(),
  status: text("status").$type<IntegrationStatus>().default("not_started").notNull(),
  lastFiredAt: timestamp("last_fired_at", { withTimezone: true }),
  successCount: integer("success_count").default(0).notNull(),
  failureCount: integer("failure_count").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const needsReviewQueue = pgTable("needs_review_queue", {
  id: uuid("id").primaryKey().defaultRandom(),
  webhookEventId: uuid("webhook_event_id").references(() => webhookEvents.id, {
    onDelete: "set null",
  }),
  mightyEmail: text("mighty_email"),
  mightyMemberId: text("mighty_member_id"),
  reason: text("reason").notNull(),
  resolved: boolean("resolved").default(false).notNull(),
  resolvedBy: text("resolved_by"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type RecentEvent = {
  eventType: string;
  timestamp: string;
  points: number;
};

export const engagementScores = pgTable("engagement_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  mightyMemberId: text("mighty_member_id").notNull(),
  mightyEmail: text("mighty_email").notNull(),
  score: integer("score").default(0).notNull(),
  lastCalculatedAt: timestamp("last_calculated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  lastSyncedToHubspotAt: timestamp("last_synced_to_hubspot_at", { withTimezone: true }),
  recentEvents: jsonb("recent_events").$type<RecentEvent[]>().default([]).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable("user", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true, mode: "date" }),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const accounts = pgTable(
  "account",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [primaryKey({ columns: [account.provider, account.providerAccountId] })],
);

export const sessions = pgTable("session", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true, mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_token",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true, mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);
