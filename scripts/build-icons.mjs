import sharp from "sharp";
import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
const paths = {
  straight: "M32 54V10M17 25L32 10L47 25",
  left: "M44 54V24H12M26 10L12 24L26 38",
  right: "M20 54V24H52M38 10L52 24L38 38",
  "slight-left": "M47 53L14 14M14 36V14H36",
  "slight-right": "M17 53L50 14M28 14H50V36",
  roundabout: "M31 56V44A17 17 0 1 1 48 27H58M48 17L58 27L48 37",
  uturn: "M15 52V26A17 17 0 0 1 49 26V48M38 37L49 48L60 37",
  departure: "M32 53V12M19 26L32 12L45 26",
  arrival: "M15 53V11M15 12H48L40 23L48 34H15",
  neutral: "M32 13V35M32 49V50",
  walk: "M34 19L27 34L40 44L43 55M27 34L19 54M29 26L17 32M32 24L44 33L51 31",
  car: "M10 30L17 15H47L54 30V49H10ZM10 30H54M19 40H20M44 40H45M16 49V55M48 49V55",
};
const root = new URL("../", import.meta.url);
await mkdir(new URL("public/icons/", root), { recursive: true });
await mkdir(new URL("assets/icons/", root), { recursive: true });
for (const [name, d] of Object.entries(paths)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><g fill="none" stroke="#f2f2f2" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/>${name === "walk" ? '<circle cx="36" cy="9" r="5" fill="#f2f2f2" stroke="none"/>' : ""}</g></svg>`;
  await writeFile(new URL(`assets/icons/${name}.svg`, root), svg);
  await sharp(Buffer.from(svg))
    .resize(80, 80)
    .png()
    .toFile(new URL(`public/icons/${name}.png`, root).pathname);
}
console.log("Built 12 PNG icons.");
