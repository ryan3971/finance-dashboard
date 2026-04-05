import { FIELD_LIMITS } from '../constants';
import { z } from 'zod';

export const tagFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(FIELD_LIMITS.TAG_NAME_MAX),
});

export type TagFormInput = z.infer<typeof tagFormSchema>;