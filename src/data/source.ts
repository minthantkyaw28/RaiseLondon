import { getRouteApi } from "@tanstack/react-router";

import { getDataset } from "./source.functions";
import type { Dataset } from "./types";

/** The directory the home page shows: real London investors from the Dealroom export. */
export function loadDataset(): Promise<Dataset> {
  return getDataset();
}

const homeRoute = getRouteApi("/");

/** The dataset loaded by the home page. Use inside components rendered on "/". */
export function useDataset(): Dataset {
  return homeRoute.useLoaderData();
}
