import { ProxyAgent, fetch } from "undici";

const base = process.argv[2] || "https://cs2pro.pages.dev";
const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const dispatcher = proxy ? new ProxyAgent(proxy) : undefined;

for (const path of ["/", "/faceit", "/rankings", "/news"]) {
  const response = await fetch(`${base}${path}`, { dispatcher });
  const html = await response.text();
  const stylesheets = [...html.matchAll(/href="([^"]+\.css[^"]*)"/g)].map(match => match[1]);
  console.log(JSON.stringify({ path, status: response.status, bytes: html.length, stylesheets }));
  for (const href of stylesheets) {
    const assetUrl = new URL(href, base);
    const asset = await fetch(assetUrl, { dispatcher });
    const body = await asset.arrayBuffer();
    console.log(JSON.stringify({ asset: assetUrl.pathname, status: asset.status, type: asset.headers.get("content-type"), bytes: body.byteLength }));
  }
}
