// Distance display — mirrors iOS DistanceUtil exactly. All distances are stored in FEET internally;
// convert to meters only at display time when the viewer's `useMetric` profile flag is true.
// meters = trunc(feet * 0.3048) to match Int(Double(feet) * ftToM) on iOS.
export const FT_TO_M = 0.3048;

/** "350 ft" or "106 m" */
export function fmtDist(feet: number, metric: boolean): string {
  return metric ? `${Math.trunc(feet * FT_TO_M)} m` : `${Math.round(feet)} ft`;
}

/** Numeric value only, in the viewer's unit (no suffix). */
export function distValue(feet: number, metric: boolean): number {
  return metric ? Math.trunc(feet * FT_TO_M) : Math.round(feet);
}

/** Unit suffix only: "m" or "ft". */
export function distUnit(metric: boolean): string {
  return metric ? "m" : "ft";
}
