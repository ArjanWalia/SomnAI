/** Presentation helpers for scores and labels. */

import type { SleepLabelKind } from '../shared/types';

/** A 0–100 score → a tint color (red → amber → green). */
export function scoreColor(score: number): string {
  if (score >= 85) return '#5fd6a0';
  if (score >= 70) return '#9ad26a';
  if (score >= 50) return '#f5c451';
  if (score >= 30) return '#f59a51';
  return '#f56b5f';
}

export function scoreLabel(score: number): string {
  if (score >= 85) return 'Great';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Fair';
  if (score >= 30) return 'Poor';
  return 'Rough';
}

export const SLEEP_LABEL_META: Record<
  Exclude<SleepLabelKind, 'no_apnea'>,
  { title: string; color: string }
> = {
  snoring: { title: 'Snoring', color: '#7399ff' },
  hypopnea: { title: 'Hypopnea', color: '#c08bff' },
  obstructive_apnea: { title: 'Obstructive Apnea', color: '#ff8c80' },
};
