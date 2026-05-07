import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

/**
 * Eagerly construct the Drizzle client. The neon driver doesn't open a
 * connection until a query actually runs, so a placeholder URL at build
 * time is fine — queries that fire at runtime will use the real env var.
 *
 * This shape (vs. a Proxy) is required by @auth/drizzle-adapter, which
 * does property introspection on `db` at module load to pick the right
 * driver path. Lazy/Proxy patterns cause "Unsupported database type".
 */
const PLACEHOLDER_URL = "postgresql://placeholder:placeholder@localhost:5432/placeholder";

const connectionString =
  process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? PLACEHOLDER_URL;

if (connectionString === PLACEHOLDER_URL) {
  // Useful warning during local dev / `next build` without env, but never
  // hard-fail at module load — that breaks Vercel's page-data collection.
  if (typeof window === "undefined") {
    console.warn(
      "[db] DATABASE_URL not set; using placeholder. Real queries will fail until env is configured.",
    );
  }
}

const sql = neon(connectionString);

export const db = drizzle(sql, { schema });

export type Db = typeof db;
export * from "./schema";
