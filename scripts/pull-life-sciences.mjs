// Adds major life-sciences investors, their people, London health rounds, and startup profiles.
// Stops calling Dealroom at 19:58 GMT so the handoff can happen at 8pm.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = resolve(ROOT, "dealroom api/dealroom-min-thant-kyaw/dealroom-min-thant-kyaw.env");
const API = "https://api.beta.dealroom.app";
const LONDON = 628061;
const HEALTH = 125403;
const DEADLINE = Date.parse("2026-10-28T19:58:00Z");
const USER_AGENT = "raise/1.0";
const KEEP_TYPES = new Set(["venture_capital", "angel", "angel_fund"]);
const SECTOR_TYPES = new Set(["sector", "industry", "sub_industry", "technology"]);

const env = Object.fromEntries(
  readFileSync(ENV_PATH, "utf8")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("#") && line.includes("="))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
);
const clientId = env.DEALROOM_CLIENT_ID;
const clientSecret = env.DEALROOM_CLIENT_SECRET;
if (!clientId || !clientSecret) throw new Error("Missing local Dealroom credentials");

const tokenRes = await fetch("https://accounts.dealroom.co/oauth/token", {
  method: "POST",
  headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
  body: JSON.stringify({
    client_id: clientId,
    client_secret: clientSecret,
    audience: API,
    grant_type: "client_credentials",
  }),
});
if (!tokenRes.ok) throw new Error(`Token request failed (${tokenRes.status})`);
const { access_token: accessToken } = await tokenRes.json();
const headers = {
  Authorization: `Bearer ${accessToken}`,
  "X-Client-Id": clientId,
  "User-Agent": USER_AGENT,
};

function outOfTime() {
  return Date.now() >= DEADLINE;
}

async function get(path) {
  if (outOfTime()) {
    const error = new Error("deadline");
    error.status = 499;
    throw error;
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(API + path, { headers });
    if (res.status === 429 || res.status >= 500) {
      await new Promise((resolveSleep) => setTimeout(resolveSleep, (attempt + 1) * 800));
      continue;
    }
    const text = await res.text();
    if (!res.ok) {
      const error = new Error(`GET ${path.split("?")[0]} ${res.status}: ${text.slice(0, 180)}`);
      error.status = res.status;
      throw error;
    }
    return JSON.parse(text);
  }
  throw new Error(`GET ${path.split("?")[0]} failed after retries`);
}

async function pageAll(basePath, maxPages) {
  const rows = [];
  let cursor = null;
  let currency = null;
  for (let guard = 0; guard < maxPages; guard++) {
    if (outOfTime()) break;
    const url = cursor ? `${basePath}&cursor=${encodeURIComponent(cursor)}` : basePath;
    const body = await get(url);
    const batch = body.data ?? [];
    if (body.currency) currency = body.currency;
    rows.push(...batch);
    const next = body.page?.next_cursor ?? null;
    console.log(`${basePath.split("?")[0]} +${batch.length} = ${rows.length}`);
    if (!next || batch.length === 0 || next === cursor) break;
    cursor = next;
  }
  return { rows, currency };
}

function clean(value, max = 1500) {
  if (value == null) return null;
  const text = String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function absUrl(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.startsWith("http://") || text.startsWith("https://")) return text;
  if (text.startsWith("//")) return `https:${text}`;
  return `https://${text.replace(/^\/+/, "")}`;
}

function sectorsOf(row) {
  const names = ["Life sciences"];
  for (const tag of row.taxonomy ?? []) {
    if (!SECTOR_TYPES.has(tag.type) || !tag.name) continue;
    if (!names.some((name) => name.toLowerCase() === String(tag.name).toLowerCase())) names.push(tag.name);
  }
  return names;
}

function hqOf(row) {
  const locations = row.locations ?? [];
  return locations.find((location) => location.role === "hq") ?? locations[0] ?? null;
}

