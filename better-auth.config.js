// Used only by the Better Auth CLI (npx auth generate), which needs an exported
// `auth` object to work out which tables to create. The app itself uses
// getAuth() from lib/auth.js instead.

import { loadEnvConfig } from "@next/env";
import { createAuth } from "./lib/auth.js";
import { getDb } from "./db/index.js";

loadEnvConfig(process.cwd());

export const auth = createAuth(getDb());
