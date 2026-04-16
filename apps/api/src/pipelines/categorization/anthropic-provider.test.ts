// IGNORE THIS FILE - it is a future implementation

/**
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
}));

vi.mock('./provider-utils', () => ({
  fetchCategoryTree: vi.fn().mockResolvedValue({ topLevel: [], subcats: [] }),
  buildCategoryList: vi
    .fn()
    .mockReturnValue('Food (Groceries)\nTransport (Gas)'),
  buildCategorizationPrompt: vi.fn().mockReturnValue('mock prompt'),
  resolveCategories: vi.fn().mockReturnValue(null),
}));

import Anthropic from '@anthropic-ai/sdk';

import { categorizeWithAnthropic } from './anthropic-provider';

const mockCreate = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  (Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
    messages: { create: mockCreate },
  }));
  process.env.ANTHROPIC_API_KEY = 'test-key';
  process.env.AI_CONFIDENCE_THRESHOLD = '0.70';
});

describe('categorizeWithAnthropic', () => {
  it('returns null on API error without throwing', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Network error'));
    const result = await categorizeWithAnthropic(
      'starbucks',
      -5.5,
      'CAD',
      'user-1'
    );
    expect(result).toBeNull();
  });

  it('returns null when confidence is below threshold', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            category: 'Food',
            subcategory: 'Coffee',
            need_want: 'Want',
            confidence: 0.5,
            reasoning: 'Starbucks is a coffee shop',
          }),
        },
      ],
    });
    const result = await categorizeWithAnthropic(
      'starbucks',
      -5.5,
      'CAD',
      'user-1'
    );
    expect(result).toBeNull();
  });

  it('strips markdown fences from response before parsing', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          // Model occasionally wraps JSON in markdown despite instructions
          text: '```json\n{"category":"Food","subcategory":"Coffee","need_want":"Want","confidence":0.90,"reasoning":"test"}\n```',
        },
      ],
    });
    // Should not throw a JSON parse error
    // Result will be null because category resolution requires a real DB
    // — the important thing is no exception is thrown
    await expect(
      categorizeWithAnthropic('starbucks', -5.5, 'CAD', 'user-1')
    ).resolves.not.toThrow();
  });
});
 */
