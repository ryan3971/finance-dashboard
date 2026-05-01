import { z } from 'zod';

// ─── Income Dashboard ─────────────────────────────────────────────────────────

export const incomeMonthAllocationSchema = z.object({
  needs: z.number(),
  wants: z.number(),
  investments: z.number(),
});

export const incomeMonthSchema = z.object({
  month: z.number().int(),
  total: z.number(),
  allocation: incomeMonthAllocationSchema.nullable(),
  rebalancingAdjustment: z.number(),
});

export const incomeDashboardResponseSchema = z.object({
  year: z.number().int(),
  months: z.array(incomeMonthSchema),
});

// ─── Expenses Dashboard ───────────────────────────────────────────────────────

export const expenseMonthSchema = z.object({
  month: z.number().int(),
  need: z.number(),
  want: z.number(),
  other: z.number(),
  total: z.number(),
  rebalancingAdjustment: z.number(),
});

export const expenseDashboardResponseSchema = z.object({
  year: z.number().int(),
  months: z.array(expenseMonthSchema),
  annualTotal: z.number(),
});

export const expenseCategoryRowSchema = z.object({
  month: z.number().int(),
  category: z.string().nullable(),
  subcategory: z.string().nullable(),
  total: z.number(),
  rebalancingAdjustment: z.number().nullable(),
});

export const expenseCategoriesResponseSchema = z.object({
  year: z.number().int(),
  rows: z.array(expenseCategoryRowSchema),
});

// ─── Snapshot Dashboard ───────────────────────────────────────────────────────

export const snapshotAccountRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.string(),
  institution: z.string(),
  currency: z.string(),
  isCredit: z.boolean(),
  balance: z.number(),
});

export const snapshotEmergencyFundSchema = z.object({
  target: z.number().nullable(),
  balance: z.number(),
  percentage: z.number().nullable(),
});

export const snapshotColumnValuesSchema = z.object({
  total: z.number(),
  needs: z.number(),
  wants: z.number(),
  rebalancingAdjustment: z.number(),
});

export const snapshotMonthlyIncomeSchema = z.object({
  income: z.number(),
  // Actual investment transactions for the month. Returns zero until the
  // investment-tracking feature ships — the field is present now so the
  // response shape is stable and only the repository query needs adding later.
  actualInvestments: z.number(),
  spendingIncome: z.number(),
  needs: z.number(),
  wants: z.number(),
});

export const snapshotAnticipatedSchema = z.object({
  hasEntries: z.boolean(),
  expectedIncome: z.number(),
  expectedSpendingIncome: snapshotColumnValuesSchema,
  expectedExpenses: snapshotColumnValuesSchema,
  expectedAvailable: snapshotColumnValuesSchema,
  remainingBudget: snapshotColumnValuesSchema,
});

// TODO: verify year/month belong in the snapshot response shape vs. being derived client-side
export const snapshotDashboardResponseSchema = z.object({
  year: z.number().int(),
  month: z.number().int(),
  lastUploadedAt: z.string().nullable(),
  accounts: z.array(snapshotAccountRowSchema),
  emergencyFund: snapshotEmergencyFundSchema,
  monthlyIncome: snapshotMonthlyIncomeSchema,
  monthlyExpenses: snapshotColumnValuesSchema,
  anticipated: snapshotAnticipatedSchema,
});

// ─── YTD Dashboard ────────────────────────────────────────────────────────────

// Future months carry all-null data values; past months carry computed numbers.
// rebalancingAdjustment is optional on the null variant — future months have none.
const ytdMonthNullSchema = z.object({
  month: z.number().int(),
  spendingIncome: z.null(),
  expenses: z.null(),
  netSpendingIncome: z.null(),
  wants: z.null(),
  needs: z.null(),
  rebalancingAdjustment: z.number().optional(),
});

const ytdMonthDataSchema = z.object({
  month: z.number().int(),
  spendingIncome: z.number(),
  expenses: z.number(),
  netSpendingIncome: z.number(),
  wants: z.number(),
  needs: z.number(),
  rebalancingAdjustment: z.number(),
});

export const ytdMonthSchema = z.union([ytdMonthNullSchema, ytdMonthDataSchema]);

export const ytdDashboardResponseSchema = z.object({
  year: z.number().int(),
  months: z.array(ytdMonthSchema),
});
