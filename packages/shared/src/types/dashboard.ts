import type { z } from 'zod';
import type {
  expenseCategoriesResponseSchema,
  expenseCategoryRowSchema,
  expenseDashboardResponseSchema,
  expenseMonthSchema,
  incomeMonthAllocationSchema,
  incomeDashboardResponseSchema,
  incomeMonthSchema,
  snapshotAccountRowSchema,
  snapshotAnticipatedSchema,
  snapshotColumnValuesSchema,
  snapshotDashboardResponseSchema,
  snapshotEmergencyFundSchema,
  snapshotMonthlyIncomeSchema,
  ytdDashboardResponseSchema,
  ytdMonthSchema,
} from '../schemas/dashboard';

export type IncomeMonthAllocation = z.infer<typeof incomeMonthAllocationSchema>;
export type IncomeMonth = z.infer<typeof incomeMonthSchema>;
export type IncomeDashboardResponse = z.infer<typeof incomeDashboardResponseSchema>;

export type ExpenseMonth = z.infer<typeof expenseMonthSchema>;
export type ExpenseDashboardResponse = z.infer<typeof expenseDashboardResponseSchema>;
export type ExpenseCategoryRow = z.infer<typeof expenseCategoryRowSchema>;
export type ExpenseCategoriesResponse = z.infer<typeof expenseCategoriesResponseSchema>;

export type SnapshotAccountRow = z.infer<typeof snapshotAccountRowSchema>;
export type SnapshotEmergencyFund = z.infer<typeof snapshotEmergencyFundSchema>;
export type SnapshotColumnValues = z.infer<typeof snapshotColumnValuesSchema>;
export type SnapshotMonthlyIncome = z.infer<typeof snapshotMonthlyIncomeSchema>;
export type SnapshotAnticipated = z.infer<typeof snapshotAnticipatedSchema>;
export type SnapshotDashboardResponse = z.infer<typeof snapshotDashboardResponseSchema>;

export type YtdMonth = z.infer<typeof ytdMonthSchema>;
export type YtdDashboardResponse = z.infer<typeof ytdDashboardResponseSchema>;
