import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: vi.fn() } },
  })),
}));

vi.mock('./provider-utils', () => ({
  fetchCategoryTree: vi.fn().mockResolvedValue({ topLevel: [], subcats: [] }),
  buildCategoryList: vi.fn().mockReturnValue('Food (Groceries)\nTransport (Gas)'),
  buildCategorizationPrompt: vi.fn().mockReturnValue('mock prompt'),
  resolveCategories: vi.fn().mockReturnValue(null),
}));


import OpenAI from 'openai';
import { categorizeWithOpenAI } from './openai-provider';

const mockCreate = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  (OpenAI as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.AI_CONFIDENCE_THRESHOLD = '0.70';
});

describe('categorizeWithOpenAI', () => {
  it('returns null on API error without throwing', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Network error'));
    const result = await categorizeWithOpenAI('starbucks', -5.50, 'CAD', 'user-1');
    expect(result).toBeNull();
  });

  it('returns null when confidence is below threshold', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            category: 'Food',
            subcategory: 'Coffee',
            need_want: 'Want',
            confidence: 0.50,
            reasoning: 'Starbucks is a coffee shop',
          }),
        },
      }],
    });
    const result = await categorizeWithOpenAI('starbucks', -5.50, 'CAD', 'user-1');
    expect(result).toBeNull();
  });
});