import { describe, expect, it } from "vitest";

import type { Investor } from "@/data/types";

import { draftIntroEmail } from "./intro-email";
import type { PitchProfile } from "./pitch-profile";

const investor = {
  id: "i1",
  name: "Northfield Ventures",
  partners: [{ id: "p1", name: "Sam Okafor", title: "Partner", focus: [] }],
} as unknown as Investor;

const profile: PitchProfile = {
  sectors: ["fintech"],
  stage: "pre-seed",
  companyStatus: "waitlist",
  raiseGbp: 750_000,
  founders: "co-founders",
  technicalFounder: true,
} as PitchProfile;

describe("draftIntroEmail", () => {
  it("greets a partner by first name and names the round", () => {
    const { subject, body } = draftIntroEmail(investor, profile, "We build payments agents.", [
      "Invests at pre-seed",
    ]);
    expect(subject).toContain("Fintech");
    expect(subject).toContain("Pre-seed");
    expect(body.startsWith("Hi Sam,")).toBe(true);
    expect(body).toContain("invests at pre-seed");
    expect(body).toContain("We build payments agents.");
  });

  it("falls back to the firm name when no partner is known", () => {
    const { body } = draftIntroEmail({ ...investor, partners: [] }, profile, "Pitch", []);
    expect(body.startsWith("Hi Northfield Ventures team,")).toBe(true);
  });

  it("writes the round as a sentence", () => {
    const { body } = draftIntroEmail(investor, profile, "Pitch", []);
    expect(body).toContain("We're raising a £750k pre-seed round.");
  });

  it("leaves estimated cheque sizes out of the email", () => {
    const { body } = draftIntroEmail(investor, profile, "Pitch", [
      "Invests at pre-seed",
      "£750k fits their £250k–£2m (typical, not stated) cheque",
    ]);
    expect(body).toContain("invests at pre-seed");
    expect(body).not.toContain("£250k–£2m");
  });

  it("shortens a long pitch", () => {
    const { body } = draftIntroEmail(investor, profile, "word ".repeat(200), []);
    expect(body).toContain("...");
  });
});