function primaryType(row) {
  const codes = (row.types ?? []).map((type) => type.code).filter(Boolean);
  if (codes.includes("venture_capital")) return "venture_capital";
  if (codes.includes("angel")) return "angel";
  if (codes.includes("angel_fund")) return "angel_fund";
  return codes[0] ?? null;
}

function statedCheque(min, max) {
  const chequeMin = Number.isFinite(min) ? Math.round(min) : null;
  const chequeMax = Number.isFinite(max) ? Math.round(max) : null;
  if ((chequeMin == null || chequeMin === 0) && (chequeMax == null || chequeMax === 0)) {
    return { min: null, max: null };
  }
  return { min: chequeMin, max: chequeMax };
}

function toInvestor(row, currency, healthRounds) {
  const investorType = primaryType(row);
  if (!row.uuid || !row.name || !investorType || !KEEP_TYPES.has(investorType)) return null;
  const hq = hqOf(row);
  const cheque = statedCheque(row.deal_size?.min, row.deal_size?.max);
  const mix = [];
  for (const [stage, count] of healthRounds.mix) mix.push({ stage, count });
  mix.sort((a, b) => b.count - a.count || a.stage.localeCompare(b.stage));
  const stages = [];
  if (row.investments?.preferred_round) stages.push(row.investments.preferred_round);
  for (const item of mix) if (!stages.includes(item.stage)) stages.push(item.stage);
  return {
    uuid: row.uuid,
    name: row.name,
    investorType,
    investorTypes: (row.types ?? []).map((type) => type.code).filter(Boolean),
    recordType: row.type ?? "organization",
    tagline: clean(row.tagline, 400),
    about: clean(row.about, 1500),
    website: row.domain ? absUrl(row.domain) : null,
    linkedin: absUrl(row.links?.linkedin),
    image: absUrl(row.image),
    dealroomUrl: row.dealroom_url ?? null,
    hqCity: hq?.city?.name ?? null,
    hqCountry: hq?.country?.name ?? null,
    lat: Number.isFinite(hq?.lat) ? hq.lat : null,
    lon: Number.isFinite(hq?.lon) ? hq.lon : null,
    chequeMin: cheque.min,
    chequeMax: cheque.max,
    chequeCurrency: currency || "GBP",
    preferredRound: row.investments?.preferred_round ?? null,
    stages,
    stageMix: mix,
    sectors: sectorsOf(row),
    lastRoundDate: row.investments?.last_round_date ?? null,
    investmentsCount: Number(row.investments?.count ?? 0) || 0,
    londonRoundsSince2024: healthRounds.count,
    isActive: true,
    thesis: null,
  };
}

function toCompany(row) {
  if (!row.uuid || !row.name) return null;
  const hq = hqOf(row);
  const funding = row.total_funding ?? row.funding?.total ?? null;
  return {
    uuid: row.uuid,
    name: row.name,
    tagline: clean(row.tagline, 400),
    about: clean(row.about, 1500),
    website: row.domain ? absUrl(row.domain) : absUrl(row.website),
    linkedin: absUrl(row.links?.linkedin),
    image: absUrl(row.image),
    dealroomUrl: row.dealroom_url ?? null,
    hqCity: hq?.city?.name ?? null,
    hqCountry: hq?.country?.name ?? null,
    lat: Number.isFinite(hq?.lat) ? hq.lat : null,
    lon: Number.isFinite(hq?.lon) ? hq.lon : null,
    sectors: sectorsOf(row),
    launchYear: row.launch_date ? String(row.launch_date).slice(0, 4) : null,
    employees: row.employees_count == null ? null : String(row.employees_count),
    totalFunding: Number.isFinite(funding) ? Math.round(funding) : null,
    focus: "life_sciences",
  };
}

