// Faithful port of the app's PlayerRank system (30 ranks, 6 tiers).
// Lookup = last rank where iq >= iqRequired.

export type TierIcon = "circle" | "hexagon" | "shield" | "star" | "diamond" | "crown";

export interface Rank {
  level: number;
  tier: string; // PDGA-native display name
  color: string; // tier accent (hex)
  secondary: string;
  icon: TierIcon;
  subLevel: number;
  iqRequired: number;
  nextIQ: number | null;
}

// Exact tier visuals from the app (PlayerRank.kt + LevelBadge.kt): icon shape + colors + description.
const TIER = {
  ROOKIE: { display: "Rookie", color: "#b78c59", secondary: "#8c6640", icon: "circle" as TierIcon, description: "Learning the basics — building your throw, understanding the game." },
  AMATEUR: { display: "Amateur", color: "#a6adb8", secondary: "#80878f", icon: "hexagon" as TierIcon, description: "Consistent contact, understands disc flight and course strategy." },
  COMPETITOR: { display: "Competitor", color: "#d9ad40", secondary: "#b38526", icon: "shield" as TierIcon, description: "Hits fairways, makes C1 putts, plays smart. Ready to compete." },
  CONTENDER: { display: "Advanced", color: "#8cc7eb", secondary: "#669ec7", icon: "star" as TierIcon, description: "Reliable under pressure. Low bogey rate, strong course management." },
  ELITE: { display: "Pro", color: "#a673d9", secondary: "#7a4db3", icon: "diamond" as TierIcon, description: "Tournament-ready. Attacks courses, controls all shot shapes." },
  PRO: { display: "Champion", color: "#d9404d", secondary: "#b32633", icon: "crown" as TierIcon, description: "Top-tier complete game. Mastery across putting, driving, and strategy." },
} as const;

export interface TierInfo {
  display: string;
  color: string;
  secondary: string;
  icon: TierIcon;
  description: string;
  iqMin: number;
  iqMax: number;
}

export const TIER_LIST: TierInfo[] = [
  { ...TIER.ROOKIE, iqMin: 0, iqMax: 34 },
  { ...TIER.AMATEUR, iqMin: 35, iqMax: 49 },
  { ...TIER.COMPETITOR, iqMin: 50, iqMax: 61 },
  { ...TIER.CONTENDER, iqMin: 62, iqMax: 74 },
  { ...TIER.ELITE, iqMin: 75, iqMax: 87 },
  { ...TIER.PRO, iqMin: 88, iqMax: 100 },
];

type TierKey = keyof typeof TIER;

const RAW: [number, TierKey, number, number, number | null][] = [
  [1, "ROOKIE", 1, 0, 7], [2, "ROOKIE", 2, 7, 14], [3, "ROOKIE", 3, 14, 21], [4, "ROOKIE", 4, 21, 28], [5, "ROOKIE", 5, 28, 35],
  [6, "AMATEUR", 1, 35, 38], [7, "AMATEUR", 2, 38, 41], [8, "AMATEUR", 3, 41, 44], [9, "AMATEUR", 4, 44, 47], [10, "AMATEUR", 5, 47, 50],
  [11, "COMPETITOR", 1, 50, 53], [12, "COMPETITOR", 2, 53, 55], [13, "COMPETITOR", 3, 55, 58], [14, "COMPETITOR", 4, 58, 60], [15, "COMPETITOR", 5, 60, 62],
  [16, "CONTENDER", 1, 62, 65], [17, "CONTENDER", 2, 65, 68], [18, "CONTENDER", 3, 68, 71], [19, "CONTENDER", 4, 71, 74], [20, "CONTENDER", 5, 74, 75],
  [21, "ELITE", 1, 75, 78], [22, "ELITE", 2, 78, 81], [23, "ELITE", 3, 81, 84], [24, "ELITE", 4, 84, 87], [25, "ELITE", 5, 87, 88],
  [26, "PRO", 1, 88, 90], [27, "PRO", 2, 90, 93], [28, "PRO", 3, 93, 96], [29, "PRO", 4, 96, 99], [30, "PRO", 5, 99, null],
];

const ALL: Rank[] = RAW.map(([level, tierKey, subLevel, iqRequired, nextIQ]) => ({
  level,
  tier: TIER[tierKey].display,
  color: TIER[tierKey].color,
  secondary: TIER[tierKey].secondary,
  icon: TIER[tierKey].icon,
  subLevel,
  iqRequired,
  nextIQ,
}));

