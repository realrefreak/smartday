// What a reminder email says. A plain function: give it the tasks, get back
// the subject, a plain-text version and an HTML version.

import { formatDueDate } from "@/lib/due-date";
import { formatLongDate } from "@/lib/dashboard";

// Task titles are typed by users. Pasted into HTML as they are, a title like
// "<img src=x onerror=...>" would become real HTML in the email. Escaping
// turns the special characters into harmless text.
export function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function whenText(task, today) {
  if (task.dueDate === today) return "due today";
  return `overdue since ${formatDueDate(task.dueDate)}`;
}

// tasks: unfinished tasks that are overdue or due today, in priority order.
export function buildReminderEmail({ name, tasks, today, appUrl, unsubscribeUrl }) {
  const firstName = (name ?? "").trim().split(/\s+/)[0];
  const hello = firstName ? `Hi ${firstName},` : "Hi,";
  const overdue = tasks.filter((task) => task.dueDate < today).length;

  const count = tasks.length === 1 ? "1 task" : `${tasks.length} tasks`;
  const subject = overdue > 0 ? `${count} for today (${overdue} overdue)` : `${count} for today`;
  const date = formatLongDate(today);

  const text = [
    hello,
    "",
    `Here's what's on your list for ${date}:`,
    "",
    ...tasks.map((task) => `- ${task.title} (${whenText(task, today)})`),
    "",
    `Open SmartDay: ${appUrl}/tasks?show=today`,
    "",
    `Don't want these emails? Unsubscribe: ${unsubscribeUrl}`,
  ].join("\n");

  const items = tasks
    .map((task) => {
      const late = task.dueDate < today;
      return `<li style="margin:0 0 8px">${escapeHtml(task.title)} <span style="color:${
        late ? "#b91c1c" : "#71717a"
      };font-size:13px">(${escapeHtml(whenText(task, today))})</span></li>`;
    })
    .join("");

  // Email programs ignore <style> sheets and most modern CSS, so the styles
  // go inline on each element.
  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#ffffff;color:#18181b;font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.5">
<div style="max-width:520px;margin:0 auto">
<p style="margin:0 0 16px">${escapeHtml(hello)}</p>
<p style="margin:0 0 16px">Here&#39;s what&#39;s on your list for ${escapeHtml(date)}:</p>
<ul style="margin:0 0 24px;padding-left:20px">${items}</ul>
<p style="margin:0 0 32px"><a href="${escapeHtml(`${appUrl}/tasks?show=today`)}" style="display:inline-block;background:#18181b;color:#ffffff;padding:10px 18px;border-radius:6px;text-decoration:none">Open SmartDay</a></p>
<p style="margin:0;color:#71717a;font-size:12px">You get this because you turned on daily reminders. <a href="${escapeHtml(unsubscribeUrl)}" style="color:#71717a">Unsubscribe</a></p>
</div>
</body></html>`;

  return { subject, text, html };
}
