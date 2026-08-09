import { NextResponse } from "next/server";
import { topTeams } from "../../data/tracked-players";

/* eslint-disable @typescript-eslint/no-explicit-any -- Chinese news sources use different public payloads. */

export const runtime = "edge";

const FIVE_E_API = "https://csgo.5eplay.com/api/article?page=1&type_id=0&time=0&order_by=0";
const HLTV_RSS = "https://www.hltv.org/rss/news";
const DUST2_RSS = "https://www.dust2.us/rss";
const FRESH_MS = 12 * 60 * 60_000;
const STALE_MS = 3 * 24 * 60 * 60_000;
const CACHE_CONTROL = "public, max-age=43200, s-maxage=43200, stale-while-revalidate=86400";

type ContentType = "esports" | "roster" | "interview" | "official";
type NewsCache = { value: any; expiresAt: number; staleUntil: number };
type NewsResult = { body: any; status: number };
const newsGlobal = globalThis as typeof globalThis & {
  __cs2ChineseNewsCacheV16?: NewsCache;
  __cs2NewsInflightV2?: Promise<NewsResult>;
};

function newsResponse(result: NewsResult) {
  return NextResponse.json(result.body, {
    status: result.status,
    headers: result.status === 200 ? { "Cache-Control": CACHE_CONTROL } : undefined,
  });
}

const CS_ENTITY_TOKENS = [
  ...topTeams.flatMap(team => [team.name, ...team.members.flatMap(player => [player.display, player.lookup])]),
  "navi", "s1mple", "device", "cadiaN", "Jame", "chopper", "Magisk", "degster", "broky", "FaZe",
  "Heroic", "PARIVISION", "FL1T", "dastan", "BanKs", "xiELO", "BC.Game", "Gentle Mates",
].map(value => value.toLowerCase()).filter(value => value.length >= 3);

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  esports: "职业资讯",
  roster: "阵容变动",
  interview: "采访与直播",
  official: "游戏更新",
};

const PROMOTIONAL_PATTERN = /(广告|推广|赞助商|合作伙伴|限时|优惠|折扣|促销|抽奖|竞猜|博彩|投注|赔率|返现|注册送|开户|饰品交易|皮肤交易|代练|陪玩|sponsored|sponsor|partnership|partner(?:ed)? with|giveaway|promo code|discount|betting|odds|casino|skin marketplace)/i;

