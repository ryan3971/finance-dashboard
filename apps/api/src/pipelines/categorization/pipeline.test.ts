import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIDENCE } from '@/lib/constants';
import { CATEGORY_SOURCE } from '@finance/shared/constants';

vi.mock('@/lib/config', () => ({
  config: {
    aiEnabled: false,
    aiProvider: 'anthropic',
    aiConfidenceThreshold: 0.7,
    anthropicApiKey: '',
    openaiApiKey: '',
  },
}));

vi.mock('./anthropic-provider', () => ({
  categorizeWithAnthropic: vi.fn(),
}));

vi.mock('./openai-provider', () => ({
  categorizeWithOpenAI: vi.fn(),
}));

import { config } from '@/lib/config';
import { categorizeWithAnthropic } from './anthropic-provider';
import { categorizeWithOpenAI } from './openai-provider';
import { categorize } from './pipeline';
import type { LoadedRule } from './rules-engine';

interface MutableConfig {
  aiEnabled: boolean;
  aiProvider: string;
}

function makeRule(overrides: Partial<LoadedRule> = {}): LoadedRule {
  // as LoadedRule: TypeScript can't prove Partial<LoadedRule> spreads never leave required fields undefined
  return {
    id: 'rule-1',
    userId: 'user-1',
    keyword: 'netflix',
    sourceName: 'NETFLIX',
    categoryId: 'cat-entertainment',
    subcategoryId: null,
    needWant: 'Want',
    flagForReview: false,
    priority: 10,
    matchType: 'substring',
    ...overrides,
  } as LoadedRule;
}

const aiSuccessResult = {
  categoryId: 'cat-food',
  subcategoryId: null,
  needWant: 'Want' as const,
  categorySource: CATEGORY_SOURCE.AI,
  categoryConfidence: 0.9,
  sourceName: null,
  flaggedForReview: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  (config as unknown as MutableConfig).aiEnabled = false;
  (config as unknown as MutableConfig).aiProvider = 'anthropic';
});

describe('categorize — rules engine', () => {
  it('returns the rule result when a rule matches', async () => {
    const rule = makeRule({ keyword: 'netflix', categoryId: 'cat-ent' });
    const result = await categorize('NETFLIX DIGITAL', 'user-1', -15.99, 'CAD', [rule]);

    expect(result.categorySource).toBe(CATEGORY_SOURCE.RULE);
    expect(result.categoryId).toBe('cat-ent');
    expect(result.flaggedForReview).toBe(false);
    expect(categorizeWithAnthropic).not.toHaveBeenCalled();
  });

  it('clears needWant to null for income (amount > 0) on a rule hit', async () => {
    const rule = makeRule({ keyword: 'salary', needWant: 'Need' });
    const result = await categorize('SALARY DEPOSIT', 'user-1', 3000, 'CAD', [rule]);

    expect(result.needWant).toBeNull();
  });

  it('preserves needWant for expense (amount < 0) on a rule hit', async () => {
    const rule = makeRule({ keyword: 'netflix', needWant: 'Want' });
    const result = await categorize('NETFLIX', 'user-1', -15.99, 'CAD', [rule]);

    expect(result.needWant).toBe('Want');
  });
});

describe('categorize — AI provider', () => {
  it('does not call the AI provider when aiEnabled is false', async () => {
    const result = await categorize('STARBUCKS', 'user-1', -5.5, 'CAD', []);

    expect(categorizeWithAnthropic).not.toHaveBeenCalled();
    expect(categorizeWithOpenAI).not.toHaveBeenCalled();
    expect(result.categorySource).toBe(CATEGORY_SOURCE.DEFAULT);
  });

  it('calls the Anthropic provider when aiEnabled is true and provider is anthropic', async () => {
    (config as unknown as MutableConfig).aiEnabled = true;
     
    vi.mocked(categorizeWithAnthropic).mockResolvedValueOnce(aiSuccessResult);

    const result = await categorize('STARBUCKS', 'user-1', -5.5, 'CAD', []);

    expect(categorizeWithAnthropic).toHaveBeenCalledWith('STARBUCKS', -5.5, 'CAD', 'user-1');
    expect(categorizeWithOpenAI).not.toHaveBeenCalled();
    expect(result.categorySource).toBe(CATEGORY_SOURCE.AI);
  });

  it('calls the OpenAI provider when aiEnabled is true and provider is openai', async () => {
    (config as unknown as MutableConfig).aiEnabled = true;
    (config as unknown as MutableConfig).aiProvider = 'openai';
     
    vi.mocked(categorizeWithOpenAI).mockResolvedValueOnce(aiSuccessResult);

    await categorize('STARBUCKS', 'user-1', -5.5, 'CAD', []);

    expect(categorizeWithOpenAI).toHaveBeenCalled();
    expect(categorizeWithAnthropic).not.toHaveBeenCalled();
  });

  it('clears needWant to null for income (amount > 0) on an AI hit', async () => {
    (config as unknown as MutableConfig).aiEnabled = true;
     
    vi.mocked(categorizeWithAnthropic).mockResolvedValueOnce({
      ...aiSuccessResult,
      needWant: 'Want', // AI returned incorrect needWant for income
    });

    const result = await categorize('DIRECT DEPOSIT', 'user-1', 2500, 'CAD', []);

    expect(result.needWant).toBeNull();
  });

  it('falls back to default when the AI provider returns null', async () => {
    (config as unknown as MutableConfig).aiEnabled = true;
     
    vi.mocked(categorizeWithAnthropic).mockResolvedValueOnce(null);

    const result = await categorize('STARBUCKS', 'user-1', -5.5, 'CAD', []);

    expect(result.categorySource).toBe(CATEGORY_SOURCE.DEFAULT);
    expect(result.flaggedForReview).toBe(true);
  });
});

describe('categorize — fallback', () => {
  it('returns the default result when no rules match and AI is disabled', async () => {
    const result = await categorize('UNKNOWN MERCHANT XYZ', 'user-1', -50, 'CAD', []);

    expect(result).toEqual({
      categoryId: null,
      subcategoryId: null,
      needWant: null,
      categorySource: CATEGORY_SOURCE.DEFAULT,
      categoryConfidence: CONFIDENCE.DEFAULT,
      sourceName: null,
      flaggedForReview: true,
    });
  });
});
