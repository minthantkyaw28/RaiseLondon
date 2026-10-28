import { describe, expect, it } from "vitest";

import { matchIntros, normalizeLinkedin, parseConnectionsCsv } from "./intros";
import type { Person } from "./types";

function person(overrides: Partial<Person> & Pick<Person, "id" | "name" | "investorUuid">): Person {
  return {
    personUuid: null,
    role: null,
    linkedin: null,
    image: null,
    ...overrides,
  };
}

describe("linkedin intro matching", () => {
  const people = [
    person({
      id: "p1",
      investorUuid: "inv-1",
      name: "Ada Lovelace",
      linkedin: "https://www.linkedin.com/in/ada-lovelace/",
    }),
    person({ id: "p2", investorUuid: "inv-2", name: "Sam Lee", linkedin: null }),
    person({ id: "p3", investorUuid: "inv-3", name: "Sam Lee", linkedin: null }),
    person({ id: "p4", investorUuid: "inv-4", name: "Grace Hopper", linkedin: null }),
  ];

  it("normalizes linkedin hosts and trailing slashes", () => {
    expect(normalizeLinkedin("HTTP://LinkedIn.com/in/Ada-Lovelace/")).toBe(
      "linkedin.com/in/ada-lovelace",
    );
  });

  it("matches a LinkedIn export by URL before name, and skips ambiguous names", () => {
    const csv = [
      "First Name,Last Name,URL,Email Address,Company,Position,Connected On",
      "Ada,Lovelace,http://linkedin.com/in/ada-lovelace,ada@example.com,Engines,Partner,01 Jan 2024",
      "Sam,Lee,,sam@example.com,Somewhere,Founder,01 Jan 2024",
      "Grace,Hopper,,grace@example.com,Navy,Admiral,01 Jan 2024",
    ].join("\n");
    const matches = matchIntros(parseConnectionsCsv(csv), people);
    expect(matches.map((match) => [match.person.id, match.via])).toEqual([
      ["p1", "linkedin"],
      ["p4", "name"],
    ]);
  });
});
