import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { dedupeAndSortNews, parseRssXml, type NewsItem } from "./news-parser";

const SearchInputSchema = z.object({
  query: z.string().max(120).optional(),
});

export interface NewsSearchResult {
  items: NewsItem[];
  query: string;
  fetchedAt: string;
  error: string | null;
}

async function fetchRss(url: string, defaultSource: string): Promise<NewsItem[]> {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; RadarSLZ/1.0)",
      Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new Error(`Feed ${defaultSource} respondeu ${response.status}`);
  }
  const xml = await response.text();
  return parseRssXml(xml, defaultSource);
}

export const searchMaranhaoNews = createServerFn({ method: "GET" })
  .inputValidator((input: { query?: string } | undefined) => SearchInputSchema.parse(input ?? {}))
  .handler(async ({ data }): Promise<NewsSearchResult> => {
    const cleanQuery = (data.query ?? "").trim();
    const googleQuery = cleanQuery
      ? `("São Luís" OR "Maranhão") ${cleanQuery}`
      : `"São Luís" OR "Maranhão"`;
    const googleUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(googleQuery)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
    const g1Url = "https://g1.globo.com/rss/g1/ma/maranhao/";

    const [g1Result, googleResult] = await Promise.allSettled([
      fetchRss(g1Url, "G1 Maranhão"),
      fetchRss(googleUrl, "Google Notícias"),
    ]);

    const collected: NewsItem[] = [];

    if (g1Result.status === "fulfilled") {
      const normalizedTerm = cleanQuery
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      const filteredG1 = normalizedTerm
        ? g1Result.value.filter((item) => {
            const haystack = `${item.title} ${item.summary}`
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "");
            return haystack.includes(normalizedTerm);
          })
        : g1Result.value;
      collected.push(...filteredG1);
    }

    if (googleResult.status === "fulfilled") {
      collected.push(...googleResult.value);
    }

    const items = dedupeAndSortNews(collected).slice(0, 30);
    const allFailed = g1Result.status === "rejected" && googleResult.status === "rejected";

    return {
      items,
      query: cleanQuery,
      fetchedAt: new Date().toISOString(),
      error: allFailed ? "Não foi possível carregar as fontes de notícias agora. Tente atualizar." : null,
    };
  });