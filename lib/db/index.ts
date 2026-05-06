import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Run `vercel env pull .env.local` after attaching Neon to the project.",
  );
}

const sql = neon(connectionString);

export const db = drizzle(sql, { schema });

export type Db = typeof db;
export * from "./schema";
