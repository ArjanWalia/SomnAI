/** Display helpers for scores and labels. */

/** Map a 0–100 score to a calm→stressed color (green → amber → red). */
export function scoreColor(score: number): string {
  if (score >= 80) return '#3ddc97'; // calm / good
  if (score >= 60) return '#7ee081';
  if (score >= 40) return '#f5c451'; // caution
  return '#ef6f6c'; // poor
}

/** A short qualitative label for a score. */
export function scoreLabel(score: number, kind: 'sleep' | 'stress'): string {
  if (kind === 'stress') {
    if (score >= 80) return 'Calm';
    if (score >= 60) return 'Steady';
    if (score >= 40) return 'Tense';
    return 'Stressed';
  }
  if (score >= 85) return 'Restful';
  if (score >= 70) return 'Fair';
  if (score >= 50) return 'Disrupted';
  return 'Poor';
}

export function roundScore(score: number): number {
  return Math.round(score * 10) / 10;
}
