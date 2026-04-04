import { and, eq, isNull } from 'drizzle-orm';
import { applyRules, type LoadedRule, loadRules } from './rules-engine';
import { categories } from '@/db/schema';
import type { CategorizationResult } from './pipeline.types';
import { categorizeWithAnthropic } from './anthropic-provider';
import { categorizeWithOpenAI } from './openai-provider';
import { config } from '@/lib/config';
import { db } from '@/db';

// Re-export for callers that batch-load rules before a loop (e.g. import pipeline)
export { loadRules } from './rules-engine';
export type { Rule, LoadedRule } from './rules-engine';

let uncategorizedId: string | null = null;

async function getUncategorizedId(): Promise<string> {
  if (uncategorizedId) return uncategorizedId;

  const [cat] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(isNull(categories.userId), eq(categories.name, 'Uncategorized')))
    .limit(1);

  if (!cat)
    throw new Error(
      'Uncategorized system category not found. Run db:seed first.'
    );

  uncategorizedId = cat.id;
  return cat.id;
}

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
 *   3. Fallback      — Uncategorized + flagged for review
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
  if (ruleResult) return ruleResult;

  // Step 2: AI provider (feature-flagged, provider configurable)
  if (AI_ENABLED()) {
    const aiResult = await runAiProvider(description, amount, currency, userId);
    if (aiResult) return aiResult;
  }

  // Step 3: Fallback — Uncategorized
  const fallbackId = await getUncategorizedId();
  return {
    categoryId: fallbackId,
    subcategoryId: null,
    needWant: null,
    categorySource: 'default',
    categoryConfidence: 0,
    sourceName: null,
    flaggedForReview: true,
  };
}
