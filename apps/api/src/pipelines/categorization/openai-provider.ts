// IGNORE THIS FILE - it is a future implementation

/**
import {
  buildCategorizationPrompt,
  buildCategoryList,
  fetchCategoryTree,
  type ParsedAIResponse,
  resolveCategories,
} from './provider-utils';
import type { CategorizationResult } from './pipeline.types';
import {
  AI_MAX_TOKENS,
  AI_TEMPERATURE,
  CATEGORY_SOURCE,
} from '@/lib/constants';
import { config } from '@/lib/config';
import { logger } from '@/middleware/logger';
import OpenAI from 'openai';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  client ??= new OpenAI({ apiKey: config.openaiApiKey });
  return client;
}

export async function categorizeWithOpenAI(
  description: string,
  amount: number,
  currency: string,
  userId: string
): Promise<CategorizationResult | null> {
  const threshold = config.aiConfidenceThreshold;

  try {
    const { topLevel, subcats } = await fetchCategoryTree(userId);
    const categoryList = buildCategoryList(topLevel, subcats);
    const prompt = buildCategorizationPrompt(
      description,
      amount,
      currency,
      categoryList
    );

    const response = await getClient().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: AI_TEMPERATURE,
      max_tokens: AI_MAX_TOKENS,
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) return null;

    const clean = raw.replace(/```json\n?|\n?```/g, '').trim();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const parsed: ParsedAIResponse = JSON.parse(clean);

    if (parsed.confidence < threshold) {
      logger.debug(
        {
          description,
          confidence: parsed.confidence,
          threshold,
          provider: 'openai',
        },
        'AI confidence below threshold — falling through to default'
      );
      return null;
    }

    const resolved = resolveCategories(
      parsed.category,
      parsed.subcategory,
      topLevel,
      subcats
    );
    if (!resolved) {
      logger.warn(
        { description, category: parsed.category, provider: 'openai' },
        'AI returned unknown category'
      );
      return null;
    }

    return {
      ...resolved,
      needWant: parsed.need_want,
      categorySource: CATEGORY_SOURCE.AI,
      categoryConfidence: parsed.confidence,
      sourceName: null,
      flaggedForReview: false,
    };
  } catch (err) {
    logger.error(
      { err, description },
      'OpenAI categorization failed — falling through'
    );
    return null;
  }
}
*/
