import { z } from 'zod';
import { FIELD_LIMITS, NEED_WANT_OPTIONS } from '../constants';

export const createAnticipatedBudgetSchema = z.object({
  name: z.string().min(1).max(FIELD_LIMITS.BUDGET_ENTRY_NAME_MAX),
  categoryId: z.string().uuid().nullable(),
  needWant: z.enum(NEED_WANT_OPTIONS).nullable(),
  isIncome: z.boolean(),
  monthlyAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .nullable(),
  notes: z.string().max(FIELD_LIMITS.NOTE_MAX).nullable(),
  effectiveYear: z.number().int().min(2000).max(2100),
});

export type CreateAnticipatedBudgetInput = z.infer<
  typeof createAnticipatedBudgetSchema
>;

export const updateAnticipatedBudgetSchema = createAnticipatedBudgetSchema
  .omit({ effectiveYear: true })
  .partial();

export type UpdateAnticipatedBudgetInput = z.infer<
  typeof updateAnticipatedBudgetSchema
>;

export const upsertMonthOverrideSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
});

export type UpsertMonthOverrideInput = z.infer<typeof upsertMonthOverrideSchema>;
