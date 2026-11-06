import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { THEME_COOKIE, parseTheme, themeClass } from "@/lib/theme";
import { signOutAction } from "./(auth)/actions";
import ThemePicker from "./ThemePicker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  // Pages can set their own title; "%s" is replaced by it, e.g. "About | SmartDay".
  title: {
    template: "%s | SmartDay",
    default: "SmartDay",
  },
  description: "Organize your day, one task at a time.",
};

export default async function RootLayout({ children }) {
  // Reading the session cookie means every page is now rendered per request
  // (shown as ƒ in the build), since the nav differs per visitor.
  const user = await getCurrentUser();
  // The saved theme, so <html> gets the right class from the start.
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${themeClass(theme)} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-black/10 dark:border-white/15">
          <nav className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4">
            <Link href="/" className="text-lg font-semibold">
              SmartDay
            </Link>
            <Link href="/" className="hover:underline">
              Home
            </Link>
            <Link href="/tasks" className="hover:underline">
              Tasks
            </Link>
            <Link href="/calendar" className="hover:underline">
              Calendar
            </Link>
            <Link href="/about" className="hover:underline">
              About
            </Link>

            <div className="ml-auto flex items-center gap-4 text-sm">
              {user ? (
                <>
                  {/* Your email doubles as the link to your Account page. */}
                  <Link
                    href="/account"
                    title="Account settings"
                    className="text-zinc-600 hover:underline dark:text-zinc-400"
                  >
                    {user.email}
                  </Link>
                  <form action={signOutAction}>
                    <button type="submit" className="hover:underline">
                      Sign out
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/sign-in" className="hover:underline">
                    Sign in
                  </Link>
                  <Link
                    href="/sign-up"
                    className="rounded bg-foreground px-3 py-1 text-background"
                  >
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </nav>
        </header>

        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
          {children}
        </main>

        <footer className="border-t border-black/10 dark:border-white/15">
          <div className="mx-auto flex max-w-3xl justify-end px-4 py-3">
            <ThemePicker theme={theme} />
          </div>
        </footer>
      </body>
    </html>
  );
}
