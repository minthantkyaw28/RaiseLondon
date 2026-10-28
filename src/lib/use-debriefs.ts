import { useEffect, useState } from "react";

import type { Debrief } from "@/data/types";

const DEBRIEFS_KEY = "raise-debriefs";

export function useDebriefs() {
  const [debriefs, setDebriefs] = useState<Debrief[]>([]);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DEBRIEFS_KEY);
      if (raw) setDebriefs(JSON.parse(raw));
    } catch {
      // Storage can be blocked (private mode); debriefs just won't persist.
    }
  }, []);
  const addDebrief = (debrief: Debrief) => {
    setDebriefs((prev) => {
      const next = [...prev, debrief];
      try {
        window.localStorage.setItem(DEBRIEFS_KEY, JSON.stringify(next));
      } catch {
        // See above.
      }
      return next;
    });
  };
  return [debriefs, addDebrief] as const;
}
