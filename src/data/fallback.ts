import type { Dataset } from "./types";
import mock from "./investors.mock.json";

// Bundled copy of the seed data. Served whenever the database can't be read, so the demo never breaks.
export const fallbackDataset = mock as Dataset;
