import { z } from 'zod';
import { FIELD_LIMITS, NEED_WANT_OPTIONS } from '../constants';

// Base object schema without refinements so .omit()/.partial() can be chained
// before adding the isIncome/needWant cross-field constraint.
const anticipatedBudgetBaseSchema = z.object({
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

const needWantNullForIncome = {
  message: 'needWant must be null when isIncome is true',
  path: ['needWant'],
};

export const createAnticipatedBudgetSchema = anticipatedBudgetBaseSchema.refine(
  (data) => !(data.isIncome && data.needWant !== null),
  needWantNullForIncome,
);

export type CreateAnticipatedBudgetInput = z.infer<
  typeof createAnticipatedBudgetSchema
>;

export const updateAnticipatedBudgetSchema = anticipatedBudgetBaseSchema
  .omit({ effectiveYear: true })
  .partial()
  .refine(
    // Use loose inequality so undefined (absent field) is treated the same as
    // null — a PATCH that omits needWant cannot violate the constraint alone.
    (data) => !(data.isIncome && data.needWant != null),
    needWantNullForIncome,
  );

export type UpdateAnticipatedBudgetInput = z.infer<
  typeof updateAnticipatedBudgetSchema
>;

export const upsertMonthOverrideSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
});

export type UpsertMonthOverrideInput = z.infer<typeof upsertMonthOverrideSchema>;
