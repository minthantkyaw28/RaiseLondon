import { createFileRoute } from "@tanstack/react-router";

import { dataset } from "@/data/source";
import { AGENT_CACHE_CONTROL, parseListQuery, renderInvestorList } from "@/lib/agent-markdown";

export const Route = createFileRoute("/index.md")({
  server: {
    handlers: {
      GET: ({ request }) =>
        new Response(
          renderInvestorList(dataset, parseListQuery(new URL(request.url).searchParams)),
          {
            headers: {
              "content-type": "text/markdown; charset=utf-8",
              "cache-control": AGENT_CACHE_CONTROL,
            },
          },
        ),
    },
  },
});
