import { z } from 'zod';
import { FIELD_LIMITS, REBALANCING_GROUP_LABEL_MAX } from '../constants';

export const createRebalancingGroupSchema = z.object({
  label: z
    .string()
    .min(1, 'Label is required')
    .max(REBALANCING_GROUP_LABEL_MAX),
  initialTransactionId: z.string().uuid(),
  role: z.enum(['source', 'offset']),
  myShareOverride: z.number().positive().optional(),
});

export const updateRebalancingGroupSchema = z
  .object({
    label: z
      .string()
      .min(1, 'Label is required')
      .max(REBALANCING_GROUP_LABEL_MAX)
      .optional(),
    status: z.enum(['open', 'resolved']).optional(),
    myShareOverride: z.number().positive().nullable().optional(),
    flaggedForReview: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const addGroupTransactionSchema = z.object({
  transactionId: z.string().uuid(),
  role: z.enum(['source', 'offset']),
});

// Re-export field limit for consumers that need it
export { FIELD_LIMITS };
