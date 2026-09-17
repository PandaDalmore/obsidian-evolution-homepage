// 发版改版本号：一处命令同步 manifest.json / package.json，
// 并在 README 的「更新日志」和「Changelog」两节顶部各追加一条新版本占位。
// 用法：node scripts/bump-version.mjs 1.0.8
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const next = process.argv[2];

if (!/^\d+\.\d+\.\d+$/.test(next ?? "")) {
  console.error("\n用法：node scripts/bump-version.mjs <x.y.z>  （例：1.0.8）\n");
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

const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

const readmePath = join(root, "README.md");
const lines = readFileSync(readmePath, "utf8").split("\n");

// 同一版本号是否已存在（两节共用一个判断，避免中英文各查一次互相干扰）
const versionRe = new RegExp(`^###\\s+${next.replace(/\./g, "\\.")}\\b`);
const alreadyThere = lines.some((l) => versionRe.test(l));

// 在指定小节顶部插入一条版本条目：标题 + 一行占位要点。
// 返回 inserted / exists / missing，重打同版本号时不会重复插入。
const insertEntry = (heading, title, bullet) => {
  const start = lines.findIndex((l) => l.trim() === heading);
  if (start === -1) return "missing";
  if (alreadyThere) return "exists";

  let pos = start + 1;
  while (
    pos < lines.length &&
    !/^###\s/.test(lines[pos]) &&
    !/^##\s/.test(lines[pos]) &&
    lines[pos].trim() !== "---"
  ) {
    pos += 1;
  }
  while (pos > start + 1 && lines[pos - 1].trim() === "") pos -= 1;

  // 前一行是说明文字时先补一个空行，标题不贴在段落后面
  const lead = pos > 0 && lines[pos - 1].trim() !== "" ? [""] : [];
  lines.splice(pos, 0, ...lead, title, "", bullet);
  const after = pos + lead.length + 3;
  if (after < lines.length && lines[after].trim() !== "") lines.splice(after, 0, "");
  return "inserted";
};

const zh = insertEntry("## 更新日志", `### ${next}（${date}）`, "- **新增** ");
const en = insertEntry("## Changelog", `### ${next} (${date})`, "- **Added** ");

if (zh === "inserted" || en === "inserted") {
  writeFileSync(readmePath, lines.join("\n"));
}

const label = { inserted: "已追加条目", exists: "已有该版本条目，跳过", missing: "未找到该小节" };
console.log(`[bump-version] ${next}：manifest.json + package.json 已更新`);
console.log(`[bump-version] README 更新日志：${label[zh]}`);
console.log(`[bump-version] README Changelog：${label[en]}`);
if (zh === "inserted" || en === "inserted") {
  console.log("[bump-version] 记得把新版本条目里的占位要点补完再提交");
}
