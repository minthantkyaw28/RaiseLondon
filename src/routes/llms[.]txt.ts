import { createFileRoute } from "@tanstack/react-router";

import { AGENT_CACHE_CONTROL, renderLlmsTxt } from "@/lib/agent-markdown";

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: async () => {
        const { fetchDataset } = await import("@/data/source.server");
        return new Response(renderLlmsTxt(await fetchDataset()), {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": AGENT_CACHE_CONTROL,
          },
        });
      },
    },
  },
});
