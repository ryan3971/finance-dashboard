import Anthropic from '@anthropic-ai/sdk';
import type { CategorizationResult } from './pipeline.types';
import { logger } from '../../middleware/logger';
import { config } from '../../lib/config';
import {
  fetchCategoryTree,
  buildCategoryList,
  buildCategorizationPrompt,
  resolveCategories,
  type ParsedAIResponse,
} from './provider-utils';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: config.anthropicApiKey });
  }
  return client;
}

export async function categorizeWithAnthropic(
  description: string,
  amount: number,
  currency: string,
  userId: string
): Promise<CategorizationResult | null> {
  const threshold = config.aiConfidenceThreshold;

  try {
    const { topLevel, subcats } = await fetchCategoryTree(userId);
    const categoryList = buildCategoryList(topLevel, subcats);
    const prompt = buildCategorizationPrompt(description, amount, currency, categoryList);

    const response = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content[0]?.type === 'text' ? response.content[0].text : null;
    if (!raw) return null;

    // Strip any markdown fences the model might add despite instructions
    const clean = raw.replace(/```json\n?|\n?```/g, '').trim();
    const parsed: ParsedAIResponse = JSON.parse(clean);

    if (parsed.confidence < threshold) {
      logger.debug(
        { description, confidence: parsed.confidence, threshold, provider: 'anthropic' },
        'AI confidence below threshold — falling through to default'
      );
      return null;
    }

    const resolved = resolveCategories(parsed.category, parsed.subcategory, topLevel, subcats);
    if (!resolved) {
      logger.warn(
        { description, category: parsed.category, provider: 'anthropic' },
        'AI returned unknown category'
      );
      return null;
    }

    return {
      ...resolved,
      needWant: parsed.need_want,
      categorySource: 'ai',
      categoryConfidence: parsed.confidence,
      sourceName: null,
      flaggedForReview: false,
    };
  } catch (err) {
    logger.error({ err, description }, 'Anthropic categorization failed — falling through');
    return null;
  }
}