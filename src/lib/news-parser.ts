export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishedAt: string | null;
  url: string;
}

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

function decodeEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&(?:amp|lt|gt|quot|#39|apos|nbsp);/g, (entity) => HTML_ENTITIES[entity] ?? entity);
}

function stripHtml(input: string): string {
  return decodeEntities(input)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(block: string, tag: string): string {
  const pattern = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = block.match(pattern);
  return match?.[1]?.trim() ?? "";
}

const IGNORED_SOURCES = new Set(["instagram", "facebook", "tiktok", "x", "twitter"]);

function normalizeTitleKey(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 64);
}

export function parseRssXml(xml: string, defaultSource: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemMatches = xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi);

  for (const match of itemMatches) {
    const block = match[1] ?? "";
    const rawTitle = stripHtml(extractTag(block, "title"));
    const rawLink = decodeEntities(extractTag(block, "link")).trim();
    if (!rawTitle || !rawLink) continue;

    const rawSource = stripHtml(extractTag(block, "source"));
    let title = rawTitle;
    let source = rawSource || defaultSource;

    if (rawSource && rawTitle.endsWith(` - ${rawSource}`)) {
      title = rawTitle.slice(0, -(` - ${rawSource}`).length).trim();
    } else if (!rawSource && defaultSource === "Google Notícias") {
      const sepIndex = rawTitle.lastIndexOf(" - ");
      if (sepIndex > 15) {
        title = rawTitle.slice(0, sepIndex).trim();
        source = rawTitle.slice(sepIndex + 3).trim() || defaultSource;
      }
    }
    title = title.replace(/\s*\($/, "").trim();
    if (!title || IGNORED_SOURCES.has(source.toLowerCase())) continue;

    const subtitle = stripHtml(extractTag(block, "atom:subtitle"));
    const description = stripHtml(extractTag(block, "description"));
    let summary = subtitle || description;
    if (summary && (summary === rawTitle || summary.startsWith(title))) {
      summary = "";
    }
    if (summary.length > 260) {
      summary = `${summary.slice(0, 257).trimEnd()}...`;
    }

    const pubDateRaw = stripHtml(extractTag(block, "pubDate"));
    const parsedDate = pubDateRaw ? Date.parse(pubDateRaw) : Number.NaN;
    const publishedAt = Number.isNaN(parsedDate) ? null : new Date(parsedDate).toISOString();

    items.push({
      id: `${normalizeTitleKey(title)}-${items.length}`,
      title,
      summary,
      source,
      publishedAt,
      url: rawLink,
    });
  }

  return items;
}

export function dedupeAndSortNews(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  const unique: NewsItem[] = [];

  const sorted = [...items].sort((a, b) => {
    const timeA = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const timeB = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return timeB - timeA;
  });

  for (const item of sorted) {
    const key = normalizeTitleKey(item.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  return unique;
}

export function formatPostForCopy(item: NewsItem): string {
  const lines: string[] = [item.title];
  if (item.summary) {
    lines.push("", item.summary);
  }
  lines.push("", `Fonte: ${item.source}`);
  if (item.url && !item.url.startsWith("https://news.google.com/")) {
    lines.push(`Leia mais: ${item.url}`);
  }
  lines.push("", "#SãoLuís #Maranhão #NotíciasMA");
  return lines.join("\n");
}

export function formatRelativeTime(isoDate: string | null, referenceIso?: string): string {
  if (!isoDate) return "Recente";
  const refTime = referenceIso ? Date.parse(referenceIso) : Date.now();
  const diffMs = refTime - Date.parse(isoDate);
  if (Number.isNaN(diffMs) || diffMs < 0) return "Agora";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Agora";
  if (minutes < 60) return `Há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Há ${hours}h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Ontem" : `Há ${days} dias`;
}