import { z } from 'zod';
import { FIELD_LIMITS } from '../constants';
import { needWantSchema } from './transactions';

export const patchRuleSchema = z.object({
  keyword: z.string().min(1).max(FIELD_LIMITS.RULE_KEYWORD_MAX).trim().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  subcategoryId: z.string().uuid().nullable().optional(),
  priority: z.number().int().optional(),
  needWant: needWantSchema.nullable().optional(),
});

export type PatchRuleInput = z.infer<typeof patchRuleSchema>;
