import { access, readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const releaseRoot = resolve(process.argv[2] || ".cf-pages-release-cs2pro-20260808-v15-global-rank");
const workerPath = resolve(releaseRoot, "_worker.js");
const workerUrl = pathToFileURL(workerPath);
workerUrl.searchParams.set("asset-validation", `${process.pid}-${Date.now()}`);
const worker = await import(workerUrl.href);
const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
const ctx = { waitUntil() {}, passThroughOnException() {} };
const referenced = new Set();

for (const route of ["/", "/faceit", "/rankings", "/news"]) {
  const response = await worker.default.fetch(new Request(`http://localhost${route}`), env, ctx);
  if (response.status !== 200) throw new Error(`${route} rendered with status ${response.status}`);
  const html = await response.text();
  for (const match of html.matchAll(/(?:href|src)="(\/(?:assets\/[^"?#]+|[^"?#]+\.(?:svg|png)))"/g)) referenced.add(match[1]);
}

const missing = [];
for (const publicPath of referenced) {
  const filePath = resolve(releaseRoot, publicPath.slice(1));
  if (!filePath.startsWith(`${releaseRoot}${sep}`)) throw new Error(`Unsafe asset path: ${publicPath}`);
  try {
    await access(filePath);
    if (publicPath.endsWith(".css") && (await readFile(filePath)).byteLength < 1_000) missing.push(`${publicPath} (unexpectedly small)`);
  } catch {
    missing.push(publicPath);
  }
}

if (missing.length) throw new Error(`Missing release assets: ${missing.join(", ")}`);
console.log(`Validated ${referenced.size} rendered release assets across 4 routes.`);
