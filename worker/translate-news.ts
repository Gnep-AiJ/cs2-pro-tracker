export interface AiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
}

type NewsItem = {
  id?: string;
  title?: string;
  originalTitle?: string;
  description?: string;
  source?: string;
  aiTranslated?: boolean;
};

type NewsPayload = { items?: NewsItem[] };
type SummaryMap = Record<string, string>;
type SummaryResult = { summaries: SummaryMap; status: "cached" | "generated" | "warming" | "unavailable" };

function generatedText(result: unknown) {
  if (!result || typeof result !== "object") return "";
  const record = result as Record<string, unknown>;
  if (typeof record.response === "string") return record.response;
  const choices = Array.isArray(record.choices) ? record.choices : [];
  const first = choices[0] as Record<string, unknown> | undefined;
  const message = first?.message as Record<string, unknown> | undefined;
  return typeof message?.content === "string" ? message.content : "";
}

function responseWithStatus(response: Response, status: string) {
  const headers = new Headers(response.headers);
  headers.set("x-ai-translation", status);
  headers.set("x-ai-summary", status);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function parseSummaries(value: string): SummaryMap {
  const cleaned = value
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^```(?:json)?\s*|\s*```$/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return {};
  const payload = JSON.parse(cleaned.slice(start, end + 1)) as { summaries?: Array<{ id?: unknown; summary?: unknown }> };
  const summaries: SummaryMap = {};
  for (const item of payload.summaries || []) {
    const id = String(item.id || "").trim();
    const summary = String(item.summary || "").replace(/\s+/g, " ").trim().slice(0, 180);
    if (id && summary) summaries[id] = summary;
  }
  return summaries;
}

async function summarizeBatch(
  ai: AiBinding,
  cache: Cache,
  fields: Array<{ id: string; title: string; description: string }>,
  ctx: ExecutionContextLike,
): Promise<SummaryResult> {
  const normalized = JSON.stringify(fields);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  const hash = Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
  const cacheKey = new Request(`https://cs2pro.internal/ai-summary-llama31-fast-batch-v3/${hash}`);
  const cached = await cache.match(cacheKey);
  if (cached) return { summaries: await cached.json() as SummaryMap, status: "cached" };

  const generation = (async () => {
    const result = await ai.run("@cf/meta/llama-3.1-8b-instruct-fast", {
      messages: [
        {
          role: "system",
          content: "你是严谨的中文 Counter-Strike 2 新闻编辑。为输入数组中的每条英文资讯写一句自然、准确的中文摘要。保留选手、战队、赛事、地图和比分等专有名词原文；不要补充原文没有的信息。只返回 JSON：{\"summaries\":[{\"id\":\"原 id\",\"summary\":\"最多 70 个汉字\"}]}。",
        },
        { role: "user", content: normalized },
      ],
      max_tokens: 1024,
      temperature: 0.1,
    });
    const summaries = parseSummaries(generatedText(result));
    if (Object.keys(summaries).length) {
      await cache.put(cacheKey, new Response(JSON.stringify(summaries), {
        headers: { "content-type": "application/json", "cache-control": "public, max-age=2592000" },
      }));
    }
    return summaries;
  })();
  const guarded = generation.catch(() => null);
  ctx.waitUntil(guarded.then(() => undefined));

  let timeout: ReturnType<typeof setTimeout> | undefined;
  const fastResult = await Promise.race([
    guarded.then(summaries => ({ completed: true as const, summaries })),
    new Promise<{ completed: false; summaries: null }>(resolve => {
      timeout = setTimeout(() => resolve({ completed: false, summaries: null }), 4_000);
    }),
  ]);
  if (timeout) clearTimeout(timeout);
  if (!fastResult.completed) return { summaries: {}, status: "warming" };
  if (!fastResult.summaries) return { summaries: {}, status: "unavailable" };
  return { summaries: fastResult.summaries, status: Object.keys(fastResult.summaries).length ? "generated" : "unavailable" };
}

export async function translateNews(response: Response, ai: AiBinding | undefined, ctx: ExecutionContextLike) {
  if (!response.ok) return response;
  if (!ai) return responseWithStatus(response, "binding-missing");

  try {
    const payload = await response.clone().json() as NewsPayload;
    const englishSources = new Set(["HLTV", "Dust2.us"]);
    const candidates = (payload.items || []).filter(item => englishSources.has(item.source || "")).slice(0, 6);
    if (!candidates.length) return responseWithStatus(response, "not-needed");

    const fields = candidates.map(item => ({
      item,
      id: item.id || "",
      title: item.title || "",
      description: (item.description || "").replace(/^(?:英文|原文)摘要：/, ""),
    })).filter(field => field.id && field.description.trim());
    if (!fields.length) return responseWithStatus(response, "not-needed");

    const cache = (caches as unknown as { default: Cache }).default;
    const summaryResult = await summarizeBatch(
      ai,
      cache,
      fields.map(({ id, title, description }) => ({ id, title, description })),
      ctx,
    );
    const translations = summaryResult.summaries;

    fields.forEach(field => {
      const translated = translations[field.id];
      if (!translated) return;
      field.item.originalTitle ||= field.item.title;
      field.item.description = `中文摘要：${translated}`;
      field.item.aiTranslated = true;
    });

    const translatedCount = Object.keys(translations).length;
    const headers = new Headers(response.headers);
    headers.set("content-type", "application/json; charset=utf-8");
    headers.set("x-ai-translation", translatedCount ? "translated" : summaryResult.status);
    headers.set("x-ai-summary", translatedCount ? "generated" : summaryResult.status);
    return new Response(JSON.stringify(payload), { status: response.status, headers });
  } catch {
    return responseWithStatus(response, "error");
  }
}
