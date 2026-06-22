/**
 * Claude-powered insights. Mirrors the iOS ClaudeClient.swift: the user's own
 * Anthropic key (stored only in the browser), model claude-opus-4-8, a short
 * coaching system prompt, ≤180 words of actionable guidance.
 */

import Anthropic from '@anthropic-ai/sdk';
import { scoreBreakdown } from '../shared/sleepScore';
import { dayShort, offsetSeconds, timeHMM } from '../shared/time';
import type { SleepSession, StressSession } from '../shared/types';

export const CLAUDE_MODEL = 'claude-opus-4-8';

export class MissingApiKeyError extends Error {
  constructor() {
    super('Add your Anthropic API key in Settings to get AI insights.');
    this.name = 'MissingApiKeyError';
  }
}

const SLEEP_SYSTEM =
  'You are a sleep coach. Given a sleep session summary with detected snoring, ' +
  'hypopnea, and obstructive apnea events, give 3-4 specific, kind, actionable ' +
  'suggestions to improve sleep quality. Keep it under 180 words.';

const STRESS_SYSTEM =
  'You are a focus coach. Given a work session summary with stress signals, ' +
  'give 3-4 specific, kind, actionable suggestions to reduce stress while ' +
  'working. Keep it under 180 words.';

function client(apiKey: string): Anthropic {
  if (!apiKey || apiKey.trim().length === 0) throw new MissingApiKeyError();
  return new Anthropic({ apiKey: apiKey.trim(), dangerouslyAllowBrowser: true });
}

async function ask(apiKey: string, system: string, prompt: string): Promise<string> {
  const res = await client(apiKey).messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 600,
    system,
    messages: [{ role: 'user', content: prompt }],
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

export async function sleepInsights(
  apiKey: string,
  s: SleepSession,
): Promise<string> {
  const labels = [
    ...s.hypopneaTimestamps.map((t) => ({ id: t, kind: 'hypopnea' as const, start: t, duration: 10 })),
    ...s.obstructiveTimestamps.map((t) => ({ id: t, kind: 'obstructive_apnea' as const, start: t, duration: 10 })),
    ...s.snoringTimestamps.map((t) => ({ id: t, kind: 'snoring' as const, start: t, duration: 10 })),
  ];
  const breakdown = scoreBreakdown(labels, s.start);
  const prompt = [
    `Sleep session on ${dayShort(s.start)} from ${timeHMM(s.start)} to ${timeHMM(s.end)}.`,
    `Sleep score: ${s.sleepScore}/100.`,
    `Snoring events: ${s.snoringTimestamps.length}.`,
    `Hypopnea events: ${s.hypopneaTimestamps.length}.`,
    `Obstructive apnea events: ${s.obstructiveTimestamps.length}.`,
    breakdown.length ? `Notable windows: ${breakdown.join('; ')}.` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return ask(apiKey, SLEEP_SYSTEM, prompt);
}

export async function stressInsights(
  apiKey: string,
  s: StressSession,
): Promise<string> {
  const durationMin = Math.round(offsetSeconds(s.start, s.end) / 60);
  const prompt = [
    `Work session on ${dayShort(s.start)} from ${timeHMM(s.start)} to ${timeHMM(s.end)} (${durationMin} min).`,
    `Calmness score: ${s.stressScore}/100 (100 = perfectly calm).`,
    `Number of stressed moments flagged: ${s.stressedTimestamps.length}.`,
  ].join('\n');
  return ask(apiKey, STRESS_SYSTEM, prompt);
}
