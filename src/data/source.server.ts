import { dataset as raise } from "@/lib/raise/dataset";
import type { Investor as RaiseInvestor } from "@/lib/raise/types";
import { withInferredSectors } from "@/lib/infer-sectors";

import { fromRaise } from "./from-raise";
import type { Dataset } from "./types";

// Min's scorer reads stages, sectors, cheques and activity. The long text fields are dropped so
// the rows add little to the home page payload.
const forScoring = (v: RaiseInvestor): RaiseInvestor => ({
  ...v,
  tagline: null,
  about: null,
  thesis: null,
  image: null,
  website: null,
  linkedin: null,
  dealroomUrl: null,
});

function build(): Dataset {
  const dataset = fromRaise(raise).dataset;
  const ids = new Set(dataset.investors.map((v) => v.id));
  const scoring = withInferredSectors(
    raise.investors.filter((v) => ids.has(v.uuid)),
    raise.deals,
    raise.companies ?? [],
  ).map(forScoring);
  return { ...dataset, scoring };
}

// Built once per server process. Server-only so the 2.4 MB export stays out of the browser bundle.
const real = build();

/** The real London investors from Min's bundled Dealroom export (src/lib/raise/dataset.json). */
export function fetchDataset(): Dataset {
  return real;
}