function personFromMember(member, investorUuid) {
  const nested = member.person && typeof member.person === "object" ? member.person : member;
  const name = nested.name || member.name || null;
  if (!name || member.is_past === true) return null;
  const titles = Array.isArray(member.titles)
    ? member.titles.map((item) => (typeof item === "string" ? item : item?.name)).filter(Boolean)
    : [];
  const personUuid = nested.uuid || member.uuid || null;
  return {
    id: `${investorUuid}:${personUuid || name.toLowerCase()}`,
    personUuid: personUuid ? String(personUuid) : null,
    investorUuid,
    name,
    role: member.raw_title || titles.join(", ") || null,
    linkedin: absUrl(nested.links?.linkedin || member.links?.linkedin),
    image: absUrl(nested.image || member.image),
  };
}

async function mapPool(items, limit, fn) {
  const out = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      if (outOfTime()) return;
      const current = index;
      index += 1;
      try {
        const value = await fn(items[current]);
        if (value) out.push(value);
      } catch (error) {
        if (error.status === 499) return;
        console.log(`skip: ${error.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

async function fetchByIds(resource, ids) {
  const rows = [];
  for (let i = 0; i < ids.length; i += 40) {
    if (outOfTime()) break;
    const filter = `id[in_any]:${ids.slice(i, i + 40).join("|")}`;
    const body = await get(
      `/data/${resource}?limit=40&view=summary&currency=GBP&filter=${encodeURIComponent(filter)}`,
    );
    rows.push(...(body.data ?? []));
  }
  return rows;
}

const datasetPath = resolve(ROOT, "src/lib/raise/dataset.json");
const dataset = JSON.parse(readFileSync(datasetPath, "utf8"));
dataset.companies ??= [];

const txFilter = `and(hq_location[in_any]:${LONDON},taxonomy_id[in_any]:${HEALTH},is_vc_round[eq]:true,year[gte]:2023,growth_stage[nin_any]:412,taxonomy_id[nin_any]:1102801)`;
console.log("loading London life-sciences rounds since 2023");
const txPage = await pageAll(
  `/data/transactions?limit=100&sort=-date&currency=GBP&filter=${encodeURIComponent(txFilter)}`,
  6,
);
const currency = txPage.currency || "GBP";
const activity = new Map();
const companyHits = new Map();
const rawDeals = [];

for (const tx of txPage.rows) {
  if (tx.deleted_at || !Array.isArray(tx.investors)) continue;
  const rawDate = tx.announced_date || tx.date;
  let year = Number.isFinite(tx.year) ? tx.year : null;
  let month = Number.isFinite(tx.month) ? tx.month : null;
  if (year == null && typeof rawDate === "string") {
    const [dateYear, dateMonth] = rawDate.split("-");
    year = Number(dateYear);
    month = dateMonth ? Number(dateMonth) : null;
    if (!Number.isFinite(year)) year = null;
    if (!Number.isFinite(month)) month = null;
  }
  const companyUuid = tx.company?.uuid ? String(tx.company.uuid) : null;
  if (companyUuid) companyHits.set(companyUuid, (companyHits.get(companyUuid) ?? 0) + 1);
  const round = tx.standardized_round || tx.round_type || null;
  for (const participant of tx.investors) {
    const uuid = participant?.investor?.uuid;
    if (!uuid) continue;
    const stats = activity.get(uuid) ?? { count: 0, mix: new Map() };
    stats.count += 1;
    if (round) stats.mix.set(round, (stats.mix.get(round) ?? 0) + 1);
    activity.set(uuid, stats);
    rawDeals.push({
      id: `${tx.id}:${uuid}`,
      transactionId: String(tx.id),
      investorUuid: uuid,
      companyUuid,
      companyName: tx.company?.name || "Undisclosed company",
      roundYear: year,
      roundMonth: month,
      standardizedRound: tx.standardized_round ?? null,
      roundType: tx.round_type ?? null,
      amount: Number.isFinite(tx.amount) ? Math.round(tx.amount) : null,
      currency,
      isLead: participant.is_lead ?? null,
      sourceUrl: tx.source_url ?? null,
    });
  }
}

const rankedIds = [...activity.entries()]
  .sort((a, b) => b[1].count - a[1].count)
  .slice(0, 140)
  .map(([uuid]) => uuid);
console.log(`round investors ${activity.size}, fetching top ${rankedIds.length} profiles`);
const investorRows = await fetchByIds("investors", rankedIds);
const lifeInvestors = [];
for (const row of investorRows) {
  const stats = activity.get(row.uuid) ?? { count: 0, mix: new Map() };
  const investor = toInvestor(row, currency, stats);
  if (investor) lifeInvestors.push(investor);
}
lifeInvestors.sort((a, b) => b.londonRoundsSince2024 - a.londonRoundsSince2024 || b.investmentsCount - a.investmentsCount);
const chosen = lifeInvestors.slice(0, 100);
const chosenIds = new Set(chosen.map((investor) => investor.uuid));
console.log(`life-sciences investors kept ${chosen.length}: ${chosen.slice(0, 8).map((investor) => investor.name).join(", ")}`);

const companyIds = [...companyHits.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 100)
  .map(([uuid]) => uuid);
console.log(`fetching ${companyIds.length} startup profiles`);
const companyRows = await fetchByIds("companies", companyIds);
const companies = companyRows.map(toCompany).filter(Boolean);
console.log(`startup profiles ${companies.length}`);

const existingPeople = new Set((dataset.people ?? []).map((person) => person.investorUuid));
const needTeam = chosen.filter((investor) => !existingPeople.has(investor.uuid)).slice(0, 80);
console.log(`loading teams for ${needTeam.length} new investors`);
const peopleLists = await mapPool(needTeam, 5, async (investor) => {
  const body = await get(`/data/investors/${investor.uuid}/team?limit=12`);
  const members = (body.data ?? [])
    .filter((member) => member.is_past !== true)
    .sort((a, b) => Number(b.is_partner === true) - Number(a.is_partner === true));
  const people = [];
  const seen = new Set();
  for (const member of members) {
    const person = personFromMember(member, investor.uuid);
    if (!person) continue;
    const key = (person.linkedin || person.name).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    people.push(person);
    if (people.length >= 8) break;
  }
  if (investor.investorType === "angel") {
    const self = personFromMember(
      { uuid: investor.uuid, name: investor.name, links: { linkedin: investor.linkedin }, raw_title: "Angel" },
      investor.uuid,
    );
    if (self && !people.some((person) => person.name === self.name)) people.unshift(self);
  }
  return people;
});
const newPeople = peopleLists.flat();
console.log(`new people ${newPeople.length}`);

const byInvestor = new Map((dataset.investors ?? []).map((investor) => [investor.uuid, investor]));
let addedInvestors = 0;
let taggedExisting = 0;
for (const investor of chosen) {
  const existing = byInvestor.get(investor.uuid);
  if (!existing) {
    byInvestor.set(investor.uuid, investor);
    addedInvestors += 1;
    continue;
  }
  const sectors = new Set([...(existing.sectors ?? []), ...investor.sectors]);
  existing.sectors = [...sectors];
  if (!existing.about && investor.about) existing.about = investor.about;
  taggedExisting += 1;
}
const dealsById = new Map((dataset.deals ?? []).map((deal) => [deal.id, deal]));
const addedDealRows = [];
for (const deal of rawDeals) {
  if (!chosenIds.has(deal.investorUuid) || dealsById.has(deal.id)) continue;
  dealsById.set(deal.id, deal);
  addedDealRows.push(deal);
}
const peopleById = new Map((dataset.people ?? []).map((person) => [person.id, person]));
for (const person of newPeople) peopleById.set(person.id, person);
const companiesById = new Map((dataset.companies ?? []).map((company) => [company.uuid, company]));
for (const company of companies) companiesById.set(company.uuid, company);

dataset.generatedAt = new Date().toISOString();
dataset.investors = [...byInvestor.values()];
dataset.deals = [...dealsById.values()];
dataset.people = [...peopleById.values()];
dataset.companies = [...companiesById.values()];

function csvField(value) {
  if (value == null) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
function writeCsv(path, columns, rows) {
  const lines = [columns.join(",")];
  for (const row of rows) lines.push(columns.map((column) => csvField(row[column])).join(","));
  writeFileSync(path, `${lines.join("\n")}\n`);
}
function pipe(list) {
  return (list ?? []).join("|");
}
function mixText(mix) {
  return (mix ?? []).map((item) => `${item.stage}:${item.count}`).join("|");
}

writeCsv(
  resolve(ROOT, "data/investors.csv"),
  ["uuid", "name", "investor_type", "investor_types", "record_type", "tagline", "about", "website", "linkedin", "image", "dealroom_url", "hq_city", "hq_country", "lat", "lon", "cheque_min", "cheque_max", "cheque_currency", "preferred_round", "stages", "stage_mix", "sectors", "last_round_date", "investments_count", "london_rounds_since_2024"],
  dataset.investors.map((investor) => ({
    uuid: investor.uuid,
    name: investor.name,
    investor_type: investor.investorType,
    investor_types: pipe(investor.investorTypes),
    record_type: investor.recordType,
    tagline: investor.tagline,
    about: investor.about,
    website: investor.website,
    linkedin: investor.linkedin,
    image: investor.image,
    dealroom_url: investor.dealroomUrl,
    hq_city: investor.hqCity,
    hq_country: investor.hqCountry,
    lat: investor.lat,
    lon: investor.lon,
    cheque_min: investor.chequeMin,
    cheque_max: investor.chequeMax,
    cheque_currency: investor.chequeCurrency,
    preferred_round: investor.preferredRound,
    stages: pipe(investor.stages),
    stage_mix: mixText(investor.stageMix),
    sectors: pipe(investor.sectors),
    last_round_date: investor.lastRoundDate,
    investments_count: investor.investmentsCount,
    london_rounds_since_2024: investor.londonRoundsSince2024,
  })),
);
writeCsv(
  resolve(ROOT, "data/deals.csv"),
  ["id", "transaction_id", "investor_uuid", "company_uuid", "company_name", "round_year", "round_month", "standardized_round", "round_type", "amount", "currency", "is_lead", "source_url"],
  dataset.deals.map((deal) => ({
    id: deal.id,
    transaction_id: deal.transactionId,
    investor_uuid: deal.investorUuid,
    company_uuid: deal.companyUuid,
    company_name: deal.companyName,
    round_year: deal.roundYear,
    round_month: deal.roundMonth,
    standardized_round: deal.standardizedRound,
    round_type: deal.roundType,
    amount: deal.amount,
    currency: deal.currency,
    is_lead: deal.isLead == null ? "" : deal.isLead ? "true" : "false",
    source_url: deal.sourceUrl,
  })),
);
writeCsv(
  resolve(ROOT, "data/people.csv"),
  ["id", "person_uuid", "investor_uuid", "name", "role", "linkedin", "image"],
  dataset.people.map((person) => ({
    id: person.id,
    person_uuid: person.personUuid,
    investor_uuid: person.investorUuid,
    name: person.name,
    role: person.role,
    linkedin: person.linkedin,
    image: person.image,
  })),
);
writeCsv(
  resolve(ROOT, "data/companies.csv"),
  ["uuid", "name", "tagline", "about", "website", "linkedin", "image", "dealroom_url", "hq_city", "hq_country", "lat", "lon", "sectors", "launch_year", "employees", "total_funding", "focus"],
  dataset.companies.map((company) => ({
    uuid: company.uuid,
    name: company.name,
    tagline: company.tagline,
    about: company.about,
    website: company.website,
    linkedin: company.linkedin,
    image: company.image,
    dealroom_url: company.dealroomUrl,
    hq_city: company.hqCity,
    hq_country: company.hqCountry,
    lat: company.lat,
    lon: company.lon,
    sectors: pipe(company.sectors),
    launch_year: company.launchYear,
    employees: company.employees,
    total_funding: company.totalFunding,
    focus: company.focus,
  })),
);

function sqlText(value) {
  if (value == null || value === "") return "null";
  return `'${String(value).replace(/'/g, "''")}'`;
}
function sqlNum(value) {
  if (value == null || !Number.isFinite(Number(value))) return "null";
  return String(Math.round(Number(value)));
}
function sqlFloat(value) {
  if (value == null || !Number.isFinite(Number(value))) return "null";
  return String(Number(value));
}
function sqlBool(value) {
  if (value == null) return "null";
  return value ? "true" : "false";
}
function insertChunks(table, columns, literalRows, conflict) {
  const parts = [];
  for (let i = 0; i < literalRows.length; i += 40) {
    const slice = literalRows.slice(i, i + 40);
    const values = slice.map((row) => `(${columns.map((column) => row[column]).join(", ")})`).join(",\n");
    parts.push(`insert into public.${table} (${columns.join(", ")}) values\n${values}\non conflict ${conflict};\n`);
  }
  return parts.join("\n");
}

