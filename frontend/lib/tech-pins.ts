/**
 * Tech companies on the Austin Atlas map, ranked by Levels.fyi SWE median TC
 * (Greater Austin Area when available). Attribution required for any display.
 *
 * Data source: Levels.fyi (https://www.levels.fyi) — fetched Sep 2026.
 */

export type TechCompany = {
  /** Stable id for UI / camera focus (one row per company). */
  id: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  /** Brand-forward hex for the matched footprint. */
  color: string;
  /**
   * Levels.fyi Software Engineer median total compensation (USD).
   * Null when no usable Levels.fyi series was found.
   */
  medianTc: number | null;
  /** Scope note shown in the prestige panel. */
  salaryScope: "austin" | "us" | "none";
  /** Optional match radius override (campus sites). */
  matchRadiusM?: number;
  /** Prefer this id when multiple sites share a brand name in the panel. */
  primary?: boolean;
};

/**
 * Map sites: downtown, Riverside, Domain/north, Tesla Giga SE.
 * Prestige panel sorts by medianTc desc; nulls last.
 */
export const TECH_COMPANIES: TechCompany[] = [
  {
    id: "uber",
    name: "Uber",
    address: "201 E 3rd St",
    lat: 30.264759,
    lon: -97.742403,
    color: "#06c167",
    // Sparse senior-only Austin sample on Levels.fyi.
    medianTc: 657_925,
    salaryScope: "austin",
    primary: true,
  },
  {
    id: "dropbox",
    name: "Dropbox",
    address: "501 Congress Ave",
    lat: 30.2672856,
    lon: -97.742629,
    color: "#0061ff",
    medianTc: 367_400,
    salaryScope: "austin",
    primary: true,
  },
  {
    id: "atlassian",
    name: "Atlassian",
    address: "303 Colorado St (Colorado Tower)",
    lat: 30.2659316,
    lon: -97.7446725,
    color: "#0052cc",
    medianTc: 309_000,
    salaryScope: "austin",
    primary: true,
  },
  {
    id: "indeed",
    name: "Indeed",
    address: "200 W 6th St (Indeed Tower)",
    lat: 30.2690084,
    lon: -97.7442598,
    color: "#003a9b",
    medianTc: 300_000,
    salaryScope: "austin",
    primary: true,
  },
  {
    id: "meta",
    name: "Meta",
    address: "400 W 6th St (Sixth & Guadalupe)",
    lat: 30.2696544,
    lon: -97.7466546,
    color: "#0668e1",
    medianTc: 295_000,
    salaryScope: "austin",
    primary: true,
  },
  {
    id: "meta-shoal",
    name: "Meta",
    address: "607 W 3rd St (Third + Shoal)",
    lat: 30.266692,
    lon: -97.749981,
    color: "#0668e1",
    medianTc: 295_000,
    salaryScope: "austin",
  },
  {
    id: "intel",
    name: "Intel",
    address: "1501 S MoPac Expy",
    lat: 30.262394,
    lon: -97.793403,
    color: "#0071c5",
    medianTc: 285_000,
    salaryScope: "austin",
    primary: true,
    matchRadiusM: 250,
  },
  {
    id: "tesla",
    name: "Tesla",
    address: "1 Tesla Road (Gigafactory Texas)",
    lat: 30.2219321,
    lon: -97.6187733,
    color: "#cc0000",
    medianTc: 285_000,
    salaryScope: "us",
    matchRadiusM: 450,
    primary: true,
  },
  {
    id: "google",
    name: "Google",
    address: "601 W 2nd St (Sail Tower / Block 185)",
    lat: 30.265617,
    lon: -97.7504086,
    color: "#4285f4",
    medianTc: 265_000,
    salaryScope: "austin",
    primary: true,
  },
  {
    id: "google-500",
    name: "Google",
    address: "500 W 2nd St",
    lat: 30.2667659,
    lon: -97.7501864,
    color: "#4285f4",
    medianTc: 265_000,
    salaryScope: "austin",
  },
  {
    id: "crowdstrike",
    name: "CrowdStrike",
    address: "206 E 9th St (Capitol Tower)",
    lat: 30.2705927,
    lon: -97.7397399,
    color: "#e31c23",
    medianTc: 252_000,
    salaryScope: "austin",
    primary: true,
  },
  {
    id: "amazon",
    name: "Amazon",
    address: "11501 Alterra Pkwy (Domain Tech Hub)",
    lat: 30.400738,
    lon: -97.719253,
    color: "#ff9900",
    medianTc: 250_000,
    salaryScope: "austin",
    primary: true,
    matchRadiusM: 220,
  },
  {
    id: "amazon-alterra",
    name: "Amazon",
    address: "11601 Alterra Pkwy (Domain)",
    lat: 30.401934,
    lon: -97.718733,
    color: "#ff9900",
    medianTc: 250_000,
    salaryScope: "austin",
    matchRadiusM: 220,
  },
  {
    id: "salesforce",
    name: "Salesforce",
    address: "600 Congress Ave",
    lat: 30.2684247,
    lon: -97.7431556,
    color: "#00a1e0",
    medianTc: 247_000,
    salaryScope: "austin",
    primary: true,
  },
  {
    id: "apple",
    name: "Apple",
    address: "12545 Riata Vista Cir (Parmer campus)",
    lat: 30.432487,
    lon: -97.735941,
    color: "#a2aaad",
    medianTc: 214_250,
    salaryScope: "austin",
    primary: true,
    matchRadiusM: 300,
  },
  {
    id: "oracle",
    name: "Oracle",
    address: "2300 Oracle Way (Waterloo campus)",
    lat: 30.243505,
    lon: -97.721831,
    color: "#c74634",
    medianTc: 204_000,
    salaryScope: "austin",
    primary: true,
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    address: "405 Comal St",
    lat: 30.2612903,
    lon: -97.7267955,
    color: "#f38020",
    medianTc: 200_000,
    salaryScope: "austin",
    primary: true,
  },
  {
    id: "amd",
    name: "AMD",
    address: "7171 Southwest Pkwy",
    lat: 30.251048,
    lon: -97.863369,
    color: "#ed1c24",
    medianTc: 195_000,
    salaryScope: "austin",
    primary: true,
    matchRadiusM: 280,
  },
  {
    id: "ibm",
    name: "IBM",
    address: "11400 Burnet Rd",
    lat: 30.393791,
    lon: -97.724125,
    color: "#054ada",
    medianTc: 125_000,
    salaryScope: "austin",
    primary: true,
    matchRadiusM: 250,
  },
  {
    id: "ni",
    name: "NI",
    address: "11500 N MoPac Expy",
    lat: 30.40664,
    lon: -97.727888,
    color: "#00adef",
    medianTc: null,
    salaryScope: "none",
    primary: true,
    matchRadiusM: 220,
  },
  {
    id: "vrbo",
    name: "Vrbo",
    address: "11920 Alterra Pkwy (Domain)",
    lat: 30.405043,
    lon: -97.719907,
    color: "#3d9ae8",
    medianTc: 205_000,
    salaryScope: "us",
    primary: true,
    matchRadiusM: 220,
  },
  {
    id: "bumble",
    name: "Bumble",
    address: "1105 W 41st St",
    lat: 30.309308,
    lon: -97.742125,
    color: "#ffc629",
    medianTc: null,
    salaryScope: "none",
    primary: true,
  },
  {
    id: "tiktok",
    name: "TikTok",
    address: "300 Colorado St",
    lat: 30.2659876,
    lon: -97.7455043,
    color: "#fe2c55",
    medianTc: null,
    salaryScope: "none",
    primary: true,
  },
  {
    id: "wp-engine",
    name: "WP Engine",
    address: "504 Lavaca St (Lavaca Plaza)",
    lat: 30.2682051,
    lon: -97.7460028,
    color: "#0ecad4",
    medianTc: null,
    salaryScope: "none",
    primary: true,
  },
  {
    id: "capital-factory",
    name: "Capital Factory",
    address: "701 Brazos St",
    lat: 30.268971,
    lon: -97.7406286,
    color: "#ff5a00",
    medianTc: null,
    salaryScope: "none",
    primary: true,
  },
  {
    id: "base-power",
    name: "Base Power",
    address: "205 E Riverside Dr",
    lat: 30.2546131,
    lon: -97.7454702,
    color: "#16a34a",
    medianTc: null,
    salaryScope: "none",
    primary: true,
  },
];

/** Companies shown in the prestige panel (one row per brand). */
export function rankedCompaniesForPanel(): TechCompany[] {
  const byName = new Map<string, TechCompany>();
  for (const c of TECH_COMPANIES) {
    const existing = byName.get(c.name);
    if (!existing || c.primary) {
      byName.set(c.name, c);
    }
  }

  return [...byName.values()].sort((a, b) => {
    if (a.medianTc == null && b.medianTc == null) {
      return a.name.localeCompare(b.name);
    }
    if (a.medianTc == null) return 1;
    if (b.medianTc == null) return -1;
    return b.medianTc - a.medianTc;
  });
}

export function formatMedianTc(value: number | null) {
  if (value == null) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  return `$${Math.round(value / 1000)}K`;
}

export const LEVELS_FYI_ATTRIBUTION =
  "Prestige ranking: Levels.fyi SWE median TC (https://www.levels.fyi)";

/** @deprecated */
export type TechPin = TechCompany;
export const DOWNTOWN_TECH_COMPANIES = TECH_COMPANIES;
export const DOWNTOWN_TECH_PINS = TECH_COMPANIES;
