import type { Investor } from "@/data/types";
import { SECTOR_LABEL, STAGE_LABEL } from "@/lib/labels";
import { formatGbp } from "@/lib/match";
import type { PitchProfile } from "@/lib/pitch-profile";

// A first draft built only from the founder's own pitch and the match reasons: no model call,
// nothing sent anywhere. The founder edits and sends it themselves.
function roundSentence(profile: PitchProfile): string {
  const stage = profile.stage ? STAGE_LABEL[profile.stage].toLowerCase() : null;
  const amount = profile.raiseGbp !== null ? formatGbp(profile.raiseGbp) : null;
  if (amount && stage) return `We're raising a ${amount} ${stage} round.`;
  if (amount) return `We're raising ${amount}.`;
  if (stage) return `We're raising our ${stage} round.`;
  return "";
}

export function draftIntroEmail(
  investor: Investor,
  profile: PitchProfile,
  pitch: string,
  reasons: string[],
): { subject: string; body: string } {
  const stage = profile.stage ? STAGE_LABEL[profile.stage] : null;
  const sectors = profile.sectors.map((s) => SECTOR_LABEL[s]).join(" / ");
  const round = [stage, profile.raiseGbp !== null ? formatGbp(profile.raiseGbp) : null]
    .filter(Boolean)
    .join(", ");
  const partner = investor.partners.find((p) => /partner/i.test(p.title)) ?? investor.partners[0];
  const greeting = partner ? `Hi ${partner.name.split(" ")[0]},` : `Hi ${investor.name} team,`;
  const summary = pitch.trim().replace(/\s+/g, " ");
  const shortSummary = summary.length > 400 ? `${summary.slice(0, 397).trimEnd()}...` : summary;

  const subject = [sectors || "Startup", round ? `raising ${round}` : null, "intro"]
    .filter(Boolean)
    .join(" · ");
  // Estimated cheque sizes are our guess, not the investor's, so they stay out of the email.
  const stated = reasons.filter((r) => !r.includes("not stated"));
  const fit = stated.length
    ? `I'm writing because ${investor.name} looks like a good fit: ${stated
        .map((r) => r.charAt(0).toLowerCase() + r.slice(1))
        .join("; ")}.`
    : `I'm writing because ${investor.name} backs founders at our stage in London.`;

  const body = [
    greeting,
    "",
    fit,
    "",
    shortSummary,
    "",
    roundSentence(profile),
    "Would you be open to a 20-minute call in the next two weeks? Happy to send the deck first.",
    "",
    "Best,",
    "[Your name]",
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");

  return { subject, body };
}
