// Verbatim port of the iOS Improve drill libraries + benchmark tiers (MyBagView 2.swift, the live " 2"
// build). Copy, minutes, levels, and tier numbers are exact — do not paraphrase.

export type Skill = "Putting" | "Shot Execution" | "Course Management";
export type LeakId = "putting" | "tee" | "approach" | "short";

// iOS weeklyFocusSkill: putting→Putting, off-the-tee→Shot Execution, approach/around-the-green→Course Mgmt.
export function skillForLeak(id: LeakId): Skill {
  if (id === "putting") return "Putting";
  if (id === "tee") return "Shot Execution";
  return "Course Management";
}
const SKILL_LABEL: Record<Skill, string> = { "Putting": "Putting", "Shot Execution": "Driving", "Course Management": "Course management" };
export const skillLabel = (s: Skill) => SKILL_LABEL[s];

// ---- THIS WEEK'S PLAN — radiusPlanDrills(for:) (3 per skill; renders "{minutes} min · {goal}") ----
export interface PlanDrill { title: string; goal: string; minutes: number; level: string }
export const PLAN_DRILLS: Record<Skill, PlanDrill[]> = {
  "Putting": [
    { title: "C1 Putt Challenge", goal: "Make 8 of 10 putts from 20ft", minutes: 10, level: "Core" },
    { title: "Pressure Putt Ladder", goal: "10/15/20/25ft — restart on any miss", minutes: 15, level: "Advanced" },
    { title: "C2 Money Putts", goal: "Make 5 of 10 from 35ft", minutes: 15, level: "Advanced" },
  ],
  "Shot Execution": [
    { title: "Fairway Finder", goal: "Hit 8 of 10 fairways from the tee", minutes: 20, level: "Core" },
    { title: "Line Shaping", goal: "Land 6 of 10 drives within 30ft of target", minutes: 20, level: "Advanced" },
    { title: "Power Control", goal: "10 drives at 70% power — accuracy over distance", minutes: 15, level: "Starter" },
  ],
  "Course Management": [
    { title: "Smart Layup Practice", goal: "5 safe plays from OB-danger positions", minutes: 15, level: "Core" },
    { title: "Scramble Drill", goal: "Get up-and-down from 5 trouble positions", minutes: 20, level: "Advanced" },
    { title: "Upshot Accuracy", goal: "7 of 10 approaches inside C1 from 150ft", minutes: 20, level: "Advanced" },
  ],
};

// ---- TODAY'S MOVE — radiusDailyMission pools (title + goal), rotated by day-of-year ----
export interface Mission { title: string; goal: string }
export const MISSION_POOL: Record<Skill, Mission[]> = {
  "Putting": [
    { title: "C1 Putt Challenge", goal: "Make 8 out of 10 putts from 20ft" },
    { title: "Pressure Putt Ladder", goal: "10ft, 15ft, 20ft, 25ft — restart on a miss" },
    { title: "C2 Money Putts", goal: "Make 5 out of 10 from 35ft" },
    { title: "Straddle vs Stagger", goal: "Alternate straddle and stagger putts, 10 each from 25ft" },
    { title: "Circle Edge Drill", goal: "Make 7 out of 10 from the C1 edge (33ft)" },
    { title: "Wind Putt Practice", goal: "Practice putts with nose-down release into wind, 10 from 20ft" },
    { title: "Comeback Putts", goal: "Miss long intentionally, then make the comebacker — 8 reps" },
  ],
  "Shot Execution": [
    { title: "Line Shaping", goal: "Land 6 out of 10 drives within 30ft of target" },
    { title: "Fairway Finder", goal: "Hit 8 out of 10 fairways from the tee" },
    { title: "Power Control", goal: "Throw 10 drives at 70% power — focus on accuracy over distance" },
    { title: "Hyzer vs Anhyzer", goal: "Alternate 5 hyzer and 5 anhyzer drives to the same target" },
    { title: "Standstill Drives", goal: "Throw 10 standstill drives — focus on clean release" },
    { title: "Distance Challenge", goal: "Find your max distance with 3 different discs, 3 throws each" },
  ],
  "Course Management": [
    { title: "Scramble Drill", goal: "Get up-and-down from 5 trouble positions" },
    { title: "Smart Layup Practice", goal: "Make 5 safe plays from OB-danger positions" },
    { title: "Upshot Accuracy", goal: "Place 7 out of 10 approach shots inside C1 from 150ft" },
    { title: "Obstacle Escape", goal: "Navigate 5 different obstructed lies to open fairway" },
    { title: "Touch Shot Clinic", goal: "Throw 10 low-ceiling approach shots under branches" },
    { title: "Forehand Recovery", goal: "Practice 8 forehand escape shots from awkward stances" },
  ],
};

