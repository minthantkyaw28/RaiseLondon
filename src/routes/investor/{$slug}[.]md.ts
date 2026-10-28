import { createFileRoute } from "@tanstack/react-router";

import { dataset } from "@/data/source";
import {
  AGENT_CACHE_CONTROL,
  renderInvestorNotFound,
  renderInvestorPage,
} from "@/lib/agent-markdown";

export const Route = createFileRoute("/investor/{$slug}.md")({
  server: {
    handlers: {
      GET: ({ params }) => {
        const page = renderInvestorPage(dataset, params.slug);
        return new Response(page ?? renderInvestorNotFound(params.slug), {
          status: page ? 200 : 404,
          headers: {
            "content-type": "text/markdown; charset=utf-8",
            "cache-control": AGENT_CACHE_CONTROL,
          },
        });
      },
    },
  },
});