const newInvestorRows = chosen.filter((investor) => !new Set((JSON.parse(readFileSync(datasetPath, "utf8")).investors ?? []).map((item) => item.uuid)).has(investor.uuid) || addedInvestors);
const freshInvestors = chosen.filter((investor) => dataset.investors.find((item) => item.uuid === investor.uuid));
const investorLiterals = freshInvestors.map((investor) => ({
  uuid: sqlText(investor.uuid),
  name: sqlText(investor.name),
  investor_type: sqlText(investor.investorType),
  investor_types: sqlText(pipe(investor.investorTypes)),
  record_type: sqlText(investor.recordType),
  tagline: sqlText(investor.tagline),
  about: sqlText(investor.about),
  website: sqlText(investor.website),
  linkedin: sqlText(investor.linkedin),
  image: sqlText(investor.image),
  dealroom_url: sqlText(investor.dealroomUrl),
  hq_city: sqlText(investor.hqCity),
  hq_country: sqlText(investor.hqCountry),
  lat: sqlFloat(investor.lat),
  lon: sqlFloat(investor.lon),
  cheque_min: sqlNum(investor.chequeMin),
  cheque_max: sqlNum(investor.chequeMax),
  cheque_currency: sqlText(investor.chequeCurrency),
  preferred_round: sqlText(investor.preferredRound),
  stages: sqlText(pipe(investor.stages)),
  stage_mix: sqlText(mixText(investor.stageMix)),
  sectors: sqlText(pipe(byInvestor.get(investor.uuid)?.sectors ?? investor.sectors)),
  last_round_date: sqlText(investor.lastRoundDate),
  investments_count: sqlNum(investor.investmentsCount),
  london_rounds_since_2024: sqlNum(byInvestor.get(investor.uuid)?.londonRoundsSince2024 ?? investor.londonRoundsSince2024),
}));
const dealLiterals = addedDealRows.map((deal) => ({
    id: sqlText(deal.id),
    transaction_id: sqlText(deal.transactionId),
    investor_uuid: sqlText(deal.investorUuid),
    company_uuid: sqlText(deal.companyUuid),
    company_name: sqlText(deal.companyName),
    round_year: sqlNum(deal.roundYear),
    round_month: sqlNum(deal.roundMonth),
    standardized_round: sqlText(deal.standardizedRound),
    round_type: sqlText(deal.roundType),
    amount: sqlNum(deal.amount),
    currency: sqlText(deal.currency),
    is_lead: sqlBool(deal.isLead),
    source_url: sqlText(deal.sourceUrl),
  }));
