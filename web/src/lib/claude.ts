/**
 * Claude-powered insights.
 *
 * The user supplies their own Anthropic API key (entered in Settings, stored
 * only in their browser's localStorage — never sent to our backend). We call
 * the official SDK directly from the browser with `dangerouslyAllowBrowser`,
 * which is appropriate here precisely because it is the user's own key making
 * requests on their own behalf.
 *
 * Model: claude-opus-4-8. Thinking is left off and the system prompt asks for a
 * final answer only, so insights come back fast and bounded for the UI.
 */

import Anthropic from '@anthropic-ai/sdk';
import { SLEEP_LABEL_NAMES } from '../shared/constants';
import { countLabels, computeSleepScore } from '../shared/sleepScore';
import { formatDayLong } from '../shared/time';
import type { SleepSession, StressSession } from '../shared/types';

const MODEL = 'claude-opus-4-8';

const SYSTEM_PROMPT = `You are SomnAI's sleep and stress coach. Given a summary of \
one of the user's recorded sessions, give brief, warm, practical guidance on how \
they could improve. Be specific and evidence-informed; avoid medical alarmism and \
remind them you are not a doctor only if findings are significant.

Respond with ONLY the final guidance — no preamble, no meta-commentary, no \
restating the data. Use at most 4 short markdown bullet points, then one \
encouraging closing sentence.`;

export class MissingApiKeyError extends Error {
  constructor() {
    super('Add your Claude API key in Settings to get AI insights.');
    this.name = 'MissingApiKeyError';
  }
}

async function generate(apiKey: string, userPrompt: string): Promise<string> {
  if (!apiKey) throw new MissingApiKeyError();
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

/** Insights for a night of sleep, grounded in the labels + score breakdown. */
export function sleepInsights(apiKey: string, session: SleepSession): Promise<string> {
  const counts = countLabels(session);
  const { windows } = computeSleepScore(session);
  const breakdown = windows
    .filter((w) => w.weight !== 1)
    .map(
      (w) =>
        `- ${SLEEP_LABEL_NAMES[w.kind]}: ${w.sameCategoryCount} events in the hour ` +
        `from ${Math.round(w.startSec / 60)}min (factor x${w.weight})`,
    )
    .join('\n');

  const prompt = `Sleep session on ${formatDayLong(session.date)}.
Sleep score: ${session.sleep_score}/100.
Event totals — Hypopnea: ${counts.hypopnea}, Obstructive Apnea: ${counts.obstructive_apnea}, Snoring: ${counts.snoring}.
${breakdown ? `What lowered the score:\n${breakdown}` : 'No score penalties were triggered.'}

How can the user sleep more soundly and reduce these events?`;
  return generate(apiKey, prompt);
}

/** Insights for a work (stress) session. */
export function stressInsights(apiKey: string, session: StressSession): Promise<string> {
  const prompt = `Work session on ${formatDayLong(session.date)}.
Calmness/stress score: ${session.stress_score}/100 (100 = perfectly calm).
Number of moments flagged as stressed: ${session.stressed_timestamps.length}.

How can the user stay calmer and less stressed while working?`;
  return generate(apiKey, prompt);
}
