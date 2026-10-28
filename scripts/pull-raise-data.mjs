// Pull a curated London investor cohort from Dealroom into CSV, seed SQL, and the app dataset.
// Credentials stay in the local untracked env file. This script refuses to write them.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = resolve(ROOT, "dealroom api/dealroom-min-thant-kyaw/dealroom-min-thant-kyaw.env");
const API = "https://api.beta.dealroom.app";
const LONDON = 628061;
const VC_TARGET = 180;
const ANGEL_TARGET = 100;
const SECTOR_TYPES = new Set(["sector", "industry", "sub_industry", "technology"]);
const USER_AGENT = "raise/1.0";

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
if (!clientId || !clientSecret) throw new Error("Missing Dealroom credentials in the local env file");

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

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function get(path) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(API + path, { headers });
    if (res.status === 429 || res.status >= 500) {
      const wait = Number(res.headers.get("retry-after") ?? attempt + 1) * 1000;
      console.log(`retry ${res.status} ${path.split("?")[0]} in ${wait}ms`);
      await sleep(wait);
      continue;
    }
    const text = await res.text();
    if (!res.ok) {
      const error = new Error(`GET ${path.split("?")[0]} failed (${res.status}): ${text.slice(0, 220)}`);
      error.status = res.status;
      throw error;
    }
    return JSON.parse(text);
  }
  throw new Error(`GET ${path.split("?")[0]} failed after retries`);
}

async function pageAll(basePath, maxPages = 400) {
  const rows = [];
  let cursor = null;
  let currency = null;
  for (let guard = 0; guard < maxPages; guard++) {
    const url = cursor ? `${basePath}&cursor=${encodeURIComponent(cursor)}` : basePath;
    const body = await get(url);
    const batch = body.data ?? [];
    if (body.currency) currency = body.currency;
    rows.push(...batch);
    const next = body.page?.next_cursor ?? null;
    console.log(`${basePath.split("?")[0]} page ${guard + 1}: +${batch.length} = ${rows.length}`);
    if (!next || batch.length === 0 || next === cursor) return { rows, currency };
    cursor = next;
  }
  return { rows, currency };
}

