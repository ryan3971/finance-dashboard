import { and, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  accounts,
  categories,
  rebalancingGroupTransactions,
  rebalancingGroups,
  transactions,
} from '@/db/schema';
import { db } from '@/db';
import Decimal from 'decimal.js';
import { NEED_WANT_OPTIONS } from '@finance/shared/constants';
import type { ExpenseCategoryRow } from '@finance/shared/types/dashboard';

const categoryAlias = alias(categories, 'cat');
const subcategoryAlias = alias(categories, 'sub');

const [NEED, WANT] = NEED_WANT_OPTIONS;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ResolvedGroupRow {
  groupId: string;
  myShareOverride: string | null;
  role: string;
  amount: string;
  date: string;
  needWant: string | null;
  categoryName: string | null;
  subcategoryName: string | null;
}

export function makestring(
  cat: string | null,
  sub: string | null
): string {
  return `${cat ?? '\x00'}::\x00${sub ?? '\x00'}`;
}

export interface RebalancingAdjustments {
  // Positive amounts to subtract from positive expense totals, keyed by month.
  expenseByMonth: Map<number, { need: Decimal; want: Decimal; other: Decimal }>;
  // Positive amounts to subtract from positive expense category totals.
  categoryByMonth: Map<number, Map<string, Decimal>>;
  // Positive amounts to subtract from positive income totals, keyed by month.
  incomeByMonth: Map<number, Decimal>;
}

// ─── DB Query ─────────────────────────────────────────────────────────────────

/**
 * Fetches all source and offset transactions for every resolved rebalancing
 * group owned by the user. No year filter is applied — the full set is needed
 * to compute proportional my_share attribution across multi-year source groups.
 */
