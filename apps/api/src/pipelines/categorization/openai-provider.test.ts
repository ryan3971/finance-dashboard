import { beforeEach, describe, expect, it, vi } from 'vitest';
import { categorizeWithOpenAI } from './openai-provider';
import OpenAI from 'openai';
import { resolveCategories } from './provider-utils';

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: vi.fn() } },
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
    const result = await categorizeWithOpenAI(
      'starbucks',
      -5.5,
      'CAD',
      'user-1'
    );
    expect(result).toBeNull();
  });

  it('returns null when confidence is below threshold', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              category: 'Food',
              subcategory: 'Coffee',
              need_want: 'Want',
              confidence: 0.5,
              reasoning: 'Starbucks is a coffee shop',
            }),
          },
        },
      ],
    });
    const result = await categorizeWithOpenAI(
      'starbucks',
      -5.5,
      'CAD',
      'user-1'
    );
    expect(result).toBeNull();
  });

  it('returns a categorization result on success', async () => {
    vi.mocked(resolveCategories).mockReturnValueOnce({
      categoryId: 'cat-food',
      subcategoryId: 'subcat-coffee',
    });
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              category: 'Food',
              subcategory: 'Coffee',
              need_want: 'Want',
              confidence: 0.92,
              reasoning: 'Starbucks is a coffee shop',
            }),
          },
        },
      ],
    });

    const result = await categorizeWithOpenAI('starbucks', -5.5, 'CAD', 'user-1');

    expect(result).toMatchObject({
      categoryId: 'cat-food',
      subcategoryId: 'subcat-coffee',
      needWant: 'Want',
      categorySource: 'ai',
      categoryConfidence: 0.92,
      sourceName: null,
      flaggedForReview: false,
    });
  });

  it('strips markdown fences from response before parsing', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            // response_format: json_object doesn't guarantee no fences in all versions
            content:
              '```json\n{"category":"Food","subcategory":"Coffee","need_want":"Want","confidence":0.90,"reasoning":"test"}\n```',
          },
        },
      ],
    });
    // Should not throw a JSON parse error
    await expect(
      categorizeWithOpenAI('starbucks', -5.5, 'CAD', 'user-1')
    ).resolves.not.toThrow();
  });
});
