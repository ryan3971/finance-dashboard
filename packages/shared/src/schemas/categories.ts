import { z } from 'zod';
import { FIELD_LIMITS } from '../constants';

export const createCategorySchema = z.object({
  name: z.string().min(1).max(FIELD_LIMITS.SUBCATEGORY_NAME_MAX).trim(),
  parentId: z.string().uuid().optional(),
  isIncome: z.boolean().optional(),
});

export const patchCategorySchema = z.object({
  name: z.string().min(1).max(FIELD_LIMITS.SUBCATEGORY_NAME_MAX).trim(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type PatchCategoryInput = z.infer<typeof patchCategorySchema>;
