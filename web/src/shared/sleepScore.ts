/**
 * Sleep scoring — a direct port of SomnAI/SleepScoring.swift.
 *
 * Start at 100 and walk the labels (all three categories merged, sorted by
 * start). For each not-yet-visited anchor, form a 60-minute window, count the
 * same-category labels inside it (marking them visited), and apply that
 * category's multiplier once per group (of 5, or 3 for obstructive apnea).
 */

import {
  GROUP_SIZE,
  INITIAL_SLEEP_SCORE,
  LABEL_WINDOW_SECONDS,
  OBSTRUCTIVE_GROUP_SIZE,
  THRESHOLDS,
  WEIGHTS,
} from './constants';
import type { SleepLabel, SleepLabelKind } from './types';

/** A label reduced to the fields scoring needs. */
export interface ScorableLabel {
  id: string;
  kind: SleepLabelKind;
  /** Seconds from an arbitrary origin (only relative order/distance matters). */
  startSeconds: number;
}

export function computeSleepScoreFromLabels(labels: ScorableLabel[]): number {
  const sorted = labels
    .filter((l) => l.kind !== 'no_apnea')
    .sort((a, b) => a.startSeconds - b.startSeconds);
  if (sorted.length === 0) return INITIAL_SLEEP_SCORE;

  let score = INITIAL_SLEEP_SCORE;
  const visited = new Set<string>();

  for (const anchor of sorted) {
    if (visited.has(anchor.id)) continue;
    const windowEnd = anchor.startSeconds + LABEL_WINDOW_SECONDS;
    const inWindow = sorted.filter(
      (l) => l.startSeconds >= anchor.startSeconds && l.startSeconds < windowEnd,
    );
    for (const l of inWindow) visited.add(l.id);

    const snoring = inWindow.filter((l) => l.kind === 'snoring').length;
    const hypopnea = inWindow.filter((l) => l.kind === 'hypopnea').length;
    const obstructive = inWindow.filter(
      (l) => l.kind === 'obstructive_apnea',
    ).length;

    if (snoring > THRESHOLDS.snoring) {
      const groups = Math.max(1, Math.floor(snoring / GROUP_SIZE));
      score *= Math.pow(WEIGHTS.snoring, groups);
    }

    if (hypopnea >= THRESHOLDS.hypopneaHigh) {
      const groups = Math.max(1, Math.floor(hypopnea / GROUP_SIZE));
      score *= Math.pow(WEIGHTS.hypopneaHigh, groups);
    } else if (hypopnea >= THRESHOLDS.hypopneaLow) {
      const groups = Math.max(1, Math.floor(hypopnea / GROUP_SIZE));
      score *= Math.pow(WEIGHTS.hypopneaLow, groups);
    }

    if (obstructive > THRESHOLDS.obstructive) {
      const groups = Math.max(1, Math.floor(obstructive / OBSTRUCTIVE_GROUP_SIZE));
      score *= Math.pow(WEIGHTS.obstructive, groups);
    }
  }

  return clamp(score);
}

/** Convenience: score directly from the three Butterbase timestamp arrays. */
export function computeSleepScore(input: {
  hypopnea_timestamps: number[] | string[];
  obstructive_apnea_timestamps: number[] | string[];
  snoring_timestamps: number[] | string[];
}): number {
  const labels: ScorableLabel[] = [];
  pushAll(labels, input.hypopnea_timestamps, 'hypopnea');
  pushAll(labels, input.obstructive_apnea_timestamps, 'obstructive_apnea');
  pushAll(labels, input.snoring_timestamps, 'snoring');
  return computeSleepScoreFromLabels(labels);
}

/** Score a SleepSession built from absolute ISO timestamps. */
export function scoreSession(session: {
  start: string;
  hypopneaTimestamps: string[];
  obstructiveTimestamps: string[];
  snoringTimestamps: string[];
}): number {
  const origin = new Date(session.start).getTime();
  const toSec = (iso: string) => (new Date(iso).getTime() - origin) / 1000;
  const labels: ScorableLabel[] = [];
  session.hypopneaTimestamps.forEach((t, i) =>
    labels.push({ id: `h${i}`, kind: 'hypopnea', startSeconds: toSec(t) }),
  );
  session.obstructiveTimestamps.forEach((t, i) =>
    labels.push({ id: `o${i}`, kind: 'obstructive_apnea', startSeconds: toSec(t) }),
  );
  session.snoringTimestamps.forEach((t, i) =>
    labels.push({ id: `s${i}`, kind: 'snoring', startSeconds: toSec(t) }),
  );
  return computeSleepScoreFromLabels(labels);
}

function pushAll(
  out: ScorableLabel[],
  values: Array<number | string>,
  kind: SleepLabelKind,
) {
  values.forEach((v, i) => {
    const startSeconds =
      typeof v === 'number' ? v : new Date(v).getTime() / 1000;
    out.push({ id: `${kind}-${i}-${startSeconds}`, kind, startSeconds });
  });
}

function clamp(score: number): number {
  return Math.max(0, Math.min(INITIAL_SLEEP_SCORE, Math.round(score * 10) / 10));
}

/**
 * Which windows actually degraded the score — used to explain the result and
 * to give Claude something concrete to coach on.
 */
export function scoreBreakdown(labels: SleepLabel[], start: string): string[] {
  const origin = new Date(start).getTime();
  const scorable: ScorableLabel[] = labels
    .filter((l) => l.kind !== 'no_apnea')
    .map((l, i) => ({
      id: l.id ?? `${i}`,
      kind: l.kind,
      startSeconds: (new Date(l.start).getTime() - origin) / 1000,
    }))
    .sort((a, b) => a.startSeconds - b.startSeconds);

  const notes: string[] = [];
  const visited = new Set<string>();
  for (const anchor of scorable) {
    if (visited.has(anchor.id)) continue;
    const windowEnd = anchor.startSeconds + LABEL_WINDOW_SECONDS;
    const inWindow = scorable.filter(
      (l) => l.startSeconds >= anchor.startSeconds && l.startSeconds < windowEnd,
    );
    for (const l of inWindow) visited.add(l.id);
    const counts = {
      snoring: inWindow.filter((l) => l.kind === 'snoring').length,
      hypopnea: inWindow.filter((l) => l.kind === 'hypopnea').length,
      obstructive: inWindow.filter((l) => l.kind === 'obstructive_apnea').length,
    };
    if (counts.snoring > THRESHOLDS.snoring)
      notes.push(`${counts.snoring} snoring events in one hour`);
    if (counts.hypopnea >= THRESHOLDS.hypopneaLow)
      notes.push(`${counts.hypopnea} hypopnea events in one hour`);
    if (counts.obstructive > THRESHOLDS.obstructive)
      notes.push(`${counts.obstructive} obstructive apnea events in one hour`);
  }
  return notes;
}
