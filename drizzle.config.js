// Settings for drizzle-kit, the command-line tool that creates and applies migrations.

import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Load .env.local the same way Next.js does, so DATABASE_URL is available here too.
loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.js",
  // Generated SQL migration files go here, and are committed to Git.
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
