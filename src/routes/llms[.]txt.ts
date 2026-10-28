import { createFileRoute } from "@tanstack/react-router";

import { dataset } from "@/data/source";
import { AGENT_CACHE_CONTROL, renderLlmsTxt } from "@/lib/agent-markdown";

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(renderLlmsTxt(dataset), {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": AGENT_CACHE_CONTROL,
          },
        }),
    },
  },
});
