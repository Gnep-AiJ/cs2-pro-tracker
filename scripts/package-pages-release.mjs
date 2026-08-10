import { createHash } from "node:crypto";
import { access, cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, join, resolve, sep } from "node:path";
import { build } from "esbuild";

const projectRoot = resolve(".");
const releaseRoot = resolve(process.argv[2] || ".cf-pages-release-cs2pro-current");
if (!releaseRoot.startsWith(`${projectRoot}${sep}`) || !basename(releaseRoot).startsWith(".cf-pages-release-")) {
  throw new Error("Release directory must be a new .cf-pages-release-* directory inside the project");
}
try {
  await access(releaseRoot);
  throw new Error(`Release directory already exists: ${releaseRoot}`);
} catch (error) {
  if (error instanceof Error && error.message.startsWith("Release directory already exists")) throw error;
}

const clientRoot = resolve("dist/client");
await access(resolve("dist/server/index.js"));
await access(clientRoot);
const releaseVersion = createHash("sha256")
  .update(await readFile(resolve("dist/client/.vite/manifest.json")))
  .digest("hex")
  .slice(0, 12);
await mkdir(releaseRoot);
for (const entry of await readdir(clientRoot)) {
  await cp(join(clientRoot, entry), join(releaseRoot, entry), { recursive: true });
}

await build({
  entryPoints: [resolve("scripts/pages-worker-entry.mjs")],
  outfile: join(releaseRoot, "_worker.js"),
  bundle: true,
  format: "esm",
  platform: "node",
  conditions: ["worker", "browser"],
  define: { "process.env.CS2_RELEASE_VERSION": JSON.stringify(releaseVersion) },
});

const compatibilityDate = new Date().toISOString().slice(0, 10);
await writeFile(join(releaseRoot, "_headers"), `# Cache content-hashed assets immutably
/assets/*
  Cache-Control: public, max-age=31536000, immutable

# The versioned community QR image changes path when its content changes
/wechat-community-qr-v1.png
  Cache-Control: public, max-age=31536000, immutable
`, "utf8");

await writeFile(join(releaseRoot, "wrangler.toml"), `name = "cs2pro"
pages_build_output_dir = "."
compatibility_date = "${compatibilityDate}"

[env.production]
compatibility_flags = ["nodejs_compat"]

[env.production.ai]
binding = "AI"

[ai]
binding = "AI"
`, "utf8");

console.log(`Packaged one-build Pages release: ${releaseRoot}`);
