import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, ExternalLink, RefreshCw, Search, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { searchMaranhaoNews } from "@/lib/news.functions";
import { formatPostForCopy, formatRelativeTime, type NewsItem } from "@/lib/news-parser";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Radar SLZ — Notícias de São Luís e Maranhão" },
      {
        name: "description",
        content: "Pesquise notícias recentes e em alta de São Luís e do Maranhão e copie o texto pronto para sua página.",
      },
      { property: "og:title", content: "Radar SLZ — Notícias de São Luís e Maranhão" },
      {
        property: "og:description",
        content: "Pesquise notícias recentes e em alta de São Luís e do Maranhão e copie o texto pronto para sua página.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: () => searchMaranhaoNews({ data: { query: "" } }),
  component: Index,
});

function Index() {
  const initialFeed = Route.useLoaderData();
  const runSearch = useServerFn(searchMaranhaoNews);
  const [inputValue, setInputValue] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialFeed.items[0]?.id ?? null);
  const [draftText, setDraftText] = useState<string>(() =>
    initialFeed.items[0] ? formatPostForCopy(initialFeed.items[0]) : "",
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["maranhao-news", activeQuery],
    queryFn: () => runSearch({ data: { query: activeQuery } }),
    initialData: activeQuery === "" ? initialFeed : undefined,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const items = data?.items ?? [];
  const selectedItem: NewsItem | undefined =
    items.find((item) => item.id === selectedId) ?? items[0];

  useEffect(() => {
    if (!selectedItem) {
      setDraftText("");
      return;
    }
    setSelectedId(selectedItem.id);
    setDraftText(formatPostForCopy(selectedItem));
  }, [selectedItem?.id]);

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    const cleaned = inputValue.trim().slice(0, 120);
    setInputValue(cleaned);
    setActiveQuery(cleaned);
  }

  function handleClearSearch() {
    setInputValue("");
    setActiveQuery("");
  }

  function handleSelect(item: NewsItem) {
    setSelectedId(item.id);
    setDraftText(formatPostForCopy(item));
  }

  async function copyText(text: string, id: string) {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast.success("Copiado! Agora é só colar na sua página.");
      window.setTimeout(() => {
        setCopiedId((current) => (current === id ? null : current));
      }, 1800);
    } catch {
      toast.error("Não foi possível copiar automaticamente. Selecione o texto e copie.");
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Radar SLZ
            </h1>
            <p className="text-sm text-muted-foreground">
              Notícias de São Luís e Maranhão prontas para copiar e postar
            </p>
          </div>
          <form onSubmit={handleSearch} className="flex w-full items-center gap-2 sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Filtrar assunto (ex: trânsito, chuva, show)"
                maxLength={120}
                aria-label="Pesquisar notícias do Maranhão e São Luís"
                className="pr-8"
              />
              {inputValue && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  aria-label="Limpar busca"
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <Button type="submit" disabled={isFetching}>
              <Search className="size-4" />
              Buscar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => void refetch()}
              disabled={isFetching}
              aria-label="Atualizar notícias"
              title="Atualizar notícias"
            >
              <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </form>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <section aria-label="Lista de notícias">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {activeQuery
                ? `${items.length} notícias para "${activeQuery}" em São Luís e Maranhão`
                : `${items.length} notícias recentes em São Luís e Maranhão`}
            </span>
            {isFetching && <span>Atualizando...</span>}
          </div>

          {data?.error && (
            <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {data.error}
            </div>
          )}

          {items.length === 0 && !isFetching ? (
            <div className="rounded-md border border-border bg-card p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhuma notícia encontrada para essa busca.
              </p>
              {activeQuery && (
                <Button variant="outline" size="sm" onClick={handleClearSearch} className="mt-3">
                  Ver todas de São Luís e Maranhão
                </Button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-card">
              {items.map((item) => {
                const isSelected = selectedItem?.id === item.id;
                const isCopied = copiedId === item.id;
                return (
                  <li
                    key={item.id}
                    className={`p-4 transition-colors ${isSelected ? "bg-accent/50" : "hover:bg-muted/50"}`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <button
                        type="button"
                        onClick={() => handleSelect(item)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                          <span className="font-semibold text-primary">{item.source}</span>
                          <span>•</span>
                          <span>{formatRelativeTime(item.publishedAt, data?.fetchedAt)}</span>
                        </div>
                        <h2 className="font-display text-lg leading-snug font-semibold text-foreground">
                          {item.title}
                        </h2>
                        {item.summary && (
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {item.summary}
                          </p>
                        )}
                      </button>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={isCopied ? "secondary" : "default"}
                          onClick={() => void copyText(formatPostForCopy(item), item.id)}
                        >
                          {isCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                          {isCopied ? "Copiado" : "Copiar"}
                        </Button>
                        <Button asChild size="icon" variant="ghost" title="Abrir matéria original">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Abrir matéria original: ${item.title}`}
                          >
                            <ExternalLink className="size-4" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside
          aria-label="Texto pronto para postar"
          className="rounded-md border border-border bg-card p-4 lg:sticky lg:top-4"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">Pronto para postar</h2>
            <span className="text-xs text-muted-foreground">{draftText.length} caracteres</span>
          </div>
          <Textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            rows={12}
            placeholder="Clique em uma notícia para carregar o texto pronto..."
            aria-label="Texto pronto para copiar e postar"
            className="resize-y text-sm leading-relaxed"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              className="flex-1"
              disabled={!draftText.trim()}
              onClick={() => void copyText(draftText, "draft")}
            >
              {copiedId === "draft" ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copiedId === "draft" ? "Texto copiado" : "Copiar texto"}
            </Button>
            {selectedItem && (
              <Button asChild variant="outline" size="sm">
                <a href={selectedItem.url} target="_blank" rel="noopener noreferrer">
                  Fonte
                  <ExternalLink className="size-3.5" />
                </a>
              </Button>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
