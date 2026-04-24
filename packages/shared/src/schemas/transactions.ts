import {
  CATEGORY_SOURCE_OPTIONS,
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
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'month must be YYYY-MM').optional(), // YYYY-MM; takes precedence over startDate/endDate
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

// ─── Transaction Response Schemas ────────────────────────────────────────────

export const categorySourceSchema = z.enum(CATEGORY_SOURCE_OPTIONS);
export type CategorySource = z.infer<typeof categorySourceSchema>;

export const tagResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  color: z.string().nullable(),
});
export type Tag = z.infer<typeof tagResponseSchema>;

export const transactionResponseSchema = z.object({
  id: z.string().uuid(),
  date: z.string(),
  description: z.string(),
  sourceName: z.string().nullable(),
  amount: z.string(),
  currency: z.string(),
  needWant: needWantSchema.nullable(),
  isTransfer: z.boolean(),
  transferMatchId: z.string().uuid().nullable(),
  transferMatchDescription: z.string().nullable(),
  transferMatchSourceName: z.string().nullable(),
  transferMatchAccountName: z.string().nullable(),
  transferPairId: z.string().uuid().nullable(),
  transferPairDescription: z.string().nullable(),
  transferPairSourceName: z.string().nullable(),
  transferPairAccountName: z.string().nullable(),
  isIncome: z.boolean(),
  flaggedForReview: z.boolean(),
  categorySource: categorySourceSchema.nullable(),
  note: z.string().nullable(),
  accountId: z.string().uuid(),
  accountName: z.string(),
  accountInstitution: z.string(),
  source: z.string(),
  categoryId: z.string().uuid().nullable(),
  categoryName: z.string().nullable(),
  subcategoryId: z.string().uuid().nullable(),
  subcategoryName: z.string().nullable(),
  tags: z.array(tagResponseSchema),
  rebalancingGroupId: z.string().uuid().nullable(),
  rebalancingRole: z.enum(['source', 'offset']).nullable(),
});
export type Transaction = z.infer<typeof transactionResponseSchema>;