function clean(value, max = 1500) {
  if (value == null) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
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

function unwrap(row) {
  if (row?.type === "person" && row.investor && typeof row.investor === "object") {
    const nested = row.investor;
    return {
      ...nested,
      ...row,
      deal_size: row.deal_size ?? nested.deal_size ?? null,
      stages: row.stages?.length ? row.stages : (nested.stages ?? []),
      investments: row.investments ?? nested.investments ?? {},
      taxonomy: row.taxonomy?.length ? row.taxonomy : (nested.taxonomy ?? []),
      types: row.types?.length ? row.types : (nested.types ?? []),
      links: row.links ?? nested.links ?? {},
      locations: row.locations?.length ? row.locations : (nested.locations ?? []),
      name: row.name || nested.name,
      uuid: row.uuid,
    };
  }
  return row;
}

function primaryType(row) {
  const codes = (row.types ?? []).map((type) => type.code).filter(Boolean);
  if (codes.includes("venture_capital")) return "venture_capital";
  if (codes.includes("angel")) return "angel";
  if (codes.includes("angel_fund")) return "angel_fund";
  return codes[0] ?? null;
}

function hqOf(row) {
  const locations = row.locations ?? [];
  return (
    locations.find((location) => location.role === "hq") ??
    locations.find((location) => location.city?.id === LONDON) ??
    locations[0] ??
    null
  );
}

function sectorsOf(row) {
  const names = [];
  for (const tag of row.taxonomy ?? []) {
    if (!SECTOR_TYPES.has(tag.type) || !tag.name) continue;
    if (!names.some((name) => name.toLowerCase() === tag.name.toLowerCase())) names.push(tag.name);
  }
  return names;
}

function statedCheque(min, max) {
  const chequeMin = Number.isFinite(min) ? Math.round(min) : null;
  const chequeMax = Number.isFinite(max) ? Math.round(max) : null;
  if ((chequeMin == null || chequeMin === 0) && (chequeMax == null || chequeMax === 0)) {
    return { min: null, max: null };
  }
  return { min: chequeMin, max: chequeMax };
}

function toInvestor(row, currency) {
  const source = unwrap(row);
  const uuid = source.uuid;
  const investorType = primaryType(source);
  if (!uuid || !source.name || !investorType) return null;
  if (!["venture_capital", "angel", "angel_fund"].includes(investorType)) return null;
  const hq = hqOf(source);
  const deal = source.deal_size ?? {};
  return {
    uuid,
    name: source.name,
    investorType,
    investorTypes: (source.types ?? []).map((type) => type.code).filter(Boolean),
    recordType: source.type ?? "organization",
    tagline: clean(source.tagline, 400),
    about: clean(source.about, 1500),
    website: source.domain ? absUrl(source.domain) : null,
    linkedin: absUrl(source.links?.linkedin),
    image: absUrl(source.image),
    dealroomUrl: source.dealroom_url ?? null,
    hqCity: hq?.city?.name ?? "London",
    hqCountry: hq?.country?.name ?? "United Kingdom",
    lat: Number.isFinite(hq?.lat) ? hq.lat : null,
    lon: Number.isFinite(hq?.lon) ? hq.lon : null,
    chequeMin: statedCheque(deal.min, deal.max).min,
    chequeMax: statedCheque(deal.min, deal.max).max,
    chequeCurrency: currency || "USD",
    preferredRound: source.investments?.preferred_round ?? null,
    stages: [],
    stageMix: [],
    sectors: sectorsOf(source),
    lastRoundDate: source.investments?.last_round_date ?? null,
    investmentsCount: Number(source.investments?.count ?? 0) || 0,
    londonRoundsSince2024: 0,
    isActive: true,
    thesis: null,
  };
}

function compareInvestors(a, b) {
  return (
    b.londonRoundsSince2024 - a.londonRoundsSince2024 ||
    b.investmentsCount - a.investmentsCount ||
    String(b.lastRoundDate ?? "").localeCompare(String(a.lastRoundDate ?? "")) ||
    a.name.localeCompare(b.name)
  );
}

function roundStamp(deal) {
  return (deal.roundYear ?? 0) * 100 + (deal.roundMonth ?? 0);
}

function personFromMember(member, investorUuid) {
  const nested = member.person && typeof member.person === "object" ? member.person : member;
  const name =
    nested.name ||
    member.name ||
    [nested.first_name, nested.last_name].filter(Boolean).join(" ") ||
    null;
  if (!name) return null;
  if (member.is_past === true || nested.is_past === true) return null;
  const titles = Array.isArray(member.titles)
    ? member.titles.map((item) => (typeof item === "string" ? item : item?.name)).filter(Boolean)
    : [];
  const role = member.raw_title || titles.join(", ") || member.role || null;
  const personUuid = nested.uuid || member.uuid || member.id || null;
  return {
    id: `${investorUuid}:${personUuid || name.toLowerCase()}`,
    personUuid: personUuid ? String(personUuid) : null,
    investorUuid,
    name,
    role: role || null,
    linkedin: absUrl(nested.links?.linkedin || member.links?.linkedin || nested.linkedin),
    image: absUrl(nested.image || member.image),
  };
}

async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      out[current] = await fn(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

function csvField(value) {
  if (value == null) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function writeCsv(path, columns, rows) {
  const lines = [columns.join(",")];
  for (const row of rows) lines.push(columns.map((column) => csvField(row[column])).join(","));
  writeFileSync(path, `${lines.join("\n")}\n`);
}

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
  for (let i = 0; i < literalRows.length; i += 80) {
    const slice = literalRows.slice(i, i + 80);
    const values = slice
      .map((row) => `(${columns.map((column) => row[column]).join(", ")})`)
      .join(",\n");
    parts.push(
      `insert into public.${table} (${columns.join(", ")}) values\n${values}\non conflict ${conflict};\n`,
    );
  }
  return parts.join("\n");
}

const investorFilter = `and(hq_location[in_any]:${LONDON},investor_type[in_any]:venture_capital|angel|angel_fund,last_investor_round_date[gte]:2024)`;
let currencyQuery = "&currency=GBP";
try {
  await get(`/data/investors?limit=1&view=summary${currencyQuery}&filter=${encodeURIComponent(investorFilter)}`);
  console.log("using currency=GBP");
} catch (error) {
  console.log(`GBP request failed (${error.status ?? "unknown"}), using API default currency`);
  currencyQuery = "";
}

console.log("loading eligible London investors");
const investorPage = await pageAll(
  `/data/investors?limit=100&view=summary${currencyQuery}&filter=${encodeURIComponent(investorFilter)}`,
);
const currency = investorPage.currency || (currencyQuery ? "GBP" : "USD");
const eligible = [];
const seen = new Set();
for (const row of investorPage.rows) {
  const investor = toInvestor(row, currency);
  if (!investor || seen.has(investor.uuid)) continue;
  seen.add(investor.uuid);
  eligible.push(investor);
}
console.log(`eligible investors: ${eligible.length}`);
const byId = new Map(eligible.map((investor) => [investor.uuid, investor]));

const txFilter = `and(hq_location[in_any]:${LONDON},is_vc_round[eq]:true,year[gte]:2024,growth_stage[nin_any]:412,taxonomy_id[nin_any]:1102801)`;
console.log("loading London VC rounds since 2024");
const txPage = await pageAll(
  `/data/transactions?limit=100&sort=-date${currencyQuery}&filter=${encodeURIComponent(txFilter)}`,
);
if (txPage.rows[0]) console.log(`transaction keys: ${Object.keys(txPage.rows[0]).join(",")}`);
let withInvestors = 0;
const dealsByInvestor = new Map();
for (const tx of txPage.rows) {
  if (tx.deleted_at) continue;
  const participants = tx.investors;
  if (!Array.isArray(participants)) continue;
  withInvestors += 1;
  let year = Number.isFinite(tx.year) ? tx.year : null;
  let month = Number.isFinite(tx.month) ? tx.month : null;
  const rawDate = tx.announced_date || tx.date;
  if (year == null && typeof rawDate === "string") {
    const [dateYear, dateMonth] = rawDate.split("-");
    year = Number(dateYear);
    month = dateMonth ? Number(dateMonth) : null;
    if (!Number.isFinite(year)) year = null;
    if (!Number.isFinite(month)) month = null;
  }
  const round = tx.standardized_round || tx.round_type || null;
  for (const participant of participants) {
    const uuid = participant?.investor?.uuid;
    const investor = uuid ? byId.get(uuid) : null;
    if (!investor) continue;
    investor.londonRoundsSince2024 += 1;
    if (round) {
      const mix = investor.stageMix.find((item) => item.stage === round);
      if (mix) mix.count += 1;
      else investor.stageMix.push({ stage: round, count: 1 });
    }
    const list = dealsByInvestor.get(uuid) ?? [];
    const id = `${tx.id}:${uuid}`;
    if (list.some((deal) => deal.id === id)) continue;
    list.push({
      id,
      transactionId: String(tx.id),
      investorUuid: uuid,
      companyUuid: tx.company?.uuid ? String(tx.company.uuid) : null,
      companyName: tx.company?.name || "Undisclosed company",
      roundYear: year,
      roundMonth: month,
      standardizedRound: tx.standardized_round ?? null,
      roundType: tx.round_type ?? null,
      amount: Number.isFinite(tx.amount) ? Math.round(tx.amount) : null,
      currency: txPage.currency || currency,
      isLead: participant.is_lead ?? null,
      sourceUrl: tx.source_url ?? null,
    });
    dealsByInvestor.set(uuid, list);
  }
}
console.log(
  `transactions ${txPage.rows.length}, with investor lists ${withInvestors}, eligible touched ${[...byId.values()].filter((investor) => investor.londonRoundsSince2024 > 0).length}`,
);

for (const investor of eligible) {
  investor.stageMix.sort((a, b) => b.count - a.count || a.stage.localeCompare(b.stage));
  const stageNames = [];
  if (investor.preferredRound) stageNames.push(investor.preferredRound);
  for (const item of investor.stageMix) {
    if (!stageNames.includes(item.stage)) stageNames.push(item.stage);
  }
  investor.stages = stageNames;
}

const vcs = eligible.filter((investor) => investor.investorType === "venture_capital").sort(compareInvestors);
const angels = eligible
  .filter((investor) => investor.investorType === "angel" || investor.investorType === "angel_fund")
  .sort(compareInvestors);
const cohort = [...vcs.slice(0, VC_TARGET), ...angels.slice(0, ANGEL_TARGET)];
console.log(
  `cohort ${cohort.length} (vc pool ${vcs.length} -> ${Math.min(VC_TARGET, vcs.length)}, angel pool ${angels.length} -> ${Math.min(ANGEL_TARGET, angels.length)})`,
);
console.log(`top names: ${cohort.slice(0, 12).map((investor) => investor.name).join(", ")}`);
const known = cohort.filter((investor) => /index ventures|seedcamp/i.test(investor.name)).map((investor) => investor.name);
console.log(`known funds in cohort: ${known.join(", ") || "(none)"}`);

const cohortIds = new Set(cohort.map((investor) => investor.uuid));
let deals = [];
for (const investor of cohort) {
  const list = (dealsByInvestor.get(investor.uuid) ?? []).sort((a, b) => roundStamp(b) - roundStamp(a));
  deals.push(...list);
}
if (deals.length > 6000) {
  deals = [];
  for (const investor of cohort) {
    const list = (dealsByInvestor.get(investor.uuid) ?? []).sort((a, b) => roundStamp(b) - roundStamp(a));
    deals.push(...list.slice(0, 20));
  }
  console.log(`deal rows capped at 20 most recent per investor (${deals.length})`);
} else {
  console.log(`deal rows ${deals.length}`);
}

console.log("loading current team members");
let teamFailures = 0;
let loggedMember = false;
const peopleLists = await mapPool(cohort, 5, async (investor) => {
  const people = [];
  const seenPeople = new Set();
  const add = (person) => {
    if (!person) return;
    const key = (person.linkedin || person.name).toLowerCase();
    if (seenPeople.has(key)) return;
    seenPeople.add(key);
    people.push(person);
  };
  if (investor.recordType === "person" || investor.investorType === "angel") {
    add(
      personFromMember(
        { uuid: investor.uuid, name: investor.name, linkedin: investor.linkedin, role: "Angel" },
        investor.uuid,
      ),
    );
  }
  try {
    const body = await get(`/data/investors/${investor.uuid}/team?limit=20`);
    const members = body.data ?? [];
    if (!loggedMember && members[0]) {
      console.log(`team member keys: ${Object.keys(members[0]).join(",")}`);
      loggedMember = true;
    }
    const current = members
      .filter((member) => member.is_past !== true)
      .sort(
        (a, b) =>
          Number(b.is_partner === true) - Number(a.is_partner === true) ||
          Number(b.is_founder === true) - Number(a.is_founder === true),
      );
    for (const member of current) add(personFromMember(member, investor.uuid));
  } catch (error) {
    teamFailures += 1;
    if (teamFailures <= 5) console.log(`team failed for ${investor.name}: ${error.message}`);
  }
  return people.slice(0, 12);
});
const people = peopleLists.flat();
console.log(`people ${people.length}, team failures ${teamFailures}`);

console.log("loading news");
const newsFilter = "article_type[eq]:vc_round";
let newsPath = `/data/news?limit=50&sort=-published_at&filter=${encodeURIComponent(`and(${newsFilter},hq_country[eq]:United Kingdom)`)}`;
try {
  await get(newsPath.replace("limit=50", "limit=1"));
  console.log("news filtered to United Kingdom");
} catch {
  newsPath = `/data/news?limit=50&sort=-published_at&filter=${encodeURIComponent(newsFilter)}`;
  console.log("UK news filter rejected, scanning recent rounds");
}
const newsPage = await pageAll(newsPath, 40);
const cohortNews = [];
const ukNews = [];
function collectUuids(value, into) {
  if (!value || typeof value !== "object") return;
  if (typeof value.uuid === "string" && cohortIds.has(value.uuid) && !into.includes(value.uuid)) into.push(value.uuid);
  for (const child of Object.values(value)) collectUuids(child, into);
}
for (const article of newsPage.rows) {
  const related = [];
  collectUuids(article.entities, related);
  const item = {
    id: String(article.id),
    title: clean(article.title, 300) || "Untitled",
    summary: clean(article.summary || article.enriched_summary || article.preview, 800),
    url: article.url ?? null,
    publishedAt: article.published_at ?? null,
    articleType: article.article_type ?? null,
    amount: Number.isFinite(article.amount) ? Math.round(article.amount) : null,
    sector: article.sector ?? null,
    hqCountry: article.hq_country ?? null,
    relatedInvestorUuids: related,
  };
  const ukFiltered = newsPath.includes("hq_country");
  const country = String(article.hq_country ?? "").toLowerCase();
  const isUk = ukFiltered || country === "uk" || country === "gb" || country.includes("united kingdom");
  if (related.length) cohortNews.push(item);
  else if (isUk) ukNews.push(item);
}
const news = [];
const newsIds = new Set();
for (const item of [...cohortNews, ...ukNews]) {
  if (newsIds.has(item.id)) continue;
  newsIds.add(item.id);
  news.push(item);
  if (news.length >= 150) break;
}
console.log(`news ${news.length} (cohort-linked ${cohortNews.length}, uk fill ${ukNews.length})`);

const generatedAt = new Date().toISOString();
const dataset = { generatedAt, currency, investors: cohort, deals, news, people };
mkdirSync(resolve(ROOT, "data"), { recursive: true });
mkdirSync(resolve(ROOT, "supabase"), { recursive: true });
mkdirSync(dirname(resolve(ROOT, "src/lib/raise/dataset.json")), { recursive: true });

function pipe(list) {
  return list.join("|");
}
function mixText(mix) {
  return mix.map((item) => `${item.stage}:${item.count}`).join("|");
}

const investorColumns = [
  "uuid",
  "name",
  "investor_type",
  "investor_types",
  "record_type",
  "tagline",
  "about",
  "website",
  "linkedin",
  "image",
  "dealroom_url",
  "hq_city",
  "hq_country",
  "lat",
  "lon",
  "cheque_min",
  "cheque_max",
  "cheque_currency",
  "preferred_round",
  "stages",
  "stage_mix",
  "sectors",
  "last_round_date",
  "investments_count",
  "london_rounds_since_2024",
];

writeCsv(
  resolve(ROOT, "data/investors.csv"),
  investorColumns,
  cohort.map((investor) => ({
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

writeCsv(resolve(ROOT, "data/deals.csv"), [
  "id",
  "transaction_id",
  "investor_uuid",
  "company_uuid",
  "company_name",
  "round_year",
  "round_month",
  "standardized_round",
  "round_type",
  "amount",
  "currency",
  "is_lead",
  "source_url",
], deals.map((deal) => ({
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
})));

writeCsv(resolve(ROOT, "data/news.csv"), [
  "id",
  "title",
  "summary",
  "url",
  "published_at",
  "article_type",
  "amount",
  "sector",
  "hq_country",
  "related_investor_uuids",
], news.map((item) => ({
  id: item.id,
  title: item.title,
  summary: item.summary,
  url: item.url,
  published_at: item.publishedAt,
  article_type: item.articleType,
  amount: item.amount,
  sector: item.sector,
  hq_country: item.hqCountry,
  related_investor_uuids: pipe(item.relatedInvestorUuids),
})));

writeCsv(resolve(ROOT, "data/people.csv"), [
  "id",
  "person_uuid",
  "investor_uuid",
  "name",
  "role",
  "linkedin",
  "image",
], people.map((person) => ({
  id: person.id,
  person_uuid: person.personUuid,
  investor_uuid: person.investorUuid,
  name: person.name,
  role: person.role,
  linkedin: person.linkedin,
  image: person.image,
})));

const investorLiterals = cohort.map((investor) => ({
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
  sectors: sqlText(pipe(investor.sectors)),
  last_round_date: sqlText(investor.lastRoundDate),
  investments_count: sqlNum(investor.investmentsCount),
  london_rounds_since_2024: sqlNum(investor.londonRoundsSince2024),
}));

const dealLiterals = deals.map((deal) => ({
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

const newsLiterals = news.map((item) => ({
  id: sqlText(item.id),
  title: sqlText(item.title),
  summary: sqlText(item.summary),
  url: sqlText(item.url),
  published_at: item.publishedAt ? `${sqlText(item.publishedAt)}::timestamptz` : "null",
  article_type: sqlText(item.articleType),
  amount: sqlNum(item.amount),
  sector: sqlText(item.sector),
  hq_country: sqlText(item.hqCountry),
  related_investor_uuids: sqlText(pipe(item.relatedInvestorUuids)),
}));

const peopleLiterals = people.map((person) => ({
  id: sqlText(person.id),
  person_uuid: sqlText(person.personUuid),
  investor_uuid: sqlText(person.investorUuid),
  name: sqlText(person.name),
  role: sqlText(person.role),
  linkedin: sqlText(person.linkedin),
  image: sqlText(person.image),
}));

const investorConflict = `(uuid) do update set
  name = excluded.name,
  investor_type = excluded.investor_type,
  investor_types = excluded.investor_types,
  record_type = excluded.record_type,
  tagline = excluded.tagline,
  about = excluded.about,
  website = excluded.website,
  linkedin = excluded.linkedin,
  image = excluded.image,
  dealroom_url = excluded.dealroom_url,
  hq_city = excluded.hq_city,
  hq_country = excluded.hq_country,
  lat = excluded.lat,
  lon = excluded.lon,
  cheque_min = excluded.cheque_min,
  cheque_max = excluded.cheque_max,
  cheque_currency = excluded.cheque_currency,
  preferred_round = excluded.preferred_round,
  stages = excluded.stages,
  stage_mix = excluded.stage_mix,
  sectors = excluded.sectors,
  last_round_date = excluded.last_round_date,
  investments_count = excluded.investments_count,
  london_rounds_since_2024 = excluded.london_rounds_since_2024,
  updated_at = now()`;

const seed = `-- Generated ${generatedAt} from data/*.csv. Do not edit by hand.
-- Upserts Dealroom-owned rows only. Never deletes investors, and never writes investor_overrides.
-- Currency: ${currency}. Cohort: ${cohort.length} investors.
begin;

${insertChunks("investors", investorColumns, investorLiterals, investorConflict)}
${insertChunks(
  "deals",
  ["id", "transaction_id", "investor_uuid", "company_uuid", "company_name", "round_year", "round_month", "standardized_round", "round_type", "amount", "currency", "is_lead", "source_url"],
  dealLiterals,
  `(id) do update set
  transaction_id = excluded.transaction_id,
  investor_uuid = excluded.investor_uuid,
  company_uuid = excluded.company_uuid,
  company_name = excluded.company_name,
  round_year = excluded.round_year,
  round_month = excluded.round_month,
  standardized_round = excluded.standardized_round,
  round_type = excluded.round_type,
  amount = excluded.amount,
  currency = excluded.currency,
  is_lead = excluded.is_lead,
  source_url = excluded.source_url`,
)}
${insertChunks(
  "news",
  ["id", "title", "summary", "url", "published_at", "article_type", "amount", "sector", "hq_country", "related_investor_uuids"],
  newsLiterals,
  `(id) do update set
  title = excluded.title,
  summary = excluded.summary,
  url = excluded.url,
  published_at = excluded.published_at,
  article_type = excluded.article_type,
  amount = excluded.amount,
  sector = excluded.sector,
  hq_country = excluded.hq_country,
  related_investor_uuids = excluded.related_investor_uuids`,
)}
${insertChunks(
  "people",
  ["id", "person_uuid", "investor_uuid", "name", "role", "linkedin", "image"],
  peopleLiterals,
  `(id) do update set
  person_uuid = excluded.person_uuid,
  investor_uuid = excluded.investor_uuid,
  name = excluded.name,
  role = excluded.role,
  linkedin = excluded.linkedin,
  image = excluded.image`,
)}
commit;
`;

writeFileSync(resolve(ROOT, "supabase/seed.sql"), seed);
writeFileSync(resolve(ROOT, "src/lib/raise/dataset.json"), JSON.stringify(dataset));
writeFileSync(
  resolve(ROOT, "data/README.md"),
  `# Raise dataset

Generated ${generatedAt}.

London means Dealroom city id ${LONDON} (London, United Kingdom). Other cities named London are excluded.

Eligible rows are headquartered there, have investor type \`venture_capital\`, \`angel\`, or \`angel_fund\`, and a last investment on or after 2024-01-01. There are ${eligible.length} eligible investors in this pull. The shipped cohort is the top ${Math.min(VC_TARGET, vcs.length)} venture capital firms and the top ${Math.min(ANGEL_TARGET, angels.length)} angels and angel funds.

Rank is London-HQ company VC rounds since 2024 (excluding Mature and Outside Tech), then total investment count, then latest round date. ${withInvestors} of ${txPage.rows.length} scanned rounds included an investor list.

\`london_rounds_since_2024\` is the full count. \`deals.csv\` is every stored participation for the cohort${deals.length > 6000 ? " after a 20-per-investor cap" : ""}. Stated ticket is Dealroom \`deal_size\` in ${currency}, not a reconstructed cheque. \`stages\` mixes \`preferred_round\` with the labels of those London rounds because stated stage lists are usually empty. Sectors keep taxonomy types sector, industry, sub_industry, and technology. Dealroom leaves those tags empty on many investors, so the sector filter only narrows rows that have them.

News is capped at 150 recent \`vc_round\` articles, cohort mentions first, then other United Kingdom articles. People are the angel themselves and current team members, capped at 12 per investor. Team requests that failed: ${teamFailures}.

Do not commit Dealroom credentials. Re-run \`node scripts/pull-raise-data.mjs\` locally, then re-apply \`supabase/seed.sql\`. The seed upserts Dealroom columns and does not touch \`investor_overrides\`.
`,
);

const secretMarkers = [clientSecret, clientId];
for (const file of [
  "data/investors.csv",
  "data/deals.csv",
  "data/news.csv",
  "data/people.csv",
  "data/README.md",
  "supabase/seed.sql",
  "src/lib/raise/dataset.json",
]) {
  const body = readFileSync(resolve(ROOT, file), "utf8");
  for (const marker of secretMarkers) {
    if (marker && body.includes(marker)) throw new Error(`Refusing to leave a credential in ${file}`);
  }
}

if (cohort.length < 200 || cohort.length > 300) {
  throw new Error(`Cohort size ${cohort.length} is outside 200–300`);
}
console.log("wrote data csv, seed.sql, and dataset.json");
