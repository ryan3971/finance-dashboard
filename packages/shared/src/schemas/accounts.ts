import { ACCOUNT_TYPES, FIELD_LIMITS, INSTITUTIONS } from '../constants';
import { z } from 'zod';

export const accountFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(FIELD_LIMITS.ACCOUNT_NAME_MAX),
  type: z.enum(ACCOUNT_TYPES),
  institution: z.enum(INSTITUTIONS),
  currency: z.literal('CAD'),
  isCredit: z.boolean(),
});

export type AccountFormInput = z.infer<typeof accountFormSchema>;

// ─── Account Response Schema ──────────────────────────────────────────────────

export const accountResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.enum(ACCOUNT_TYPES),
  institution: z.enum(INSTITUTIONS),
  currency: z.literal('CAD'),
  isActive: z.boolean(),
  isCredit: z.boolean(),
  createdAt: z.string(),
});

export type Account = z.infer<typeof accountResponseSchema>;
