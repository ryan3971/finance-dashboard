import { db } from '../../db';
import { categories } from '../../db/schema';
import { eq, isNull, and } from 'drizzle-orm';
import { runRulesEngine } from './rules-engine';
import { categorizeWithAnthropic } from './anthropic-provider';
import { categorizeWithOpenAI } from './openai-provider';
import type { CategorizationResult } from './pipeline.types';
import { config } from '../../lib/config';

let uncategorizedId: string | null = null;

async function getUncategorizedId(): Promise<string> {
  if (uncategorizedId) return uncategorizedId;

  const [cat] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(isNull(categories.userId), eq(categories.name, 'Uncategorized')))
    .limit(1);

  if (!cat) throw new Error('Uncategorized system category not found. Run db:seed first.');

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
 */
export async function categorize(
  description: string,
  userId: string,
  amount: number = 0,
  currency: string = 'CAD'
): Promise<CategorizationResult> {
  // Step 1: Rules engine
  const ruleResult = await runRulesEngine(description, userId);
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
