"use client";
// Turns notifications on or off for THIS device (phone, laptop...). Each
// device asks for permission separately, so this can't be a setting saved
// once for the whole account like email is.

import { useEffect, useState } from "react";
import { sendTestPushAction, subscribePushAction, unsubscribePushAction } from "./push-actions";

const buttonClass = "rounded bg-foreground px-4 py-2 text-background disabled:opacity-60";
const secondaryClass =
  "rounded border border-black/15 px-4 py-2 hover:bg-black/5 disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/10";

// The public key travels as base64url text; subscribe() wants raw bytes.
function keyBytes(base64url) {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

// Works out what this browser can do. Runs only in the browser (from
// useEffect), since the server has no navigator or window.
async function currentStatus() {
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supported) {
    // iPhones only allow notifications for apps added to the Home Screen.
    const iPhone = /iPhone|iPad|iPod/.test(navigator.userAgent);
    return { status: iPhone ? "needs-install" : "unsupported", subscription: null };
  }
  if (Notification.permission === "denied") return { status: "blocked", subscription: null };

  // updateViaCache "none": always check /sw.js for a newer version.
  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  const subscription = await registration.pushManager.getSubscription();
  return { status: subscription ? "on" : "off", subscription };
}

export default function PushToggle({ publicKey, hourText }) {
  // No key = notifications aren't set up on this server, nothing to check.
  const [status, setStatus] = useState(publicKey ? "loading" : "unconfigured");
  const [subscription, setSubscription] = useState(null);
  const [message, setMessage] = useState({ text: "", error: false });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!publicKey) return;
    currentStatus()
      .then((result) => {
        setStatus(result.status);
        setSubscription(result.subscription);
      })
      .catch(() => setStatus("unsupported"));
  }, [publicKey]);

  // Runs `work`, showing "busy" meanwhile and any error it reports.
  async function attempt(work) {
    setBusy(true);
    setMessage({ text: "", error: false });
    try {
      await work();
    } catch {
      setMessage({ text: "Something went wrong. Please try again.", error: true });
    } finally {
      setBusy(false);
    }
  }

  const turnOn = () =>
    attempt(async () => {
      const registration = await navigator.serviceWorker.ready;
      // This is what makes the browser ask "Allow notifications?".
      let created;
      try {
        created = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(publicKey),
        });
      } catch {
        const blocked = Notification.permission === "denied";
        setStatus(blocked ? "blocked" : "off");
        setMessage({ text: blocked ? "" : "Notifications weren't turned on.", error: !blocked });
        return;
      }

      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
      const saved = await subscribePushAction(created.toJSON(), timeZone);
      if (!saved.ok) {
        await created.unsubscribe();
        setMessage({ text: saved.error, error: true });
        return;
      }
      setSubscription(created);
      setStatus("on");
      setMessage({ text: "Notifications are on for this device.", error: false });
    });

  const turnOff = () =>
    attempt(async () => {
      if (subscription) {
        await unsubscribePushAction(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setSubscription(null);
      setStatus("off");
      setMessage({ text: "Notifications are off for this device.", error: false });
    });

  const sendTest = () =>
    attempt(async () => {
      const result = await sendTestPushAction();
      setMessage(
        result.ok
          ? { text: "Test sent. It should appear in a few seconds.", error: false }
          : { text: result.error, error: true },
      );
    });

  const notes = {
    loading: "Checking this device…",
    unconfigured: "Notifications aren't set up on this server yet.",
    unsupported: "This browser can't show notifications from websites.",
    "needs-install":
      "On iPhone and iPad, add SmartDay to your Home Screen first (Share, then “Add to Home Screen”), then open it from there and turn notifications on.",
    blocked:
      "Notifications are blocked for SmartDay in this browser. Allow them in the browser's site settings, then reload this page.",
    off: `Get a notification on this device at ${hourText} when something is due or overdue.`,
    on: `On for this device. You'll get one at ${hourText} when something is due or overdue.`,
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{notes[status]}</p>

      {status === "off" && (
        <button type="button" onClick={turnOn} disabled={busy} className={buttonClass}>
          {busy ? "Turning on…" : "Turn on notifications"}
        </button>
      )}
      {status === "on" && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={sendTest} disabled={busy} className={buttonClass}>
            Send a test notification
          </button>
          <button type="button" onClick={turnOff} disabled={busy} className={secondaryClass}>
            Turn off on this device
          </button>
        </div>
      )}

      {/* Only there when there's something to say, like the other forms'
          messages, so a page never has empty status messages lying around. */}
      {message.text && (
        <p
          role={message.error ? "alert" : "status"}
          className={`text-sm ${message.error ? "text-red-600 dark:text-red-400" : "text-zinc-600 dark:text-zinc-400"}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
