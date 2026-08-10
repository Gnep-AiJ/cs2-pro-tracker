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
type Translation = { title: string; summary: string };
type TranslationMap = Record<string, Translation>;
type TranslationResult = {
  translations: TranslationMap;
  status: "cached" | "generated" | "warming" | "unavailable";
};

const MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const BATCH_SIZE = 5;
const FAST_TIMEOUT_MS = 4_000;
const activeGenerations = new Map<string, Promise<TranslationMap | null>>();

function generatedText(result: unknown) {
  if (!result || typeof result !== "object") return "";
  const record = result as Record<string, unknown>;
  if (typeof record.response === "string") return record.response;
  const choices = Array.isArray(record.choices) ? record.choices : [];
  const first = choices[0] as Record<string, unknown> | undefined;
  const message = first?.message as Record<string, unknown> | undefined;
  return typeof message?.content === "string" ? message.content : "";
}

function responseWithStatus(response: Response, status: string, coverage = "0/0", noStore = false) {
  const headers = new Headers(response.headers);
  headers.set("x-ai-translation", status);
  headers.set("x-ai-summary", status);
  headers.set("x-ai-translation-coverage", coverage);
  if (noStore) headers.set("cache-control", "no-store");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function hasChinese(value: string) {
  return /[\u3400-\u9fff]/u.test(value);
}

function parseTranslations(value: string, expectedIds: string[]): TranslationMap | null {
  const cleaned = value
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^```(?:json)?\s*|\s*```$/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  let payload: { translations?: Array<{ id?: unknown; title?: unknown; summary?: unknown }> };
  try {
    payload = JSON.parse(cleaned.slice(start, end + 1)) as typeof payload;
  } catch {
    return null;
  }

  const expected = new Set(expectedIds);
  const translations: TranslationMap = {};
  for (const item of payload.translations || []) {
    const id = String(item.id || "").trim();
    const title = String(item.title || "").replace(/\s+/g, " ").trim().slice(0, 120);
    const summary = String(item.summary || "").replace(/\s+/g, " ").trim().slice(0, 180);
    if (!expected.has(id) || !hasChinese(title) || !hasChinese(summary)) continue;
    translations[id] = { title, summary };
  }

  return Object.keys(translations).length === expected.size ? translations : null;
}

async function translationCacheKey(fields: Array<{ id: string; title: string; description: string }>) {
  const normalized = JSON.stringify(fields);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  const hash = Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
  return new Request(`https://cs2pro.internal/ai-news-zh-v4/${hash}`);
}

async function translateBatch(
  ai: AiBinding,
  cache: Cache,
  fields: Array<{ id: string; title: string; description: string }>,
  ctx: ExecutionContextLike,
): Promise<TranslationResult> {
  const cacheKey = await translationCacheKey(fields);
  const cached = await cache.match(cacheKey);
  if (cached) return { translations: await cached.json() as TranslationMap, status: "cached" };

  let generation = activeGenerations.get(cacheKey.url);
  if (!generation) {
    generation = (async () => {
      const result = await ai.run(MODEL, {
        messages: [
          {
            role: "system",
            content: "你是严谨的中文 Counter-Strike 2 新闻编辑。逐条把英文标题翻译成自然中文，并写一句准确的中文摘要。保留选手、战队、赛事、地图和比分等专有名词原文；不要补充原文没有的信息。必须覆盖输入中的每个 id，且只返回 JSON：{\"translations\":[{\"id\":\"原 id\",\"title\":\"中文标题\",\"summary\":\"最多 70 个汉字\"}]}。",
          },
          { role: "user", content: JSON.stringify(fields) },
        ],
        max_tokens: 1600,
        temperature: 0.1,
      });
      const translations = parseTranslations(generatedText(result), fields.map(field => field.id));
      if (!translations) return null;
      await cache.put(cacheKey, new Response(JSON.stringify(translations), {
        headers: { "content-type": "application/json", "cache-control": "public, max-age=2592000" },
      }));
      return translations;
    })().finally(() => activeGenerations.delete(cacheKey.url));
    activeGenerations.set(cacheKey.url, generation);
  }

  const guarded = generation.catch(() => null);
  ctx.waitUntil(guarded.then(() => undefined));

  let timeout: ReturnType<typeof setTimeout> | undefined;
  const fastResult = await Promise.race([
    guarded.then(translations => ({ completed: true as const, translations })),
    new Promise<{ completed: false; translations: null }>(resolve => {
      timeout = setTimeout(() => resolve({ completed: false, translations: null }), FAST_TIMEOUT_MS);
    }),
  ]);
  if (timeout) clearTimeout(timeout);
  if (!fastResult.completed) return { translations: {}, status: "warming" };
  if (!fastResult.translations) return { translations: {}, status: "unavailable" };
  return { translations: fastResult.translations, status: "generated" };
}

export async function translateNews(response: Response, ai: AiBinding | undefined, ctx: ExecutionContextLike) {
  if (!response.ok) return response;

  try {
    const payload = await response.clone().json() as NewsPayload;
    const englishSources = new Set(["HLTV", "Dust2.us"]);
    const fields = (payload.items || [])
      .filter(item => englishSources.has(item.source || ""))
      .map(item => ({
        item,
        id: item.id || "",
        title: item.title || "",
        description: (item.description || "").replace(/^(?:英文|原文)摘要：/, ""),
      }))
      .filter(field => field.id && field.title.trim() && field.description.trim());
    if (!fields.length) return responseWithStatus(response, "not-needed");
    if (!ai) return responseWithStatus(response, "binding-missing", `0/${fields.length}`, true);

    const cache = (caches as unknown as { default: Cache }).default;
    const batches = Array.from({ length: Math.ceil(fields.length / BATCH_SIZE) }, (_, index) =>
      fields.slice(index * BATCH_SIZE, (index + 1) * BATCH_SIZE));
    const results = await Promise.all(batches.map(batch => translateBatch(
      ai,
      cache,
      batch.map(({ id, title, description }) => ({ id, title, description })),
      ctx,
    )));
    const translations = Object.assign({}, ...results.map(result => result.translations)) as TranslationMap;

    let translatedCount = 0;
    fields.forEach(field => {
      const translated = translations[field.id];
      if (!translated) return;
      field.item.originalTitle ||= field.item.title;
      field.item.title = translated.title;
      field.item.description = `中文摘要：${translated.summary}`;
      field.item.aiTranslated = true;
      translatedCount += 1;
    });

    const complete = translatedCount === fields.length;
    const warming = results.some(result => result.status === "warming");
    const status = complete ? "translated" : translatedCount > 0 ? "partial" : warming ? "warming" : "unavailable";
    const headers = new Headers(response.headers);
    headers.set("content-type", "application/json; charset=utf-8");
    headers.set("x-ai-translation", status);
    headers.set("x-ai-summary", status);
    headers.set("x-ai-translation-coverage", `${translatedCount}/${fields.length}`);
    if (!complete) headers.set("cache-control", "no-store");
    return new Response(JSON.stringify(payload), { status: response.status, headers });
  } catch {
    return responseWithStatus(response, "error", "0/0", true);
  }
}
