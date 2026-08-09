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
