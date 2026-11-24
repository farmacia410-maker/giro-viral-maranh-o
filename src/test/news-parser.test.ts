import { describe, expect, it } from "vitest";
import { dedupeAndSortNews, formatPostForCopy, parseRssXml } from "@/lib/news-parser";

describe("news-parser", () => {
  it("parses Google News and G1 Maranhão RSS items cleanly", () => {
    const xml = `
      <rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
        <channel>
          <item>
            <title>Chuva forte alaga avenidas em São Luís - Portal MA</title>
            <link>https://example.com/chuva-slz</link>
            <pubDate>Tue, 24 Nov 2026 15:00:00 GMT</pubDate>
            <source>Portal MA</source>
            <description>&lt;a href="https://example.com"&gt;Chuva forte alaga avenidas em São Luís&lt;/a&gt;</description>
          </item>
          <item>
            <title><![CDATA[Mostra gratuita de cinema em São Luís]]></title>
            <atom:subtitle>Evento acontece na UFMA com entrada franca.</atom:subtitle>
            <link>https://g1.globo.com/ma/maranhao/noticia/cinema.ghtml</link>
            <pubDate>Tue, 24 Nov 2026 16:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>
    `;

    const items = parseRssXml(xml, "G1 Maranhão");
    expect(items).toHaveLength(2);
    expect(items[0]?.title).toBe("Chuva forte alaga avenidas em São Luís");
    expect(items[0]?.source).toBe("Portal MA");
    expect(items[0]?.summary).toBe("");
    expect(items[1]?.title).toBe("Mostra gratuita de cinema em São Luís");
    expect(items[1]?.summary).toBe("Evento acontece na UFMA com entrada franca.");
    expect(items[1]?.source).toBe("G1 Maranhão");
  });

  it("deduplicates repeated headlines and sorts newest first", () => {
    const sorted = dedupeAndSortNews([
      {
        id: "1",
        title: "Ponte do São Francisco tem trânsito lento",
        summary: "",
        source: "G1 Maranhão",
        publishedAt: "2026-11-24T12:00:00.000Z",
        url: "https://example.com/1",
      },
      {
        id: "2",
        title: "Ponte do Sao Francisco tem transito lento!",
        summary: "",
        source: "Outro Portal",
        publishedAt: "2026-11-24T14:00:00.000Z",
        url: "https://example.com/2",
      },
      {
        id: "3",
        title: "Festival de reggae movimenta o Centro Histórico",
        summary: "",
        source: "G1 Maranhão",
        publishedAt: "2026-11-24T15:30:00.000Z",
        url: "https://example.com/3",
      },
    ]);

    expect(sorted).toHaveLength(2);
    expect(sorted[0]?.id).toBe("3");
    expect(sorted[1]?.id).toBe("2");
  });

  it("formats a ready-to-paste post with source, link and Maranhão hashtags", () => {
    const post = formatPostForCopy({
      id: "1",
      title: "Ferry-boat amplia horários para o fim de semana",
      summary: "Viagens extras saem da Ponta da Espera a partir de sexta.",
      source: "G1 Maranhão",
      publishedAt: "2026-11-24T15:00:00.000Z",
      url: "https://g1.globo.com/ma/ferry",
    });

    expect(post).toContain("Ferry-boat amplia horários para o fim de semana");
    expect(post).toContain("Viagens extras saem da Ponta da Espera a partir de sexta.");
    expect(post).toContain("Fonte: G1 Maranhão");
    expect(post).toContain("Leia mais: https://g1.globo.com/ma/ferry");
    expect(post).toContain("#SãoLuís #Maranhão");
  });

  it("omits long Google News redirect URLs from copied posts and skips social spam", () => {
    const post = formatPostForCopy({
      id: "2",
      title: "Inverno no Maranhão: previsão do período chuvoso",
      summary: "",
      source: "O Imparcial",
      publishedAt: "2026-11-24T15:00:00.000Z",
      url: "https://news.google.com/rss/articles/CBMiLONGTOKEN",
    });

    expect(post).toContain("Fonte: O Imparcial");
    expect(post).not.toContain("news.google.com");

    const xml = `
      <rss version="2.0"><channel>
        <item>
          <title>Assine nossa newsletter - Instagram</title>
          <link>https://news.google.com/rss/articles/123</link>
          <source>Instagram</source>
        </item>
        <item>
          <title>Manutenção no sistema Italuís suspende água ( - G1</title>
          <link>https://news.google.com/rss/articles/456</link>
          <source>G1</source>
        </item>
      </channel></rss>
    `;
    const items = parseRssXml(xml, "Google Notícias");
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("Manutenção no sistema Italuís suspende água");
  });
});