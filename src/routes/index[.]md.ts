import { createFileRoute } from "@tanstack/react-router";

import { AGENT_CACHE_CONTROL, parseListQuery, renderInvestorList } from "@/lib/agent-markdown";

export const Route = createFileRoute("/index.md")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { fetchDataset } = await import("@/data/source.server");
        const dataset = await fetchDataset();
        return new Response(
          renderInvestorList(dataset, parseListQuery(new URL(request.url).searchParams)),
          {
            headers: {
              "content-type": "text/markdown; charset=utf-8",
              "cache-control": AGENT_CACHE_CONTROL,
            },
          },
        );
      },
    },
  },
});
