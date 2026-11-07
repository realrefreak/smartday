// Draws SmartDay's app icons and saves them as PNG files. Run it again after
// changing the design:  node scripts/make-icons.mjs
//
// The icons are drawn with ImageResponse from next/og, which turns HTML-like
// JSX (written here as plain objects, since this file isn't compiled) into a
// PNG. The results are committed, so nothing is drawn while the app runs.

import { writeFile } from "node:fs/promises";
// "next/og.js": plain Node needs the file extension that Next.js adds for us.
import { ImageResponse } from "next/og.js";

const BACKGROUND = "#18181b"; // zinc-900, the dark theme's background
const CHECK = "#34d399"; // emerald-400

// A tick inside a circle. `scale` is how much of the square the drawing
// fills: maskable icons get cut into circles or squircles by the phone, so
// they need room to spare (the "safe zone" is the middle 80%).
function icon(size, scale) {
  const mark = Math.round(size * scale);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${mark}" height="${mark}" fill="none" stroke="${CHECK}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m7.5 12.5 3 3 6-6.5"/></svg>`;

  return new ImageResponse(
    {
      type: "div",
      props: {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BACKGROUND,
        },
        children: {
          type: "img",
          props: { src: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`, width: mark, height: mark },
        },
      },
    },
    { width: size, height: size },
  );
}

const files = [
  ["public/icon-192.png", 192, 0.66],
  ["public/icon-512.png", 512, 0.66],
  ["public/icon-maskable-512.png", 512, 0.5],
  // Next.js links app/apple-icon.png automatically, for iPhone home screens.
  ["app/apple-icon.png", 180, 0.66],
];

for (const [path, size, scale] of files) {
  const png = Buffer.from(await icon(size, scale).arrayBuffer());
  await writeFile(path, png);
  console.log(`${path} (${size}x${size}, ${png.length} bytes)`);
}
