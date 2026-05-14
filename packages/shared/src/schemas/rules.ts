import { z } from 'zod';
import { FIELD_LIMITS, NEED_WANT_OPTIONS } from '../constants';

export const patchRuleSchema = z.object({
  keyword: z.string().min(1).max(FIELD_LIMITS.RULE_KEYWORD_MAX).trim().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  subcategoryId: z.string().uuid().nullable().optional(),
  priority: z.number().int().optional(),
  needWant: z.enum(NEED_WANT_OPTIONS).nullable().optional(),
  flagForReview: z.boolean().optional(),
  matchType: z.enum(['substring', 'wildcard']).optional(),
});

export type PatchRuleInput = z.infer<typeof patchRuleSchema>;

export const createRuleSchema = z.object({
  keyword: z.string().min(1).max(FIELD_LIMITS.RULE_KEYWORD_MAX).trim(),
  categoryId: z.string().uuid().nullable(),
  subcategoryId: z.string().uuid().nullable().optional(),
  priority: z.number().int().default(5),
  needWant: z.enum(NEED_WANT_OPTIONS).nullable().optional(),
  flagForReview: z.boolean().default(false),
  matchType: z.enum(['substring', 'wildcard']).default('substring'),
  sourceName: z.string().nullable().optional(),
});

export type CreateRuleInput = z.infer<typeof createRuleSchema>;
