import {
  DEFAULT_CURRENCY,
  FIELD_LIMITS,
  ISO_DATE_REGEX,
  NEED_WANT_OPTIONS,
} from '../constants';
import { z } from 'zod';

// ─── Transaction Schemas ─────────────────────────────────────────────────────────────────

export const needWantSchema = z.enum(NEED_WANT_OPTIONS);

export const createTransactionSchema = z
  .object({
    accountId: z.string().uuid('Select an account'),
    date: z.string().regex(ISO_DATE_REGEX, 'Date must be YYYY-MM-DD'),
    description: z.string().min(1, 'Required').max(FIELD_LIMITS.NOTE_MAX),
    amount: z.coerce
      .number({ invalid_type_error: 'Must be a number' })
      .refine((v) => v !== 0, 'Cannot be zero'),
    currency: z.string().length(3).default(DEFAULT_CURRENCY),
    categoryId: z.string().uuid().nullable().optional(),
    subcategoryId: z.string().uuid().nullable().optional(),
    needWant: needWantSchema.nullable().optional(),
    note: z.string().max(FIELD_LIMITS.NOTE_MAX).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.subcategoryId && !data.categoryId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A category is required when a subcategory is selected',
        path: ['subcategoryId'],
      });
    }
  });

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

// ─── Transaction Filters Schema ─────────────────────────────────────────────────────────────────

export const transactionFiltersSchema = z.object({
  accountId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  month: z.string().optional(), // YYYY-MM; takes precedence over startDate/endDate
  categoryId: z.string().uuid().optional(),
  subcategoryId: z.string().uuid().optional(),
  needWant: needWantSchema.optional(),
  flagged: z.boolean().optional(),
  isIncome: z.boolean().optional(),
  isTransfer: z.boolean().optional(),
  tagIds: z.array(z.string()).optional(),
});

export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;

// ─── Patch Transaction Schema ─────────────────────────────────────────────────

export const patchTransactionSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  subcategoryId: z.string().uuid().nullable().optional(),
  needWant: needWantSchema.nullable().optional(),
  note: z.string().max(FIELD_LIMITS.NOTE_MAX).optional(),
  createRule: z.boolean().optional(),
});

export type PatchTransactionFormValues = z.infer<typeof patchTransactionSchema>;
