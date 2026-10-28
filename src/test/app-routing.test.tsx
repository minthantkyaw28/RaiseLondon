import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("matches the investor, match, news, and intro pages", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    expect(router.matchRoutes("/investors").at(-1)?.pathname).toBe("/investors/");
    expect(router.matchRoutes("/match").at(-1)?.pathname).toBe("/match");
    expect(router.matchRoutes("/news").at(-1)?.pathname).toBe("/news");
    expect(router.matchRoutes("/intros").at(-1)?.pathname).toBe("/intros");
  });
});
