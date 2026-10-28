export type StageMix = { stage: string; count: number };

export type Investor = {
  uuid: string;
  name: string;
  investorType: string;
  investorTypes: string[];
  recordType: string;
  tagline: string | null;
  about: string | null;
  website: string | null;
  linkedin: string | null;
  image: string | null;
  dealroomUrl: string | null;
  hqCity: string;
  hqCountry: string;
  lat: number | null;
  lon: number | null;
  chequeMin: number | null;
  chequeMax: number | null;
  chequeCurrency: string;
  preferredRound: string | null;
  stages: string[];
  stageMix: StageMix[];
  sectors: string[];
  lastRoundDate: string | null;
  investmentsCount: number;
  londonRoundsSince2024: number;
  isActive: boolean;
  thesis: string | null;
};

export type Deal = {
  id: string;
  transactionId: string;
  investorUuid: string;
  companyUuid: string | null;
  companyName: string;
  roundYear: number | null;
  roundMonth: number | null;
  standardizedRound: string | null;
  roundType: string | null;
  amount: number | null;
  currency: string;
  isLead: boolean | null;
  sourceUrl: string | null;
};

export type NewsItem = {
  id: string;
  title: string;
  summary: string | null;
  url: string | null;
  publishedAt: string | null;
  articleType: string | null;
  amount: number | null;
  sector: string | null;
  hqCountry: string | null;
  relatedInvestorUuids: string[];
};

export type Person = {
  id: string;
  personUuid: string | null;
  investorUuid: string;
  name: string;
  role: string | null;
  linkedin: string | null;
  image: string | null;
};

export type Company = {
  uuid: string;
  name: string;
  tagline: string | null;
  about: string | null;
  website: string | null;
  linkedin: string | null;
  image: string | null;
  dealroomUrl: string | null;
  hqCity: string | null;
  hqCountry: string | null;
  lat: number | null;
  lon: number | null;
  sectors: string[];
  launchYear: string | null;
  employees: string | null;
  totalFunding: number | null;
  focus: string;
};

export type Dataset = {
  generatedAt: string;
  currency: string;
  investors: Investor[];
  deals: Deal[];
  news: NewsItem[];
  people: Person[];
  companies?: Company[];
};

export type StartupInput = {
  name: string;
  description: string;
  sector: string;
  stage: string;
  raiseAmount: number | null;
  lois: number;
  preOrders: number;
  arr: number;
  mrr: number;
  tractionNotes: string;
};

export type StartupBand = "too early" | "pre-seed" | "seed" | "series a ready" | "later";

export type StartupRating = {
  band: StartupBand;
  score: number;
  reasons: string[];
};

export type MatchResult = {
  investor: Investor;
  score: number;
  reasons: string[];
};

export type Connection = {
  name: string;
  company: string | null;
  linkedin: string | null;
};

export type IntroMatch = {
  connection: Connection;
  person: Person;
  investorUuid: string;
  via: "linkedin" | "name";
};

export type InvestorOverride = {
  investorUuid: string;
  thesis: string | null;
  chequeMin: number | null;
  chequeMax: number | null;
  stages: string[];
  sectors: string[];
  isActive: boolean;
};

export type InvestorFilter = {
  query: string;
  sector: string;
  stage: string;
  cheque: string;
};
