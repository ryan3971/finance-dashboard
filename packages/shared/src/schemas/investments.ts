import { z } from 'zod';

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

export const investmentSummaryQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  accountId: z.string().uuid().optional(),
});

export const contributionRoomQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});

export const upsertContributionRoomSchema = z.object({
  annualLimit: z.number().positive().optional(),
  roomCarried: z.number().nonnegative().optional(),
  roomCarriedConfirmed: z.boolean().optional(),
});

export type UpsertContributionRoomInput = z.infer<typeof upsertContributionRoomSchema>;