export async function queryResolvedGroupTransactions(
  userId: string
): Promise<ResolvedGroupRow[]> {
  return db
    .select({
      groupId: rebalancingGroups.id,
      myShareOverride: rebalancingGroups.myShareOverride,
      role: rebalancingGroupTransactions.role,
      amount: transactions.amount,
      date: transactions.date,
      needWant: transactions.needWant,
      categoryName: categoryAlias.name,
      subcategoryName: subcategoryAlias.name,
    })
    .from(rebalancingGroups)
    .innerJoin(
      rebalancingGroupTransactions,
      eq(rebalancingGroupTransactions.groupId, rebalancingGroups.id)
    )
    .innerJoin(
      transactions,
      eq(transactions.id, rebalancingGroupTransactions.transactionId)
    )
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .leftJoin(categoryAlias, eq(transactions.categoryId, categoryAlias.id))
    .leftJoin(
      subcategoryAlias,
      eq(transactions.subcategoryId, subcategoryAlias.id)
    )
    .where(
      and(
        eq(rebalancingGroups.userId, userId),
        eq(rebalancingGroups.status, 'resolved')
      )
    );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getYear(date: string): number {
  return parseInt(date.slice(0, 4), 10);
}

function getMonth(date: string): number {
  return parseInt(date.slice(5, 7), 10);
}

function accumulateExpense(
  expenseByMonth: Map<number, { need: Decimal; want: Decimal; other: Decimal }>,
  month: number,
  needWant: string | null,
  amount: Decimal
): void {
  let bucket = expenseByMonth.get(month);
  if (!bucket) {
    bucket = { need: new Decimal(0), want: new Decimal(0), other: new Decimal(0) };
    expenseByMonth.set(month, bucket);
  }
  if (needWant === NEED) {
    bucket.need = bucket.need.plus(amount);
  } else if (needWant === WANT) {
    bucket.want = bucket.want.plus(amount);
  } else {
    bucket.other = bucket.other.plus(amount);
  }
}

// ─── Compute helpers ──────────────────────────────────────────────────────────

function groupRowsByGroupId(
  rows: ResolvedGroupRow[]
): Map<string, { myShareOverride: string | null; rows: ResolvedGroupRow[] }> {
  const byGroup = new Map<
    string,
    { myShareOverride: string | null; rows: ResolvedGroupRow[] }
  >();
  for (const row of rows) {
    const entry = byGroup.get(row.groupId);
    if (entry) {
      entry.rows.push(row);
    } else {
      byGroup.set(row.groupId, { myShareOverride: row.myShareOverride, rows: [row] });
    }
  }
  return byGroup;
}

function computeTotalSourceAmount(sources: ResolvedGroupRow[]): Decimal {
  let total = new Decimal(0);
  for (const s of sources) {
    total = total.plus(new Decimal(s.amount).negated());
  }
  return total;
}

function resolveMyShare(
  myShareOverride: string | null,
  totalSourceAmount: Decimal,
  totalOffsetAmount: Decimal
): Decimal {
  return myShareOverride !== null
    ? new Decimal(myShareOverride)
    : Decimal.max(0, totalSourceAmount.minus(totalOffsetAmount));
}

function applyExpenseAdjustments(
  sources: ResolvedGroupRow[],
  targetYear: number,
  myShare: Decimal,
  totalSourceAmount: Decimal,
  expenseByMonth: Map<number, { need: Decimal; want: Decimal; other: Decimal }>,
  categoryByMonth: Map<number, Map<string, Decimal>>
): void {
  for (const s of sources) {
    if (getYear(s.date) !== targetYear) continue;
    const month = getMonth(s.date);
    const sourceAmount = new Decimal(s.amount).negated();
    const proportion = sourceAmount.div(totalSourceAmount);
    // Round proportional share to 2dp to avoid floating-point drift
    const proportionalShare = myShare.mul(proportion).toDecimalPlaces(2);
    const adjustment = sourceAmount.minus(proportionalShare);
    if (adjustment.lte(0)) continue;
    accumulateExpense(expenseByMonth, month, s.needWant, adjustment);
    const catMap = categoryByMonth.get(month) ?? new Map<string, Decimal>();
    categoryByMonth.set(month, catMap);
    const catKey = makestring(s.categoryName, s.subcategoryName);
    catMap.set(catKey, (catMap.get(catKey) ?? new Decimal(0)).plus(adjustment));
  }
}

function applyIncomeAdjustments(
  offsets: ResolvedGroupRow[],
  targetYear: number,
  incomeByMonth: Map<number, Decimal>
): void {
  for (const o of offsets) {
    if (getYear(o.date) !== targetYear) continue;
    const month = getMonth(o.date);
    incomeByMonth.set(
      month,
      (incomeByMonth.get(month) ?? new Decimal(0)).plus(new Decimal(o.amount))
    );
  }
}

// ─── Compute ──────────────────────────────────────────────────────────────────

/**
 * Transforms resolved-group rows into per-month adjustment maps for a given
 * year. Expense adjustments are positive amounts to be subtracted from expense
 * totals. Income adjustments are positive amounts to be subtracted from income
 * totals (offset transactions excluded from income in resolved groups).
 */
export function computeRebalancingAdjustments(
  rows: ResolvedGroupRow[],
  targetYear: number
): RebalancingAdjustments {
  const expenseByMonth = new Map<
    number,
    { need: Decimal; want: Decimal; other: Decimal }
  >();
  const categoryByMonth = new Map<number, Map<string, Decimal>>();
  const incomeByMonth = new Map<number, Decimal>();

  const byGroup = groupRowsByGroupId(rows);

  for (const [, group] of byGroup) {
    const sources = group.rows.filter((r) => r.role === 'source');
    const offsets = group.rows.filter((r) => r.role === 'offset');

    const totalSourceAmount = computeTotalSourceAmount(sources);
    if (totalSourceAmount.isZero()) continue;

    let totalOffsetAmount = new Decimal(0);
    for (const o of offsets) {
      totalOffsetAmount = totalOffsetAmount.plus(new Decimal(o.amount));
    }

    const myShare = resolveMyShare(group.myShareOverride, totalSourceAmount, totalOffsetAmount);

    applyExpenseAdjustments(sources, targetYear, myShare, totalSourceAmount, expenseByMonth, categoryByMonth);
    applyIncomeAdjustments(offsets, targetYear, incomeByMonth);
  }

  return { expenseByMonth, categoryByMonth, incomeByMonth };
}

// ─── Utility: total expense adjustment for a month ────────────────────────────

export function totalExpenseAdjForMonth(
  adjustments: RebalancingAdjustments,
  month: number
): Decimal {
  const adj = adjustments.expenseByMonth.get(month);
  if (!adj) return new Decimal(0);
  return adj.need.plus(adj.want).plus(adj.other);
}

// ─── Apply to category rows ───────────────────────────────────────────────────

/**
 * Annotates each ExpenseCategoryRow with the rebalancing adjustment that was
 * subtracted from its total. Returns null when no adjustment applies to that
 * row (the UI renders nothing for null).
 */
export function applyRebalancingToCategories(
  rows: ExpenseCategoryRow[],
  adjustments: RebalancingAdjustments
): ExpenseCategoryRow[] {
  return rows.map((row) => {
    const catMap = adjustments.categoryByMonth.get(row.month);
    if (!catMap) return row;
    const adj = catMap.get(makestring(row.category, row.subcategory));
    if (!adj || adj.lte(0)) return row;
    return { ...row, rebalancingAdjustment: adj.toNumber() };
  });
}
