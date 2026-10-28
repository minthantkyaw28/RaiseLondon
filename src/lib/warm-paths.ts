import type { Contact, Investor } from "@/data/types";

export interface WarmPath {
  partnerId: string;
  partnerName: string;
  via: Contact[];
}

// A path is: you -> contact (-> contact) -> partner. Shorter paths sort first.
export function findWarmPaths(investor: Investor, contacts: Contact[], maxHops = 2): WarmPath[] {
  const byId = new Map(contacts.map((c) => [c.id, c]));
  const paths: WarmPath[] = [];

  for (const partner of investor.partners) {
    for (const first of contacts) {
      if (first.knows.includes(partner.id)) {
        paths.push({ partnerId: partner.id, partnerName: partner.name, via: [first] });
        continue;
      }
      if (maxHops < 2) continue;
      for (const knownId of first.knows) {
        const second = byId.get(knownId);
        if (second && second.id !== first.id && second.knows.includes(partner.id)) {
          paths.push({ partnerId: partner.id, partnerName: partner.name, via: [first, second] });
        }
      }
    }
  }
  return paths.sort((a, b) => a.via.length - b.via.length);
}
