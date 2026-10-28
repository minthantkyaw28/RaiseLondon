import type { Dataset } from "./types";
import mock from "./investors.mock.json";

// Swap this import for the Dealroom export once it lands; the UI only reads `dataset`.
export const dataset = mock as Dataset;
