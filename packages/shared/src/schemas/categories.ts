import { z } from 'zod';
import { FIELD_LIMITS } from '../constants';

export const createSubcategorySchema = z.object({
  name: z.string().min(1).max(FIELD_LIMITS.SUBCATEGORY_NAME_MAX).trim(),
  parentId: z.string().uuid(),
});

export const patchSubcategorySchema = z.object({
  name: z.string().min(1).max(FIELD_LIMITS.SUBCATEGORY_NAME_MAX).trim(),
});

export type CreateSubcategoryInput = z.infer<typeof createSubcategorySchema>;
export type PatchSubcategoryInput = z.infer<typeof patchSubcategorySchema>;
