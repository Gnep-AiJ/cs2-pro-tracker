import { ProxyAgent, fetch } from "undici";

const base = process.argv[2] || "https://cs2pro.pages.dev";
const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const dispatcher = proxy ? new ProxyAgent(proxy) : undefined;

for (const path of ["/api/live?team=spirit", "/api/overview", "/api/rankings?region=EU", "/api/news"]) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const started = performance.now();
    const response = await fetch(`${base}${path}`, { dispatcher });
    const payload = await response.json();
    console.log(JSON.stringify({
      path,
      attempt,
      status: response.status,
      milliseconds: Math.round(performance.now() - started),
      cacheControl: response.headers.get("cache-control"),
      cacheStatus: response.headers.get("cf-cache-status"),
      mode: payload.mode ?? null,
      leaders: payload.leaders?.length ?? null,
      items: payload.items?.length ?? payload.faceit?.items?.length ?? null,
    }));
  }
}