// ---- Interactive putting drills — radiusPuttingDrills (the app's GPS trainer; web shows as reference) ----
export interface PuttingDrill { name: string; sharpens: string; detail: string; band: string }
export const PUTTING_DRILLS: PuttingDrill[] = [
  { name: "Stations", sharpens: "Consistency at a distance", detail: "A ring of putts at one set band — make the loop.", band: "16–25 ft" },
  { name: "Around the World", sharpens: "All-around C1 + C2", detail: "Work around Circle 1, then Circle 2 — one from each spot.", band: "20–66 ft" },
  { name: "Pressure Ladder", sharpens: "Clutch C1 putting", detail: "Climb 10→33 ft; one miss restarts you. Reach the top.", band: "0–33 ft" },
  { name: "Speed Run", sharpens: "Putt under the clock", detail: "60-second sprint from 18 ft — how many can you bury?", band: "0–20 ft" },
  { name: "Step-Back", sharpens: "Your range ceiling", detail: "Every make pushes you farther back — how deep can you go?", band: "26–66 ft" },
  { name: "C1X Grinder", sharpens: "The 20–33 ft dead zone", detail: "High volume where rounds are won and lost.", band: "20–33 ft" },
  { name: "C2 Bombs", sharpens: "Circle 2 range", detail: "Bomb from 40–60 ft — build deep range.", band: "34–66 ft" },
  { name: "Money Round", sharpens: "Round-ending pressure", detail: "One putt each, scored — simulate the finish.", band: "26–66 ft" },
];

/** Today's mission for the focus skill — deterministic daily rotation (iOS radiusDailyMission by day-of-year). */
export function missionFor(skill: Skill, dayOfYear: number): Mission {
  const pool = MISSION_POOL[skill];
  return pool[dayOfYear % pool.length];
}

// ---- Benchmark tiers. Putting = iOS puttingBenchmarkSheet; drive distance = iOS ArmSpeed tiers. ----
// iOS defines NO tier tables for fairway %, approach proximity, or scramble % — so we don't invent them.
export interface Tier { name: string; start: number; end: number }
export const C1_TIERS: Tier[] = [{ name: "Beginner", start: 50, end: 65 }, { name: "Intermediate", start: 65, end: 80 }, { name: "Advanced", start: 80, end: 90 }, { name: "Pro", start: 90, end: 100 }];
export const C2_TIERS: Tier[] = [{ name: "Beginner", start: 0, end: 5 }, { name: "Intermediate", start: 5, end: 15 }, { name: "Advanced", start: 15, end: 25 }, { name: "Pro", start: 25, end: 40 }];
export const DRIVE_TIERS: Tier[] = [{ name: "Beginner", start: 0, end: 200 }, { name: "Rec", start: 200, end: 275 }, { name: "Intermediate", start: 275, end: 350 }, { name: "Advanced", start: 350, end: 425 }, { name: "Pro", start: 425, end: 500 }];

/** Local day-of-year (1..366). */
export function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86400000);
}
/** ISO-ish week key "YYYY-WW" for locking the weekly plan's checked state. */
export function weekKey(d: Date): string {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); // back to Monday
  const week = Math.ceil((((t.getTime() - new Date(t.getFullYear(), 0, 1).getTime()) / 86400000) + 1) / 7);
  return `${t.getFullYear()}-${week}`;
}
