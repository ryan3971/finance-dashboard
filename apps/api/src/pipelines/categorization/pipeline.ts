import { applyRules, type LoadedRule, loadRules } from './rules-engine';
import type { CategorizationResult } from './pipeline.types';
import { categorizeWithAnthropic } from './anthropic-provider';
import { categorizeWithOpenAI } from './openai-provider';
import { CONFIDENCE } from '@/lib/constants';
import { CATEGORY_SOURCE } from '@finance/shared/constants';
import { config } from '@/lib/config';

// Re-export for callers that batch-load rules before a loop (e.g. import pipeline)
export { loadRules } from './rules-engine';
export type { Rule, LoadedRule } from './rules-engine';

const AI_ENABLED = () => config.aiEnabled;

/**
 * Select and call the configured AI provider.
 * Returns null on failure or low confidence — caller handles fallback.
 */
async function runAiProvider(
  description: string,
  amount: number,
  currency: string,
  userId: string
): Promise<CategorizationResult | null> {
  const provider = config.aiProvider;

  if (provider === 'openai') {
    return categorizeWithOpenAI(description, amount, currency, userId);
  }
  // Default: Anthropic Claude Haiku
  return categorizeWithAnthropic(description, amount, currency, userId);
}

/**
 * Categorize a single transaction.
 *
 * Pipeline:
 *   1. Rules engine  — deterministic, free, handles known merchants
 *   2. AI provider   — handles novel merchants (Anthropic or OpenAI, feature-flagged)
 *   3. Fallback      — categoryId: null + flagged for review
 *
 * Pass `rules` when categorizing in a batch to avoid a per-call DB fetch.
 * Omit it (or pass undefined) for one-off categorization.
 */
export async function categorize(
  description: string,
  userId: string,
  amount: number,
  currency: string,
  rules?: LoadedRule[]
): Promise<CategorizationResult> {
  // Step 1: Rules engine
  const ruleResult = rules
    ? applyRules(description, rules)
    : await loadRules(userId).then((r) => applyRules(description, r));
  if (ruleResult) {
    // needWant is only meaningful for expenses — income transactions must have null
    if (amount > 0) ruleResult.needWant = null;
    return ruleResult;
  }

  // Step 2: AI provider (feature-flagged, provider configurable)
  if (AI_ENABLED()) {
    const aiResult = await runAiProvider(description, amount, currency, userId);
    if (aiResult) {
      if (amount > 0) aiResult.needWant = null;
      return aiResult;
    }
  }

  // Step 3: Fallback — no category assigned, flagged for user review
  return {
    categoryId: null,
    subcategoryId: null,
    needWant: null,
    categorySource: CATEGORY_SOURCE.DEFAULT,
    categoryConfidence: CONFIDENCE.DEFAULT,
    sourceName: null,
    flaggedForReview: true,
  };
}
