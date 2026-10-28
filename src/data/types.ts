export type Stage = "pre-seed" | "seed" | "series-a" | "series-b" | "growth";

export type Sector =
  "ai" | "fintech" | "healthtech" | "climate" | "devtools" | "consumer" | "b2b-saas" | "deeptech";

export type InvestorType = "vc" | "cvc" | "angel-network" | "accelerator";

export interface Partner {
  id: string;
  name: string;
  title: string;
  linkedinUrl?: string;
  focus: Sector[];
}

export interface Investor {
  id: string;
  slug: string;
  name: string;
  type: InvestorType;
  oneLiner: string;
  website: string;
  address: string;
  lat: number;
  lng: number;
  stages: Stage[];
  sectors: Sector[];
  checkSizeGbp: { min: number; max: number };
  fundSizeGbpM?: number;
  dealsLast12m: number;
  portfolio: string[];
  partners: Partner[];
}

export interface Contact {
  id: string;
  name: string;
  relation: string;
  knows: string[];
}

export type RatingDimension = "responsiveness" | "valueAdd" | "fairTerms" | "founderFirst";

export interface Review {
  id: string;
  investorId: string;
  reviewerContactId?: string;
  portfolioCompany: string;
  verified: boolean;
  scores: Record<RatingDimension, 1 | 2 | 3 | 4 | 5>;
  tags: string[];
  date: string;
}

export interface Dataset {
  generatedAt: string;
  source: "mock" | "dealroom";
  investors: Investor[];
  contacts: Contact[];
  reviews: Review[];
}
