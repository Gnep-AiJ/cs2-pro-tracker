import assert from "node:assert/strict";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders production metadata without development marker", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  const html = await response.text();
  assert.doesNotMatch(html, developmentPreviewMeta);
  assert.match(
    html,
    /<script(?=[^>]*\bsrc=["']https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-6630686107097564["'])(?=[^>]*\bcrossorigin=["']anonymous["'])[^>]*><\/script>/i,
  );
  assert.match(html, /CS2 Pro Tracker — FACEIT &amp; Events/);
  assert.match(html, /FACEIT matches/);
  assert.match(html, /Recent matches/);
  assert.match(html, /aria-haspopup="dialog"/);
  assert.match(html, /<dialog[^>]*aria-labelledby="match-details-title"/);
  assert.match(html, /aria-label="Search matches"/);
  assert.match(html, /Contact &amp; support/);
  assert.ok(html.indexOf('href="/faceit?lang=en"') < html.indexOf('href="/matches?lang=en"'));
});
