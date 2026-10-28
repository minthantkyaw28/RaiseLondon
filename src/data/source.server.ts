import { dataset as raise } from "@/lib/raise/dataset";

import { fromRaise } from "./from-raise";
import type { Dataset } from "./types";

// Built once per server process. Server-only so the 2.4 MB export stays out of the browser bundle.
const real = fromRaise(raise).dataset;

/** The real London investors from Min's bundled Dealroom export (src/lib/raise/dataset.json). */
export function fetchDataset(): Dataset {
  return real;
}
