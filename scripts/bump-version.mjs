// 发版改版本号：一处命令同步 manifest.json / package.json / README 的版本标题。
// 用法：node scripts/bump-version.mjs 1.0.5
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const next = process.argv[2];

if (!/^\d+\.\d+\.\d+$/.test(next ?? "")) {
  console.error('\n用法：node scripts/bump-version.mjs <x.y.z>  （例：1.0.5）\n');
  process.exit(1);
}

const writeJson = (file, mutate) => {
  const path = join(root, file);
  const json = JSON.parse(readFileSync(path, "utf8"));
  mutate(json);
  writeFileSync(path, JSON.stringify(json, null, 2) + "\n");
};

writeJson("manifest.json", (j) => { j.version = next; });
writeJson("package.json", (j) => { j.version = next; });

const readmePath = join(root, "README.md");
const lines = readFileSync(readmePath, "utf8").split("\n");
let hits = 0;
const nextReadme = lines.map((line) => {
  const m = line.match(/^(##\s+(?:V|Version)[\s.]*)(\d+\.\d+\.\d+)(.*)$/i);
  if (!m) return line;
  hits += 1;
  return `${m[1]}${next}${m[3]}`;
});
writeFileSync(readmePath, nextReadme.join("\n"));

console.log(`[bump-version] ${next}：manifest.json + package.json + README ${hits} 处标题`);
if (hits === 0) console.warn("[bump-version] 警告：README 里没找到版本标题，检查标题写法是否为「## V 1.0.5 功能」/「## Version 1.0.5」");
