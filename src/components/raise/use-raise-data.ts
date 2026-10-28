import { useEffect, useState } from "react";

import { dataset as bundled } from "@/lib/raise/dataset";
import { loadRaiseData } from "@/lib/raise/load";
import type { Dataset } from "@/lib/raise/types";

export function useRaiseData() {
  const [dataset, setDataset] = useState<Dataset>(bundled);
  const [source, setSource] = useState<"bundle" | "supabase">("bundle");

  useEffect(() => {
    let cancelled = false;
    void loadRaiseData().then((result) => {
      if (cancelled) return;
      setDataset(result.dataset);
      setSource(result.source);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { dataset, source };
}
