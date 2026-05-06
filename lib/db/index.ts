import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

type DbClient = ReturnType<typeof drizzle<typeof schema>>;

let _db: DbClient | null = null;

function getDb(): DbClient {
  if (_db) return _db;
  const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Run `vercel env pull .env.local` after attaching Neon to the project.",
    );
  }
  const sql = neon(connectionString);
  _db = drizzle(sql, { schema });
  return _db;
}

// Lazy-resolving proxy so importing this module never throws at build time —
// the env check fires only when a query actually runs.
export const db: DbClient = new Proxy({} as DbClient, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(real) : value;
  },
});

export type Db = DbClient;
export * from "./schema";
