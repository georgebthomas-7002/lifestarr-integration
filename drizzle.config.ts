import "dotenv/config";

import { defineConfig } from "drizzle-kit";

if (!process.env.POSTGRES_URL) {
  throw new Error(
    "POSTGRES_URL is not set. Run `vercel env pull .env.local` after linking the project, or add it to .env.local manually.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.POSTGRES_URL,
  },
  verbose: true,
  strict: true,
});