const peopleLiterals = newPeople.map((person) => ({
  id: sqlText(person.id),
  person_uuid: sqlText(person.personUuid),
  investor_uuid: sqlText(person.investorUuid),
  name: sqlText(person.name),
  role: sqlText(person.role),
  linkedin: sqlText(person.linkedin),
  image: sqlText(person.image),
}));
const companyLiterals = dataset.companies.map((company) => ({
  uuid: sqlText(company.uuid),
  name: sqlText(company.name),
  tagline: sqlText(company.tagline),
  about: sqlText(company.about),
  website: sqlText(company.website),
  linkedin: sqlText(company.linkedin),
  image: sqlText(company.image),
  dealroom_url: sqlText(company.dealroomUrl),
  hq_city: sqlText(company.hqCity),
  hq_country: sqlText(company.hqCountry),
  lat: sqlFloat(company.lat),
  lon: sqlFloat(company.lon),
  sectors: sqlText(pipe(company.sectors)),
  launch_year: sqlText(company.launchYear),
  employees: sqlText(company.employees),
  total_funding: sqlNum(company.totalFunding),
  focus: sqlText(company.focus),
}));

const extra = `-- Life sciences add-on ${dataset.generatedAt}. Upserts only. Does not touch investor_overrides.
${insertChunks(
  "investors",
  ["uuid", "name", "investor_type", "investor_types", "record_type", "tagline", "about", "website", "linkedin", "image", "dealroom_url", "hq_city", "hq_country", "lat", "lon", "cheque_min", "cheque_max", "cheque_currency", "preferred_round", "stages", "stage_mix", "sectors", "last_round_date", "investments_count", "london_rounds_since_2024"],
  investorLiterals,
  `(uuid) do update set sectors = excluded.sectors, about = coalesce(public.investors.about, excluded.about), updated_at = now()`,
)}
${insertChunks(
  "deals",
  ["id", "transaction_id", "investor_uuid", "company_uuid", "company_name", "round_year", "round_month", "standardized_round", "round_type", "amount", "currency", "is_lead", "source_url"],
  dealLiterals,
  `(id) do update set company_name = excluded.company_name, amount = excluded.amount, round_year = excluded.round_year, round_month = excluded.round_month`,
)}
${insertChunks(
  "people",
  ["id", "person_uuid", "investor_uuid", "name", "role", "linkedin", "image"],
  peopleLiterals,
  `(id) do update set name = excluded.name, role = excluded.role, linkedin = excluded.linkedin`,
)}
${insertChunks(
  "companies",
  ["uuid", "name", "tagline", "about", "website", "linkedin", "image", "dealroom_url", "hq_city", "hq_country", "lat", "lon", "sectors", "launch_year", "employees", "total_funding", "focus"],
  companyLiterals,
  `(uuid) do update set name = excluded.name, tagline = excluded.tagline, about = excluded.about, sectors = excluded.sectors, total_funding = excluded.total_funding`,
)}
`;

