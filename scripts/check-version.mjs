// 发版前校验：manifest.json / package.json / README 的版本号必须一致。
// 挂在 npm run build 第一步，不一致直接退出非零码，避免漏改。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));

const expected = read("manifest.json").version;
const found = [{ where: "package.json", value: read("package.json").version }];

const readme = readFileSync(join(root, "README.md"), "utf8");
readme.split("\n").forEach((line, i) => {
  const m = line.match(/^##\s+(?:V|Version)[\s.]*(\d+\.\d+\.\d+)/i);
  if (m) found.push({ where: `README.md:${i + 1}`, value: m[1] });
});

const bad = found.filter((x) => x.value !== expected);
if (bad.length) {
  console.error(`\n[check-version] 版本号不一致，以 manifest.json 的 ${expected} 为准：\n`);
  bad.forEach((x) => console.error(`  - ${x.where} -> ${x.value}`));
  console.error("\n把上面这些地方改成同一个版本号再重新构建。\n");
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+$/.test(expected)) {
  console.error(`\n[check-version] manifest.json 的版本号 "${expected}" 不是纯 x.y.z（Obsidian 只接受这种格式）\n`);
  process.exit(1);
}

console.log(`[check-version] 版本一致：${expected}（${found.length} 处）`);
