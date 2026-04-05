import { ACCOUNT_TYPES, FIELD_LIMITS, INSTITUTIONS } from '../constants';
import { z } from 'zod';

export const accountFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(FIELD_LIMITS.ACCOUNT_NAME_MAX),
  type: z.enum(ACCOUNT_TYPES),
  institution: z.enum(INSTITUTIONS),
  currency: z.string().length(3, 'Must be a 3-letter currency code'),
  isCredit: z.boolean(),
});

export type AccountFormInput = z.infer<typeof accountFormSchema>;
