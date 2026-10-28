import { createServerFn } from "@tanstack/react-start";

import { fetchDataset } from "./source.server";

// Public read-only: the same data anyone can already see on the map.
export const getDataset = createServerFn({ method: "GET" }).handler(() => fetchDataset());