let seed = readFileSync(resolve(ROOT, "supabase/seed.sql"), "utf8");
seed = seed.replace(/\ncommit;\s*$/, `\n${extra}\ncommit;\n`);
writeFileSync(resolve(ROOT, "supabase/seed.sql"), seed);
writeFileSync(datasetPath, JSON.stringify(dataset));

const note = `\n## Life sciences\n\nAdded ${dataset.generatedAt}. ${chosen.length} life-sciences investors were taken from who actually shows up on London health VC rounds since 2023 (Dealroom health industry ${HEALTH}), capped at 100. ${addedInvestors} were new and ${taggedExisting} were already in the London cohort, now also tagged Life sciences. ${companies.length} startup profiles are in \`data/companies.csv\`. ${addedDealRows.length} health-round participations were added. New team profiles: ${newPeople.length}.\n`;
const readmePath = resolve(ROOT, "data/README.md");
writeFileSync(readmePath, readFileSync(readmePath, "utf8").replace(/\n## Life sciences[\s\S]*$/, "\n") + note);

for (const file of ["data/investors.csv", "data/companies.csv", "data/deals.csv", "src/lib/raise/dataset.json", "supabase/seed.sql"]) {
  const body = readFileSync(resolve(ROOT, file), "utf8");
  if (body.includes(clientSecret) || body.includes(clientId)) throw new Error(`Credential leaked into ${file}`);
}
console.log(`done investors=${dataset.investors.length} new=${addedInvestors} companies=${dataset.companies.length} deals=${dataset.deals.length} people=${dataset.people.length}`);
