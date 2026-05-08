import { describe, expect, it } from 'vitest';

import { CONFIDENCE } from '@/lib/constants';
import { CATEGORY_SOURCE } from '@finance/shared/constants';

import { applyRules } from './rules-engine';
import type { LoadedRule } from './rules-engine';

function makeRule(overrides: Partial<LoadedRule> = {}): LoadedRule {
  return {
    id: 'rule-1',
    userId: 'user-1',
    keyword: 'netflix',
    sourceName: null,
    categoryId: 'cat-1',
    subcategoryId: 'subcat-1',
    needWant: 'Want',
    flagForReview: false,
    priority: 10,
    ...overrides,
  };
}

describe('applyRules', () => {
  it('returns null when the rules array is empty', () => {
    expect(applyRules('NETFLIX DIGITAL', [])).toBeNull();
  });

  it('matches when the keyword appears in the description', () => {
    const rule = makeRule({ keyword: 'netflix', categoryId: 'cat-1', subcategoryId: 'subcat-1', needWant: 'Want', sourceName: 'NETFLIX' });
    const result = applyRules('NETFLIX DIGITAL', [rule]);

    expect(result).toEqual({
      categoryId: 'cat-1',
      subcategoryId: 'subcat-1',
      needWant: 'Want',
      categorySource: CATEGORY_SOURCE.RULE,
      categoryConfidence: CONFIDENCE.RULE,
      sourceName: 'NETFLIX',
      flaggedForReview: false,
    });
  });

  it('is case-insensitive — uppercase description matches lowercase keyword', () => {
    const rule = makeRule({ keyword: 'starbucks' });
    expect(applyRules('STARBUCKS COFFEE', [rule])).not.toBeNull();
  });

  it('returns null when the keyword does not appear in the description', () => {
    const rule = makeRule({ keyword: 'netflix' });
    expect(applyRules('AMAZON PRIME', [rule])).toBeNull();
  });

  it('higher-priority rule wins when multiple rules match', () => {
    // loadRules returns rules sorted priority DESC, so the caller must pass
    // them in that order. applyRules returns the first match.
    const highPriority = makeRule({ id: 'rule-high', keyword: 'amazon', categoryId: 'cat-high', priority: 20 });
    const lowPriority = makeRule({ id: 'rule-low', keyword: 'amazon', categoryId: 'cat-low', priority: 5 });

    const result = applyRules('AMAZON PRIME', [highPriority, lowPriority]);

    expect(result?.categoryId).toBe('cat-high');
  });

  it('flagForReview rule flags for review without assigning a category', () => {
    const rule = makeRule({
      keyword: 'paypal',
      flagForReview: true,
      needWant: null,
      categoryId: null,
      subcategoryId: null,
      sourceName: 'PayPal',
    });
    const result = applyRules('PAYPAL TRANSFER', [rule]);

    expect(result).toEqual({
      categoryId: null,
      subcategoryId: null,
      needWant: null,
      categorySource: CATEGORY_SOURCE.RULE,
      categoryConfidence: CONFIDENCE.RULE,
      sourceName: 'PayPal',
      flaggedForReview: true,
    });
  });

  it('flagForReview rule stops matching — later rules are not evaluated', () => {
    const reviewRule = makeRule({ id: 'rule-review', keyword: 'transfer', flagForReview: true, needWant: null, priority: 20 });
    const normalRule = makeRule({ id: 'rule-normal', keyword: 'transfer', needWant: 'Need', categoryId: 'cat-normal', priority: 5 });

    const result = applyRules('e-TRANSFER DEBIT', [reviewRule, normalRule]);

    expect(result?.flaggedForReview).toBe(true);
    expect(result?.categoryId).toBeNull();
  });
});
