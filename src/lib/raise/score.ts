import { formatCheque, orderedCheque } from "./format";
import { STAGE_ORDER, canonicalStage, investorStages, type CanonicalStage } from "./stages";
import type { Investor, MatchResult, StartupInput, StartupRating } from "./types";

function sectorPoints(sectors: string[], wanted: string): { points: number; reason: string | null } {
  const target = wanted.trim().toLowerCase();
  if (!target) return { points: 0, reason: "No sector was entered, so sector fit is not scored." };
  const exact = sectors.some((sector) => {
    const value = sector.toLowerCase();
    return value === target || value.includes(target) || target.includes(value);
  });
  if (exact) return { points: 40, reason: `Sector overlap on ${wanted.trim()}.` };
  const words = target.split(/[^a-z0-9]+/).filter((word) => word.length > 3);
  const blob = sectors.join(" ").toLowerCase();
  if (words.some((word) => blob.includes(word))) {
    return { points: 18, reason: `Partial sector overlap with ${wanted.trim()}.` };
  }
  return { points: 0, reason: `No sector overlap with ${wanted.trim()}.` };
}

function stagePoints(
  stages: CanonicalStage[],
  wanted: string,
): { points: number; reason: string | null } {
  if (!wanted.trim()) return { points: 0, reason: "No stage was entered, so stage fit is not scored." };
  const target = canonicalStage(wanted);
  if (!target) return { points: 0, reason: null };
  if (stages.includes(target)) return { points: 30, reason: `Their recent rounds include ${target}.` };
  const targetIndex = STAGE_ORDER.indexOf(target);
  const adjacent = stages.some((stage) => Math.abs(STAGE_ORDER.indexOf(stage) - targetIndex) === 1);
  if (adjacent) return { points: 15, reason: `They invest next to ${target}, not exactly on it.` };
  return { points: 0, reason: `Their recent rounds do not match ${target}.` };
}

function chequePoints(
  investor: Investor,
  raiseAmount: number | null,
): { points: number; reason: string } {
  if (raiseAmount == null || raiseAmount <= 0) {
    return { points: 0, reason: "No raise amount was entered, so cheque fit is not scored." };
  }
  const { low, high: statedHigh } = orderedCheque(investor.chequeMin, investor.chequeMax);
  if (low == null && statedHigh == null) {
    return { points: 8, reason: "Dealroom has no stated ticket for this investor." };
  }
  const floor = low ?? 0;
  const ceiling = statedHigh ?? low ?? 0;
  const stated = formatCheque(investor);
  if (raiseAmount >= floor && raiseAmount <= ceiling) {
    return { points: 20, reason: `The raise sits inside the stated ticket (${stated}).` };
  }
  return { points: 0, reason: `The raise sits outside the stated ticket (${stated}).` };
}

function activityPoints(rounds: number): { points: number; reason: string } {
  if (rounds >= 6) return { points: 10, reason: `${rounds} London VC rounds since 2024.` };
  if (rounds >= 3) return { points: 7, reason: `${rounds} London VC rounds since 2024.` };
  if (rounds >= 1) return { points: 4, reason: `${rounds} London VC round${rounds === 1 ? "" : "s"} since 2024.` };
  return { points: 0, reason: "No London VC round in this dataset since 2024." };
}

function tractionFit(band: StartupRating["band"], stages: CanonicalStage[]): { points: number; reason: string } {
  const target: CanonicalStage =
    band === "later" || band === "series a ready" ? "Series A" : band === "seed" ? "Seed" : "Pre-Seed";
  if (stages.includes(target)) {
    return { points: 10, reason: `Traction band “${band}” lines up with ${target}.` };
  }
  const targetIndex = STAGE_ORDER.indexOf(target);
  const adjacent = stages.some((stage) => Math.abs(STAGE_ORDER.indexOf(stage) - targetIndex) === 1);
  if (adjacent) return { points: 4, reason: `Traction band “${band}” is adjacent to where they invest.` };
  return { points: 0, reason: `Traction band “${band}” does not match where they invest.` };
}

export function rankInvestors(investors: Investor[], input: StartupInput): MatchResult[] {
  const rating = rateStartup(input);
  const ranked = investors
    .filter((investor) => investor.isActive)
    .map((investor) => {
      const stages = investorStages(investor);
      const parts = [
        sectorPoints(investor.sectors, input.sector),
        stagePoints(stages, input.stage),
        chequePoints(investor, input.raiseAmount),
        activityPoints(investor.londonRoundsSince2024),
        tractionFit(rating.band, stages),
      ];
      const score = Math.min(
        100,
        parts.reduce((sum, part) => sum + part.points, 0),
      );
      return {
        investor,
        score,
        reasons: parts.map((part) => part.reason).filter((reason): reason is string => Boolean(reason)),
      };
    });
  ranked.sort(
    (a, b) =>
      b.score - a.score ||
      b.investor.londonRoundsSince2024 - a.investor.londonRoundsSince2024 ||
      a.investor.name.localeCompare(b.investor.name),
  );
  return ranked;
}

export function rateStartup(input: StartupInput): StartupRating {
  const reasons: string[] = [];
  let points = 0;
  const monthly = input.mrr > 0 ? input.mrr : input.arr > 0 ? input.arr / 12 : 0;

  if (input.mrr >= 250_000 || input.arr >= 3_000_000) {
    points += 55;
    reasons.push(
      input.mrr >= 250_000
        ? "Monthly revenue is 250,000 or more."
        : "Annual revenue is 3,000,000 or more.",
    );
  } else if (monthly >= 100_000) {
    points += 45;
    reasons.push("Monthly revenue is at a Series A signal (100,000 or more).");
  } else if (monthly >= 25_000) {
    points += 32;
    reasons.push("Monthly revenue is in a strong seed range (25,000–100,000).");
  } else if (monthly >= 5_000) {
    points += 20;
    reasons.push("Monthly revenue shows early commercial traction.");
  } else if (monthly > 0) {
    points += 10;
    reasons.push("There is some revenue, still thin.");
  } else {
    reasons.push("No revenue was entered.");
  }

  if (input.mrr > 0 && input.mrr < 250_000 && input.arr >= 1_000_000 && input.arr < 3_000_000) {
    points += 10;
    reasons.push("Annual revenue is 1,000,000 or more.");
  }

  if (input.lois >= 4) {
    points += 15;
    reasons.push(`${input.lois} letters of intent is a real pipeline.`);
  } else if (input.lois >= 1) {
    points += 8;
    reasons.push(
      `${input.lois} letter${input.lois === 1 ? "" : "s"} of intent on file.`,
    );
  } else {
    reasons.push("No letters of intent entered.");
  }

  if (input.preOrders >= 4) {
    points += 15;
    reasons.push(`${input.preOrders} pre-purchase orders.`);
  } else if (input.preOrders >= 1) {
    points += 8;
    reasons.push(`${input.preOrders} pre-purchase order${input.preOrders === 1 ? "" : "s"}.`);
  } else {
    reasons.push("No pre-purchase orders entered.");
  }

  if (input.tractionNotes.trim()) {
    reasons.push("Traction notes are recorded and are not turned into points.");
  }

  const score = Math.min(100, points);
  let band: StartupRating["band"] = "too early";
  if (input.mrr >= 250_000 || input.arr >= 3_000_000) band = "later";
  else if (monthly >= 100_000 || score >= 60) band = "series a ready";
  else if (monthly >= 25_000 || score >= 32) band = "seed";
  else if (monthly > 0 || input.lois > 0 || input.preOrders > 0) band = "pre-seed";

  return { band, score, reasons };
}
