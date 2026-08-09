import app from "../dist/server/index.js";

const VINEXT_FONT_PREFIX = "/workspace/sites/cs2-pro-tracker/.vinext/fonts/";

export default {
  async fetch(request, env, ctx) {
    if ((request.method === "GET" || request.method === "HEAD") && env?.ASSETS) {
      const url = new URL(request.url);
      let assetRequest = request;

      if (url.pathname.startsWith(VINEXT_FONT_PREFIX)) {
        url.pathname = `/fonts/${url.pathname.slice(VINEXT_FONT_PREFIX.length)}`;
        assetRequest = new Request(url, request);
      }

      const assetResponse = await env.ASSETS.fetch(assetRequest);
      if (assetResponse.status !== 404) return assetResponse;
    }

    return app.fetch(request, env, ctx);
  },
};
