// Better Auth setup: how users sign up and sign in, and where that data is stored.

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "@/db";
import { authUrlOptions } from "@/lib/auth-url";
import * as schema from "@/db/schema";

// Builds an auth instance on top of a Drizzle database.
export function createAuth(db) {
  return betterAuth({
    // Users, sessions etc. are stored in our own Postgres tables (db/auth-schema.js).
    database: drizzleAdapter(db, { provider: "pg", schema }),

    // Sign-up / sign-in with email + password. Passwords are hashed before
    // being stored, so the database never contains the real password.
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
    },

    // Lets Server Actions set the session cookie (must be the last plugin).
    plugins: [nextCookies()],

    // The app's address: BETTER_AUTH_URL normally, or the deployment's own
    // Vercel addresses on preview deployments (see lib/auth-url.js).
    ...authUrlOptions(),

    // BETTER_AUTH_SECRET is read from the environment automatically.
  });
}

let auth;

// Created on first use (like getDb), so `next build` and unit tests don't need a database.
export function getAuth() {
  if (!auth) {
    auth = createAuth(getDb());
  }

  return auth;
}
