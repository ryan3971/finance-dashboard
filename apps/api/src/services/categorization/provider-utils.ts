import { db } from '../../db';
import { categories } from '../../db/schema';
import { isNull, or, eq } from 'drizzle-orm';

export interface ParsedAIResponse {
  category: string;
  subcategory: string | null;
  need_want: 'Need' | 'Want' | 'NA';
  confidence: number;
  reasoning: string;
}

export interface CategoryRow {
  id: string;
  name: string;
  parentId: string | null;
  isIncome: boolean;
}

/**
 * Fetch the full category tree visible to this user (system + personal).
 * Returns both top-level and subcategory rows for use in prompt building
 * and ID resolution.
 */
export async function fetchCategoryTree(userId: string): Promise<{
  topLevel: CategoryRow[];
  subcats: CategoryRow[];
}> {
  const allCategories = await db
    .select({
      id: categories.id,
      name: categories.name,
      parentId: categories.parentId,
      isIncome: categories.isIncome,
    })
    .from(categories)
    .where(or(isNull(categories.userId), eq(categories.userId, userId)));

  return {
    topLevel: allCategories.filter(c => c.parentId === null),
    subcats: allCategories.filter(c => c.parentId !== null),
  };
}

/**
 * Build the category list string used in AI prompts.
 * Format: "Food (Groceries, Eating Out, Coffee)"
 */
export function buildCategoryList(topLevel: CategoryRow[], subcats: CategoryRow[]): string {
  return topLevel
    .map(p => {
      const children = subcats.filter(s => s.parentId === p.id).map(s => s.name);
      return children.length > 0 ? `${p.name} (${children.join(', ')})` : p.name;
    })
    .join('');
}

/**
 * Build the categorization prompt. Identical for both providers.
 */
export function buildCategorizationPrompt(
  description: string,
  amount: number,
  currency: string,
  categoryList: string
): string {
  const isDebit = amount < 0;
  const absAmount = Math.abs(amount).toFixed(2);

  return `You are a personal finance categorization assistant for a Canadian user.

Categorize the following bank transaction:
- Description: "${description}"
- Amount: ${isDebit ? '-' : '+'}${absAmount} ${currency}
- Type: ${isDebit ? 'expense/debit' : 'income/credit'}

Available categories and subcategories:
${categoryList}

Respond with a JSON object only, no markdown, no other text:
{
  "category": "<top-level category name>",
  "subcategory": "<subcategory name or null>",
  "need_want": "<Need|Want|NA>",
  "confidence": <0.0-1.0>,
  "reasoning": "<one sentence>"
}

Rules:
- need_want must be "NA" for income, transfers, or repayments
- need_want must be "Need" or "Want" for expenses
- Use "Uncategorized" category if genuinely uncertain
- confidence should reflect how certain you are — be honest`;
}

/**
 * Resolve AI-returned category names to database UUIDs.
 * Returns null if the category cannot be resolved.
 */
export function resolveCategories(
  parsedCategory: string,
  parsedSubcategory: string | null,
  topLevel: CategoryRow[],
  subcats: CategoryRow[]
): { categoryId: string; subcategoryId: string | null } | null {
  const categoryRow = topLevel.find(
    c => c.name.toLowerCase() === parsedCategory.toLowerCase()
  );
  if (!categoryRow) return null;

  const subcategoryRow = parsedSubcategory
    ? subcats.find(
        s =>
          s.parentId === categoryRow.id &&
          s.name.toLowerCase() === parsedSubcategory.toLowerCase()
      )
    : null;

  return {
    categoryId: categoryRow.id,
    subcategoryId: subcategoryRow?.id ?? null,
  };
}