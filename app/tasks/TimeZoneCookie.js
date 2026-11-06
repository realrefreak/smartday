"use client";
// Tells the server the user's time zone, so "Today" means the user's today.
// Renders nothing: it only writes a cookie.
//
// Only the browser knows its time zone, and only once it's running, so this
// happens in useEffect after the page has appeared. If the cookie was missing
// or out of date (first visit, or travelling), the page was just worked out
// with the wrong zone: router.refresh() asks the server for it again, now
// with the cookie. That happens once; after that the cookie already matches.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TIME_ZONE_COOKIE } from "@/lib/time-zone";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export default function TimeZoneCookie({ saved }) {
  const router = useRouter();

  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timeZone || timeZone === saved) return;

    // Saved as it is, not URL-encoded: zone names only use letters, digits,
    // "/", "_", "+" and "-", which are all allowed in a cookie, and this way
    // the server reads back exactly what was written.
    document.cookie = `${TIME_ZONE_COOKIE}=${timeZone}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
    router.refresh();
  }, [saved, router]);

  return null;
}
