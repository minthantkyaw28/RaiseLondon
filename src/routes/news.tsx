import { createFileRoute } from "@tanstack/react-router";

import { Shell } from "@/components/raise/shell";
import { useRaiseData } from "@/components/raise/use-raise-data";
import { formatMoney, stripHtml } from "@/lib/raise/format";

export const Route = createFileRoute("/news")({
  component: NewsPage,
});

function NewsPage() {
  const { dataset } = useRaiseData();
  const articles = [...dataset.news].sort((a, b) =>
    String(b.publishedAt ?? "").localeCompare(String(a.publishedAt ?? "")),
  );

  return (
    <Shell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">News</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Recent venture rounds from Dealroom. Articles that mention someone in this cohort are
            listed with the others from the United Kingdom.
          </p>
        </div>
        <ul className="space-y-4">
          {articles.map((article) => (
            <li key={article.id} className="rounded-xl border p-4">
              <h2 className="font-medium">
                {article.url ? (
                  <a className="hover:underline" href={article.url}>
                    {article.title}
                  </a>
                ) : (
                  article.title
                )}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {article.publishedAt ? article.publishedAt.slice(0, 10) : "Date unknown"}
                {article.hqCountry ? ` · ${article.hqCountry}` : ""}
                {article.amount != null
                  ? ` · ${formatMoney(article.amount, dataset.currency)}`
                  : ""}
              </p>
              {article.summary ? (
                <p className="mt-2 text-sm">{stripHtml(article.summary)}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </Shell>
  );
}
