import { and, eq } from 'drizzle-orm';
import { applyRules, type LoadedRule, loadRules } from './rules-engine';
import { categories } from '@/db/schema';
import type { CategorizationResult } from './pipeline.types';
//import { categorizeWithAnthropic } from './anthropic-provider';
//import { categorizeWithOpenAI } from './openai-provider';
import { CONFIDENCE } from '@/lib/constants';
import { CATEGORY_SOURCE } from '@finance/shared/constants';
//import { config } from '@/lib/config';
import { db } from '@/db';

// IGNORE THE AI RELATED IMPLEMENTATIONS FOR NOW - They will be implemented in the future


// Re-export for callers that batch-load rules before a loop (e.g. import pipeline)
export { loadRules } from './rules-engine';
export type { Rule, LoadedRule } from './rules-engine';

class LruCache<K, V> {
  private readonly capacity: number;
  private readonly map: Map<K, V>;
  constructor(capacity: number) {
    this.capacity = capacity;
    this.map = new Map();
  }
  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value === undefined) return undefined;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }
  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.capacity) {
      // Map preserves insertion order; first key is the least recently used
      const lruKey = this.map.keys().next().value as K;
      this.map.delete(lruKey);
    }
    this.map.set(key, value);
  }
}

const UNCATEGORIZED_CACHE_SIZE = 10_000;
const uncategorizedIdCache = new LruCache<string, string>(UNCATEGORIZED_CACHE_SIZE);

async function getUncategorizedId(userId: string): Promise<string> {
  const cached = uncategorizedIdCache.get(userId);
  if (cached) return cached;

  const [cat] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(eq(categories.userId, userId), eq(categories.name, 'Uncategorized'))
    )
    .limit(1);

  if (!cat)
    throw new Error(
      `Uncategorized category not found for user ${userId}. Ensure the user was registered with category seeding.`
    );

  uncategorizedIdCache.set(userId, cat.id);
  return cat.id;
}

// const AI_ENABLED = () => config.aiEnabled;

/**
 * Select and call the configured AI provider.
 * Returns null on failure or low confidence — caller handles fallback.
 */
/**
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
*/
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
  if (ruleResult) {
    // needWant is only meaningful for expenses — income transactions must have null
    if (amount > 0) ruleResult.needWant = null;
    return ruleResult;
  }

  // Step 2: AI provider (feature-flagged, provider configurable)
  /*
  if (AI_ENABLED()) {
    const aiResult = await runAiProvider(description, amount, currency, userId);
    if (aiResult) return aiResult;
  }
*/
  // Step 3: Fallback — user's Uncategorized category
  const fallbackId = await getUncategorizedId(userId);
  return {
    categoryId: fallbackId,
    subcategoryId: null,
    needWant: null,
    categorySource: CATEGORY_SOURCE.DEFAULT,
    categoryConfidence: CONFIDENCE.DEFAULT,
    sourceName: null,
    flaggedForReview: true,
  };
}