function decode(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function excerpt(value = "", maxLength = 180) {
  const text = decode(value);
  return text.length <= maxLength ? text : `${text.slice(0, maxLength).trim()}…`;
}

function classifyContentType(title: string): ContentType {
  if (/(更新|补丁|版本|热修|武库|游戏公告|\bupdate\b|patch|release notes)/i.test(title)) return "official";
  if (/(加盟|离队|下放|替补|签约|阵容|转会|租借|官宣|重组|\bsign(?:s|ed)?\b|bench|transfer|roster|part ways|leave cs)/i.test(title)) return "roster";
  if (/(专访|采访|直播|回应|表示|谈到|谈及|锐评|播客|透露|直言|\b谈\b|interview|podcast|\bsays\b|\btalks\b|:\s*["“])/i.test(title)) return "interview";
  return "esports";
}

function isCounterStrikeArticle(title: string) {
  if (/(无畏契约|VALORANT|\bVCT\b|\bSEN\b|\bJohnqt\b|\bEwok\b|\bcortezia\b|\bf4ngeer\b)/i.test(title)) return false;
  const lowered = title.toLowerCase();
  if (/(cs2|csgo|counter-strike|faceit|hltv|blast|\biem\b|\bmajor\b|5epl)/i.test(title)) return true;
  return CS_ENTITY_TOKENS.some(token => lowered.includes(token));
}

async function fetchSource(url: string, accept: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept,
        "accept-language": "zh-CN,zh;q=0.9",
        "user-agent": "Mozilla/5.0 (compatible; CS2ProTracker/1.0)",
      },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

function imageUrl(value: unknown, depth = 0): string | null {
  if (depth > 3 || value == null) return null;
  if (typeof value === "string") {
    const text = value.trim().replace(/\\\//g, "/");
    if (!text) return null;
    if ((text.startsWith("{") || text.startsWith("["))) {
      try { return imageUrl(JSON.parse(text), depth + 1); } catch { return null; }
    }
    if (text.startsWith("//")) return `https:${text}`;
    if (/^https?:\/\//i.test(text)) return text;
    if (/^\/[^/]/.test(text)) return new URL(text, "https://csgo.5eplay.com/").toString();
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = imageUrl(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["url", "src", "original", "large", "middle", "small", "image", "img", "path"]) {
      const found = imageUrl(record[key], depth + 1);
      if (found) return found;
    }
    for (const child of Object.values(record)) {
      const found = imageUrl(child, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function imageFrom(row: any) {
  for (const key of ["images", "cover", "cover_url", "cover_image", "thumb", "thumbnail", "image", "img"]) {
    const found = imageUrl(row?.[key]);
    if (found) return found;
  }
  return null;
}

async function getFiveE() {
  const payload = await (await fetchSource(FIVE_E_API, "application/json,text/plain,*/*")).json() as any;
  const rows = Array.isArray(payload?.data?.list) ? payload.data.list : [];
  return rows.flatMap((row: any, index: number) => {
    const title = decode(row?.title || "");
    const published = Number(row?.dateline);
    const rawLink = typeof row?.jump_link === "string" ? row.jump_link : "";
    if (!title || !published || !rawLink || !isCounterStrikeArticle(title)) return [];
    const contentType = classifyContentType(title);
    return [{
      id: `5e-${row?.id || published || index}`,
      title,
      originalTitle: title,
      description: excerpt(row?.description || row?.summary || row?.intro || ""),
      publishedAt: new Date(published * 1000).toISOString(),
      source: "5EPlay",
      sourceUrl: new URL(rawLink, "https://csgo.5eplay.com/").toString(),
      image: imageFrom(row),
      contentType,
      category: CONTENT_TYPE_LABELS[contentType],
    }];
  });
}

function xmlValue(block: string, tag: string) {
  const escaped = tag.replace(":", "\\:");
  return decode(block.match(new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "i"))?.[1] || "");
}

async function getHltv() {
  const xml = await (await fetchSource(HLTV_RSS, "application/rss+xml,application/xml,text/xml,*/*")).text();
  const entries = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
  return entries.flatMap((entry, index) => {
    const title = xmlValue(entry, "title");
    const description = excerpt(xmlValue(entry, "description"), 170);
    const sourceUrl = xmlValue(entry, "link");
    const publishedAt = xmlValue(entry, "pubDate");
    if (!title || !sourceUrl || !publishedAt || !isCounterStrikeArticle(`${title} ${description}`)) return [];
    const image = entry.match(/<media:content[^>]+url=["']([^"']+)["']/i)?.[1]?.replace(/&amp;/g, "&") || null;
    return [{
      id: `hltv-${xmlValue(entry, "guid") || index}`,
      title,
      originalTitle: title,
      description: description ? `原文摘要：${description}` : "HLTV 发布的 Counter-Strike 职业赛事资讯。",
      publishedAt: new Date(publishedAt).toISOString(),
      source: "HLTV",
      sourceUrl,
      image,
      contentType: classifyContentType(title),
      category: CONTENT_TYPE_LABELS[classifyContentType(title)],
    }];
  });
}

async function getDust2() {
  const xml = await (await fetchSource(DUST2_RSS, "application/rss+xml,application/xml,text/xml,*/*")).text();
  const entries = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
  return entries.slice(0, 12).flatMap((entry, index) => {
    const title = xmlValue(entry, "title");
    const description = excerpt(xmlValue(entry, "description"), 170);
    const sourceUrl = xmlValue(entry, "link");
    const publishedAt = xmlValue(entry, "pubDate");
    if (!title || !sourceUrl || !publishedAt) return [];
    return [{
      id: `dust2-${xmlValue(entry, "guid") || index}`,
      title,
      originalTitle: title,
      description: description ? `原文摘要：${description}` : "Dust2.us 发布的北美 Counter-Strike 职业资讯。",
      publishedAt: new Date(publishedAt).toISOString(),
      source: "Dust2.us",
      sourceUrl,
      image: "https://www.dust2.us/dust2/img/static/dust2logo.png",
      contentType: classifyContentType(title),
      category: CONTENT_TYPE_LABELS[classifyContentType(title)],
    }];
  });
}

function seededJitter(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function qualityScore(item: any, now: number, daySeed: string) {
  const sourceWeight: Record<string, number> = {
    HLTV: 34,
    "Dust2.us": 30,
    "5EPlay": 27,
  };
  const ageDays = Math.max(0, (now - new Date(item.publishedAt).getTime()) / 86_400_000);
  const text = `${item.title} ${item.description}`;
  let score = sourceWeight[item.source] || 15;
  score += Math.max(0, 14 - ageDays * 1.2);
  if (item.image) score += 4;
  if ((item.description || "").length >= 45) score += 3;
  if (/(专访|采访|阵容|转会|签约|离队|更新|补丁|record|interview|sign|bench|transfer|roster|analysis)/i.test(text)) score += 10;
  if (CS_ENTITY_TOKENS.some(token => text.toLowerCase().includes(token))) score += 5;
  return score + seededJitter(`${daySeed}:${item.id}`) * 7;
}

function balanceTopSources(ranked: any[]) {
  const lead = ranked[0];
  const chinesePicks = ["5EPlay"]
    .map(source => ranked.find(item => item.source === source))
    .filter(Boolean);
  const priority = [lead, ...chinesePicks].filter((item, index, list) => item && list.findIndex(candidate => candidate.id === item.id) === index);
  const priorityIds = new Set(priority.map(item => item.id));
  const top: any[] = [...priority];
  const rest: any[] = [];
  const counts = new Map<string, number>();
  priority.forEach(item => counts.set(item.source, (counts.get(item.source) || 0) + 1));
  for (const item of ranked) {
    if (priorityIds.has(item.id)) continue;
    const count = counts.get(item.source) || 0;
    if (top.length < 12 && count < 3) {
      top.push(item);
      counts.set(item.source, count + 1);
    } else {
      rest.push(item);
    }
  }
  return [...top, ...rest];
}

function responseBody(items: any[], sourceStatus: Array<{ source: string; ok: boolean }>, warning: string | null) {
  return {
    items,
    sources: [...new Set(items.map(item => item.source))],
    sourceStatus,
    warning,
    error: items.length ? null : "资讯源暂时无法访问",
    updatedAt: new Date().toISOString(),
  };
}

export async function GET() {
  const now = Date.now();
  const cached = newsGlobal.__cs2ChineseNewsCacheV16;
  if (cached && cached.expiresAt > now) {
    return NextResponse.json(cached.value, { headers: { "Cache-Control": CACHE_CONTROL } });
  }

  if (newsGlobal.__cs2NewsInflightV2) return newsResponse(await newsGlobal.__cs2NewsInflightV2);
  const pending = (async () => {
    const results = await Promise.allSettled([getFiveE(), getHltv(), getDust2()]);
    const names = ["5EPlay", "HLTV", "Dust2.us"];
    const sourceStatus = results.map((result, index) => ({ source: names[index], ok: result.status === "fulfilled" && result.value.length > 0 }));
    const cutoff = now - 30 * 24 * 60 * 60_000;
    const daySeed = new Date(now).toISOString().slice(0, 10);
    const seen = new Set<string>();
    const ranked = results.flatMap(result => result.status === "fulfilled" ? result.value : [])
      .filter(item => {
        const time = new Date(item.publishedAt).getTime();
        if (!Number.isFinite(time) || time < cutoff || time > now + 24 * 60 * 60_000) return false;
        if (PROMOTIONAL_PATTERN.test(`${item.title} ${item.description}`)) return false;
        const key = item.title.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => qualityScore(b, now, daySeed) - qualityScore(a, now, daySeed));
    const items = balanceTopSources(ranked).slice(0, 42);

    if (items.length) {
      const failed = sourceStatus.filter(source => !source.ok).map(source => source.source);
      const value = responseBody(items, sourceStatus, failed.length ? `${failed.join("、")} 暂未更新` : null);
      newsGlobal.__cs2ChineseNewsCacheV16 = { value, expiresAt: now + FRESH_MS, staleUntil: now + STALE_MS };
      return { body: value, status: 200 };
    }

    if (cached && cached.staleUntil > now) {
      return { body: { ...cached.value, warning: "当前显示最近一次成功更新的资讯" }, status: 200 };
    }
    return { body: responseBody([], sourceStatus, null), status: 502 };
  })();
  newsGlobal.__cs2NewsInflightV2 = pending;
  try {
    return newsResponse(await pending);
  } finally {
    if (newsGlobal.__cs2NewsInflightV2 === pending) newsGlobal.__cs2NewsInflightV2 = undefined;
  }
}
