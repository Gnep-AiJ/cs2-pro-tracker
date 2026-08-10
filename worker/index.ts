/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { translateNews, type AiBinding } from "./translate-news";
import { generateRankingInsights } from "./ranking-insights";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  AI?: AiBinding;
  RELEASE_VERSION?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    if (request.method === "POST" && url.pathname === "/api/rankings/insights") {
      const sharedCache = typeof caches === "undefined" ? undefined : caches.default;
      return generateRankingInsights(request, env.AI, ctx, sharedCache);
    }

    const shellRoutes = new Set(["/", "/faceit", "/rankings", "/news", "/community", "/matches"]);
    const cacheableShell = request.method === "GET"
      && shellRoutes.has(url.pathname)
      && (request.headers.get("accept") || "").includes("text/html");
    const shellCache = typeof caches === "undefined" ? null : caches.default;
    if (cacheableShell && shellCache) {
      const cacheKey = new Request(`https://cs2pro.internal/page-shell-${env.RELEASE_VERSION || "development"}${url.pathname}`, { method: "GET" });
      const cached = await shellCache.match(cacheKey);
      if (cached) {
        const headers = new Headers(cached.headers);
        headers.set("x-shell-cache", "hit");
        return new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers });
      }

      const response = await handler.fetch(request, env, ctx);
      const contentType = response.headers.get("content-type") || "";
      if (response.ok && contentType.includes("text/html")) {
        const headers = new Headers(response.headers);
        headers.set("cache-control", "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800");
        headers.set("x-shell-cache", "miss");
        const finalResponse = new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
        ctx.waitUntil(shellCache.put(cacheKey, finalResponse.clone()));
        return finalResponse;
      }
      return response;
    }

    const cacheableApi = request.method === "GET" && ["/api/live", "/api/overview", "/api/rankings", "/api/news"].includes(url.pathname);
    if (cacheableApi) {
      const cache = caches.default;
      const cacheUrl = new URL(request.url);
      cacheUrl.protocol = "https:";
      cacheUrl.hostname = "cs2pro.internal";
      const cacheVersion = url.pathname === "/api/overview" ? "v17a" : url.pathname === "/api/news" ? "v17b" : url.pathname === "/api/live" ? "v16d" : "v16b";
      cacheUrl.pathname = `/cache-${cacheVersion}${url.pathname}`;
      const cacheKey = new Request(cacheUrl, { method: "GET" });
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
      const response = await handler.fetch(request, env, ctx);
      const finalResponse = url.pathname === "/api/news" ? await translateNews(response, env.AI, ctx) : response;
      const cacheControl = finalResponse.headers.get("cache-control") || "";
      if (finalResponse.ok && !/\bno-store\b/i.test(cacheControl)) {
        ctx.waitUntil(cache.put(cacheKey, finalResponse.clone()));
      }
      return finalResponse;
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
