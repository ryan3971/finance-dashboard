import { FIELD_LIMITS } from '../constants';
import { z } from 'zod';

export const createTagSchema = z.object({
  name: z.string().min(1, 'Name is required').max(FIELD_LIMITS.TAG_NAME_MAX),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a hex code e.g. #FF5733')
    .optional(),
});

export type CreateTagInput = z.infer<typeof createTagSchema>;

export const tagFormSchema = createTagSchema.pick({ name: true });
export type TagFormInput = z.infer<typeof tagFormSchema>;