/**
 * The "label checking algorithm" from the spec, implemented faithfully.
 *
 * Procedure (per spec):
 *   1. Find the initial (earliest not-yet-visited) label.
 *   2. Grab all labels within one hour of that label's start (start … start+60m).
 *   3. Count how many are in the SAME category as the initial label.
 *   4. Check that count against the category's conditional and pick a weight.
 *   5. Store the label type and the window end (start + 60m).
 *   6. Mark the consumed same-category labels visited and keep iterating until a
 *      never-visited label appears or we pass 60 minutes from the initial label.
 *   7. Repeat from the next unvisited label.
 *
 * Weights are applied "for every group of 5 labels that are present" — see
 * GROUP_SIZE / DEGRADATION_RULES in constants.ts. A window whose count clears
 * its category threshold always applies its weight at least once (covering
 * rules like obstructive apnea's ">3", which never reaches a full group of 5),
 * and once more for each additional whole group of 5.
 */

import {
  DEGRADATION_RULES,
  GROUP_SIZE,
  LABEL_WINDOW_SECONDS,
} from './constants';
import type { LabelEvent, OffsetSeconds, SleepLabelKind } from './types';

export interface ScoringWindow {
  /** Category of the initial label that anchored this window. */
  kind: SleepLabelKind;
  /** Start offset (seconds) of the anchoring label. */
  startSec: OffsetSeconds;
  /** Window end = start + 60 minutes (the stored "60 + start time"). */
  endSec: OffsetSeconds;
  /** Same-category labels found inside the window (including the anchor). */
  sameCategoryCount: number;
  /** Multiplier from the matched band, or 1 if no band matched. */
  weight: number;
  /** How many times `weight` is applied (per group of 5). */
  applications: number;
  /** weight ** applications — the net factor this window contributes. */
  multiplier: number;
}

/** Merge a sleep session's three label arrays into one chronological list. */
export function flattenSleepLabels(input: {
  hypopnea_timestamps: OffsetSeconds[];
  obstructive_apnea_timestamps: OffsetSeconds[];
  snoring_timestamps: OffsetSeconds[];
}): LabelEvent[] {
  const events: LabelEvent[] = [
    ...input.hypopnea_timestamps.map((s) => ({ kind: 'hypopnea' as const, startSec: s })),
    ...input.obstructive_apnea_timestamps.map((s) => ({
      kind: 'obstructive_apnea' as const,
      startSec: s,
    })),
    ...input.snoring_timestamps.map((s) => ({ kind: 'snoring' as const, startSec: s })),
  ];
  return events.sort((a, b) => a.startSec - b.startSec);
}

/** Pick the weight for a given category + same-category count (1 = no penalty). */
export function weightForCount(kind: SleepLabelKind, count: number): number {
  for (const rule of DEGRADATION_RULES[kind] ?? []) {
    if (count >= rule.minCount && count <= rule.maxCount) return rule.weight;
  }
  return 1;
}

/**
 * Walk the labels and produce one ScoringWindow per anchored category window.
 * Pure and deterministic: same input -> same windows.
 */
export function computeScoringWindows(labels: LabelEvent[]): ScoringWindow[] {
  const sorted = [...labels].sort((a, b) => a.startSec - b.startSec);
  const visited = new Array<boolean>(sorted.length).fill(false);
  const windows: ScoringWindow[] = [];

  for (let i = 0; i < sorted.length; i++) {
    if (visited[i]) continue;

    const anchor = sorted[i];
    const startSec = anchor.startSec;
    const endSec = startSec + LABEL_WINDOW_SECONDS;
    const kind = anchor.kind;

    // Count + consume same-category labels within [start, start+60m).
    let sameCategoryCount = 0;
    for (let j = i; j < sorted.length; j++) {
      if (sorted[j].startSec >= endSec) break; // past 60 minutes -> stop
      if (visited[j]) continue;
      if (sorted[j].kind === kind) {
        sameCategoryCount++;
        visited[j] = true;
      }
    }

    const weight = weightForCount(kind, sameCategoryCount);
    const groups = Math.floor(sameCategoryCount / GROUP_SIZE);
    // A matched band applies at least once; each extra group of 5 compounds it.
    const applications = weight === 1 ? 0 : Math.max(1, groups);
    const multiplier = weight ** applications;

    windows.push({
      kind,
      startSec,
      endSec,
      sameCategoryCount,
      weight,
      applications,
      multiplier,
    });
  }

  return windows;
}