const ROMAN = ["", "I", "II", "III", "IV", "V"];

export function rankForIQ(iq: number): Rank {
  let r = ALL[0];
  for (const x of ALL) if (iq >= x.iqRequired) r = x;
  return r;
}

export function rankLabel(r: Rank): string {
  return `${r.tier} · ${ROMAN[r.subLevel] ?? r.subLevel}`;
}

/** 0..1 progress from this rank's floor to the next rank. */
export function rankProgress(iq: number, r: Rank): number {
  if (r.nextIQ == null) return 1;
  const span = r.nextIQ - r.iqRequired;
  if (span <= 0) return 1;
  return Math.max(0, Math.min(1, (iq - r.iqRequired) / span));
}

// ============================================================================
// Radius Rating scale — same 6 tiers / 30 levels, re-keyed to the 4-digit
// rating (iOS PlayerRank.ratingThresholds, rating spec §7). Bands:
// Rookie <650 · Amateur 650–799 · Competitor 800–874 · Advanced 875–949 ·
// Pro 950–1024 · Champion 1025+. Same names/colors/icons as Game IQ; only the
// numeric floors differ. Lookup = last level whose floor ≤ rating (iOS forRating).
// ============================================================================

export const RATING_THRESHOLDS: number[] = [
  0, 530, 560, 590, 620,       // Rookie I–V
  650, 680, 710, 740, 770,     // Amateur I–V
  800, 815, 830, 845, 860,     // Competitor I–V
  875, 890, 905, 920, 935,     // Advanced I–V
  950, 965, 980, 995, 1010,    // Pro I–V
  1025, 1040, 1055, 1070, 1085,// Champion I–V
];

// Rating ranks reuse the Rank shape: iqRequired = rating floor, nextIQ = next floor.
const ALL_RATING: Rank[] = RAW.map(([level, tierKey, subLevel], i) => ({
  level,
  tier: TIER[tierKey].display,
  color: TIER[tierKey].color,
  secondary: TIER[tierKey].secondary,
  icon: TIER[tierKey].icon,
  subLevel,
  iqRequired: RATING_THRESHOLDS[i],
  nextIQ: RATING_THRESHOLDS[i + 1] ?? null,
}));

export function rankForRating(rating: number): Rank {
  let r = ALL_RATING[0];
  for (const x of ALL_RATING) if (rating >= x.iqRequired) r = x;
  return r;
}

// Tier bands on the rating scale — for the tiers modal / rank library.
export const TIER_LIST_RATING: TierInfo[] = [
  { ...TIER.ROOKIE, iqMin: 0, iqMax: 649 },
  { ...TIER.AMATEUR, iqMin: 650, iqMax: 799 },
  { ...TIER.COMPETITOR, iqMin: 800, iqMax: 874 },
  { ...TIER.CONTENDER, iqMin: 875, iqMax: 949 },
  { ...TIER.ELITE, iqMin: 950, iqMax: 1024 },
  { ...TIER.PRO, iqMin: 1025, iqMax: 9999 }, // display as "1025+"
];

// ---- Unified accessor: Radius Rating with Game IQ fallback (transition) ----
// While the iOS rating build rolls out, most users have no radiusRating yet, so
// we fall back to their Game IQ number + IQ tier. Rated users show on the rating
// scale; unrated users show on the IQ scale, each with its own tier.
export interface RatingDisplay {
  value: number;       // the number to render
  isRating: boolean;   // true = Radius Rating, false = Game IQ fallback
  rank: Rank;          // tier/level for badge + color
  label: string;       // "Radius Rating" | "Game IQ"
  shortLabel: string;  // "Rating" | "Game IQ"
  provisional: boolean;
  hasValue: boolean;   // false = unrated with no IQ either
}

export function resolveRating(opts: {
  radiusRating?: number | null;
  radiusRatingProvisional?: boolean | null;
  gameIQ?: number | null;
}): RatingDisplay {
  const rr = opts.radiusRating;
  if (typeof rr === "number" && rr > 0) {
    return { value: rr, isRating: true, rank: rankForRating(rr), label: "Radius Rating", shortLabel: "Rating", provisional: !!opts.radiusRatingProvisional, hasValue: true };
  }
  const iq = opts.gameIQ ?? 0;
  return { value: iq, isRating: false, rank: rankForIQ(iq), label: "Game IQ", shortLabel: "Game IQ", provisional: false, hasValue: iq > 0 };
}
