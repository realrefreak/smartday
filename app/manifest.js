// The web app manifest, served at /manifest.webmanifest. Next.js adds the
// <link rel="manifest"> to every page for us. It's what lets people install
// SmartDay: "Add to Home screen" on phones, the install button in Chrome and
// Edge. Once installed it opens in its own window, without the browser's
// address bar ("display: standalone"), and shows up like any other app.
//
// Icons are drawn by scripts/make-icons.mjs.
export default function manifest() {
  return {
    name: "SmartDay",
    short_name: "SmartDay",
    description: "Organize your day, one task at a time.",
    // Where the installed app opens. The home page shows your dashboard once
    // you're signed in.
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // "maskable": the phone may crop it into a circle or rounded square, so
      // this one keeps the tick well inside the edges.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Long-press the installed icon to jump straight to these.
    shortcuts: [
      { name: "Tasks", url: "/tasks", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Calendar", url: "/calendar", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Weekly review", url: "/review", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
