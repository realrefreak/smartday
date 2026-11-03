// Which web address(es) Better Auth should accept sign-ins from.
//
// Better Auth checks that sign-in requests come from the app's own address,
// so a fake site can't submit forms to it. Production and local dev have one
// fixed address (BETTER_AUTH_URL). Preview deployments don't: every preview
// gets new addresses like smartday-abc123.vercel.app, so a fixed setting
// can't work there.
//
// Vercel tells each deployment its own addresses through built-in variables:
//   VERCEL_ENV        - "production", "preview" or "development"
//   VERCEL_URL        - this exact deployment's address
//   VERCEL_BRANCH_URL - an address that always points at the branch's latest preview
// For previews we allow exactly those two hosts. Not "*.vercel.app": that
// would trust every Vercel site in the world, including other people's.

export function authUrlOptions(env = process.env) {
  if (env.VERCEL_ENV !== "preview") {
    // Production and local: the fixed address from BETTER_AUTH_URL.
    return { baseURL: env.BETTER_AUTH_URL };
  }

  const hosts = [env.VERCEL_URL, env.VERCEL_BRANCH_URL].filter(Boolean);

  return {
    baseURL: { allowedHosts: hosts, fallback: `https://${hosts[0]}` },
    trustedOrigins: hosts.map((host) => `https://${host}`),
  };
}
