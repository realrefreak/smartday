// SmartDay's service worker: a small script the browser keeps installed and
// wakes up when a notification arrives, even if no SmartDay tab is open.
// It does nothing else (no offline caching), so it can never serve you an
// old copy of the app.
//
// Plain browser JavaScript, served as-is from /sw.js: no imports, no build.

// A push message arrived: show it. The server sends JSON like
//   { "title": "3 tasks for today", "body": "Pay rent, ...", "url": "/tasks?show=today" }
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "SmartDay", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      // A newer reminder replaces an older one instead of piling up.
      tag: data.tag || "smartday-reminder",
      data: { url: data.url || "/" },
    }),
  );
});

// The notification was tapped: focus an open SmartDay window if there is
// one, otherwise open a new one, at the notification's page.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (open) {
        return open.focus().then((client) => client.navigate(url));
      }
      return self.clients.openWindow(url);
    }),
  );
});
