import { beforeEach, describe, expect, it, vi } from "vitest";

// A fake cookie store that records what the action does.
const cookieStore = { set: vi.fn(), delete: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

import { setThemeAction } from "@/app/theme-actions";
import { THEME_COOKIE, parseTheme, themeClass } from "@/lib/theme";

function form(theme) {
  const data = new FormData();
  if (theme !== undefined) data.set("theme", theme);
  return data;
}

describe("parseTheme", () => {
  it("accepts the three themes", () => {
    expect(parseTheme("system")).toBe("system");
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
  });

  it("treats anything else as system", () => {
    expect(parseTheme(undefined)).toBe("system");
    expect(parseTheme("DARK")).toBe("system");
    expect(parseTheme("purple")).toBe("system");
    expect(parseTheme(["dark"])).toBe("system");
  });
});

describe("themeClass", () => {
  it("forces light or dark, and leaves system to the device", () => {
    expect(themeClass("light")).toBe("light");
    expect(themeClass("dark")).toBe("dark");
    expect(themeClass("system")).toBe("");
  });
});

describe("setThemeAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves light or dark in a long-lived cookie", async () => {
    await setThemeAction(form("dark"));

    expect(cookieStore.set).toHaveBeenCalledWith(
      THEME_COOKIE,
      "dark",
      expect.objectContaining({ path: "/", httpOnly: true, sameSite: "lax" }),
    );
    expect(cookieStore.set.mock.calls[0][2].maxAge).toBeGreaterThan(60 * 60 * 24 * 300);
  });

  it("removes the cookie for system, the default", async () => {
    await setThemeAction(form("system"));

    expect(cookieStore.delete).toHaveBeenCalledWith(THEME_COOKIE);
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("never stores a made-up value", async () => {
    await setThemeAction(form("<script>"));
    await setThemeAction(form());

    expect(cookieStore.set).not.toHaveBeenCalled();
    expect(cookieStore.delete).toHaveBeenCalledTimes(2);
  });
});
