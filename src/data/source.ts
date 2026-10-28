import { getRouteApi } from "@tanstack/react-router";

import { fallbackDataset } from "./fallback";
import { getDataset } from "./source.functions";
import type { Dataset } from "./types";

export { fallbackDataset };

/**
 * The directory (investors, reviews, debriefs) from the database. Falls back to the bundled
 * mock JSON when the database or the server can't be reached; the server logs the reason.
 */
export async function loadDataset(): Promise<Dataset> {
  try {
    return await getDataset();
  } catch (error) {
    console.error("[dataset] Could not load the directory, using bundled data:", error);
    return fallbackDataset;
  }
}

const homeRoute = getRouteApi("/");

/** The dataset loaded by the home page. Use inside components rendered on "/". */
export function useDataset(): Dataset {
  return homeRoute.useLoaderData();
}
