import type {
  CreateAnticipatedBudgetInput,
  UpdateAnticipatedBudgetInput,
  UpsertMonthOverrideInput,
} from '@finance/shared/schemas/anticipated-budget';
import { and, eq, inArray } from 'drizzle-orm';
import Decimal from 'decimal.js';
import {
  AnticipatedBudgetError,
  AnticipatedBudgetErrorCode,
} from './anticipated-budget.errors';
import {
  anticipatedBudget,
  anticipatedBudgetMonths,
  categories,
} from '@/db/schema';
import { MONTHS_IN_YEAR } from '@finance/shared/constants';
import { db } from '@/db';
import { assertDefined } from '@/lib/assert';

const entryColumns = {
  id: anticipatedBudget.id,
  name: anticipatedBudget.name,
  categoryId: anticipatedBudget.categoryId,
  needWant: anticipatedBudget.needWant,
  isIncome: anticipatedBudget.isIncome,
  monthlyAmount: anticipatedBudget.monthlyAmount,
  notes: anticipatedBudget.notes,
  effectiveYear: anticipatedBudget.effectiveYear,
};

const categoryColumns = {
  categoryName: categories.name,
  categoryIcon: categories.icon,
};

const monthColumns = {
  anticipatedBudgetId: anticipatedBudgetMonths.anticipatedBudgetId,
  month: anticipatedBudgetMonths.month,
  amount: anticipatedBudgetMonths.amount,
};

function resolveMonths(
  monthlyAmount: string | null,
  overrides: { month: number; amount: string }[]
) {
  const overrideMap = new Map(overrides.map((o) => [o.month, o.amount]));
  const defaultAmount =
    monthlyAmount !== null ? new Decimal(monthlyAmount).toNumber() : 0;
  return Array.from({ length: MONTHS_IN_YEAR }, (_, i) => {
    const month = i + 1;
    const override = overrideMap.get(month);
    if (override !== undefined) {
      return {
        month,
        amount: new Decimal(override).toNumber(),
        isOverride: true,
      };
    }
    return { month, amount: defaultAmount, isOverride: false };
  });
}

async function requireOwnedEntry(entryId: string, userId: string) {
  const [entry] = await db
    .select({ id: anticipatedBudget.id })
    .from(anticipatedBudget)
    .where(
      and(
        eq(anticipatedBudget.id, entryId),
        eq(anticipatedBudget.userId, userId)
      )
    )
    .limit(1);

  if (!entry) {
    throw new AnticipatedBudgetError(AnticipatedBudgetErrorCode.NOT_FOUND);
  }
}

async function resolveCategoryColumns(categoryId: string | null) {
  if (!categoryId) return { categoryName: null, categoryIcon: null };
  const [row] = await db
    .select(categoryColumns)
    .from(categories)
    .where(eq(categories.id, categoryId));
  return row ?? { categoryName: null, categoryIcon: null };
}

export async function listEntries(userId: string, year: number) {
  const rows = await db
    .select({ ...entryColumns, ...categoryColumns })
    .from(anticipatedBudget)
    .leftJoin(categories, eq(anticipatedBudget.categoryId, categories.id))
    .where(
      and(
        eq(anticipatedBudget.userId, userId),
        eq(anticipatedBudget.effectiveYear, year)
      )
    );

  if (rows.length === 0) return [];

  const entryIds = rows.map((r) => r.id);
  const overrides = await db
    .select(monthColumns)
    .from(anticipatedBudgetMonths)
    .where(inArray(anticipatedBudgetMonths.anticipatedBudgetId, entryIds));

  const overridesByEntry = new Map<
    string,
    { month: number; amount: string }[]
  >();
  for (const o of overrides) {
    const list = overridesByEntry.get(o.anticipatedBudgetId) ?? [];
    list.push({ month: o.month, amount: o.amount });
    overridesByEntry.set(o.anticipatedBudgetId, list);
  }

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    categoryIcon: row.categoryIcon,
    needWant: row.needWant,
    isIncome: row.isIncome,
    monthlyAmount:
      row.monthlyAmount !== null
        ? new Decimal(row.monthlyAmount).toNumber()
        : null,
    notes: row.notes,
    effectiveYear: row.effectiveYear,
    months: resolveMonths(
      row.monthlyAmount,
      overridesByEntry.get(row.id) ?? []
    ),
  }));
}

export async function createEntry(
  userId: string,
  input: CreateAnticipatedBudgetInput
) {
  const [row] = await db
    .insert(anticipatedBudget)
    .values({ ...input, userId })
    .returning(entryColumns);
  assertDefined(row, 'Expected anticipated budget insert to return a row');

  const category = await resolveCategoryColumns(row.categoryId);

  return {
    ...row,
    monthlyAmount:
      row.monthlyAmount !== null
        ? new Decimal(row.monthlyAmount).toNumber()
        : null,
    ...category,
    months: resolveMonths(row.monthlyAmount, []),
  };
}

export async function updateEntry(
  id: string,
  userId: string,
  patch: UpdateAnticipatedBudgetInput
) {
  const [row] = await db
    .update(anticipatedBudget)
    .set(patch)
    .where(
      and(eq(anticipatedBudget.id, id), eq(anticipatedBudget.userId, userId))
    )
    .returning(entryColumns);

  if (!row) return null;

  const [overrides, category] = await Promise.all([
    db
      .select(monthColumns)
      .from(anticipatedBudgetMonths)
      .where(eq(anticipatedBudgetMonths.anticipatedBudgetId, id)),
    resolveCategoryColumns(row.categoryId),
  ]);

  return {
    ...row,
    monthlyAmount:
      row.monthlyAmount !== null
        ? new Decimal(row.monthlyAmount).toNumber()
        : null,
    ...category,
    months: resolveMonths(
      row.monthlyAmount,
      overrides.map((o) => ({ month: o.month, amount: o.amount }))
    ),
  };
}

export async function deleteEntry(id: string, userId: string) {
  const result = await db
    .delete(anticipatedBudget)
    .where(
      and(eq(anticipatedBudget.id, id), eq(anticipatedBudget.userId, userId))
    )
    .returning({ id: anticipatedBudget.id });

  return result.length > 0;
}

export async function upsertMonthOverride(
  entryId: string,
  userId: string,
  month: number,
  input: UpsertMonthOverrideInput
) {
  await requireOwnedEntry(entryId, userId);

  await db
    .insert(anticipatedBudgetMonths)
    .values({ anticipatedBudgetId: entryId, month, amount: input.amount })
    .onConflictDoUpdate({
      target: [
        anticipatedBudgetMonths.anticipatedBudgetId,
        anticipatedBudgetMonths.month,
      ],
      set: { amount: input.amount },
    });
}

export async function deleteMonthOverride(
  entryId: string,
  userId: string,
  month: number
) {
  await requireOwnedEntry(entryId, userId);

  const result = await db
    .delete(anticipatedBudgetMonths)
    .where(
      and(
        eq(anticipatedBudgetMonths.anticipatedBudgetId, entryId),
        eq(anticipatedBudgetMonths.month, month)
      )
    )
    .returning({ id: anticipatedBudgetMonths.id });

  return result.length > 0;
}
