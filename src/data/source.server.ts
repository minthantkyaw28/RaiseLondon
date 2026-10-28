import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import { fallbackDataset } from "./fallback";
import { rowsToDataset } from "./rows";
import type { Dataset } from "./types";

const PAGE = 1000; // The Data API returns at most 1000 rows per request.
const TIMEOUT_MS = 5000;

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

async function selectAll<T>(page: (from: number, to: number) => Page<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

function publicClient(url: string, key: string) {
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      // Opaque sb_ keys aren't JWTs: send only the apikey header, not a bearer.
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

/**
 * Reads investors, reviews and debriefs with the public (read-only) key. Never throws: if the
 * database can't be read, it logs why and returns the bundled mock data.
 */
export async function fetchDataset(): Promise<Dataset> {
  try {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) throw new Error("database URL or public key is not set");

    const db = publicClient(url, key);
    const signal = AbortSignal.timeout(TIMEOUT_MS);
    const [investors, reviews, debriefs] = await Promise.all([
      selectAll((from, to) =>
        db.from("investors").select("*").order("id").range(from, to).abortSignal(signal),
      ),
      selectAll((from, to) =>
        db.from("reviews").select("*").order("id").range(from, to).abortSignal(signal),
      ),
      selectAll((from, to) =>
        db.from("debriefs").select("*").order("id").range(from, to).abortSignal(signal),
      ),
    ]);
    if (investors.length === 0) throw new Error("investors table is empty");

    return rowsToDataset({ investors, reviews, debriefs });
  } catch (error) {
    console.error(
      "[dataset] Could not read the database, serving the bundled mock data instead:",
      error instanceof Error ? error.message : error,
    );
    return fallbackDataset;
  }
}
