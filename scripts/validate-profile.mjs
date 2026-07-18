import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const failures = [];
for (const rel of [
  "assets/hero/orochi.png",
  "assets/generated/terminal.svg",
  "assets/generated/ascii-orochi.svg",
  "assets/generated/pulse-divider.svg"
]) {
  if (!fs.existsSync(path.join(root, rel))) failures.push(`missing ${rel}`);
}
for (const rel of [...readme.matchAll(/(?:src|href)="(\.\/[^"]+)"/g)].map((m) => m[1])) {
  if (!fs.existsSync(path.resolve(root, rel))) failures.push(`broken local reference ${rel}`);
}
if (!readme.includes("PROFILE_USERNAME:")) failures.push("missing profile username marker");
if ((readme.match(/<div/g) || []).length !== (readme.match(/<\/div>/g) || []).length) failures.push("unbalanced div tags");
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("README structure and local asset references are valid.");
