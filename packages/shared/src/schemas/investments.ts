import { z } from 'zod';
import { ISO_DATE_REGEX } from '../constants';

export const investmentTransactionFiltersSchema = z.object({
  accountId: z.string().uuid().optional(),
  action: z
    .enum(['buy', 'sell', 'dividend', 'deposit', 'withdrawal', 'transfer', 'fee'])
    .optional(),
  symbol: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export type InvestmentTransactionFilters = z.infer<
  typeof investmentTransactionFiltersSchema
>;

export const contributionRoomQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});

export const upsertContributionRoomSchema = z
  .object({
    annualLimit: z.number().positive().optional(),
    roomCarried: z.number().nonnegative().optional(),
    roomCarriedConfirmed: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.annualLimit !== undefined ||
      d.roomCarried !== undefined ||
      d.roomCarriedConfirmed !== undefined,
    { message: 'At least one field must be provided' }
  );

export type UpsertContributionRoomInput = z.infer<typeof upsertContributionRoomSchema>;

export const createManualInvestmentTransactionSchema = z.object({
  accountId:    z.string().uuid(),
  date:         z.string().regex(ISO_DATE_REGEX),
  action:       z.enum(['buy', 'sell', 'dividend', 'deposit', 'withdrawal', 'transfer', 'fee']),
  // Required so that same-day, same-amount entries on the same account produce
  // distinct compositeKeys. Without a description, two equal employer contributions
  // on the same date would silently collide. The form enforces non-empty.
  description:  z.string().min(1, 'Description is required'),
  symbol:       z.string().optional(),
  quantity:     z.number().positive().optional(),
  price:        z.number().positive().optional(),
  // Zero is never a meaningful transaction amount.
  amount:       z.number().refine((n) => n !== 0, { message: 'Amount cannot be zero' }),
  currency:     z.enum(['CAD', 'USD']),
  activityType: z.string().optional(),
  note:         z.string().optional(),
  riskLevel:    z.enum(['regular', 'risky']).optional(),
});

export type CreateManualInvestmentTransactionInput = z.infer<
  typeof createManualInvestmentTransactionSchema
>;

export const monthlyBreakdownQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});

export const riskBudgetQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});
export type RiskBudgetQuery = z.infer<typeof riskBudgetQuerySchema>;

export const updateRiskSettingsSchema = z.object({
  riskyPercentage: z.number().int().min(0).max(100),
});
export type UpdateRiskSettingsInput = z.infer<typeof updateRiskSettingsSchema>;

export const updateRiskLevelSchema = z.object({
  riskLevel: z.enum(['regular', 'risky']),
});
export type UpdateRiskLevelInput = z.infer<typeof updateRiskLevelSchema>;
