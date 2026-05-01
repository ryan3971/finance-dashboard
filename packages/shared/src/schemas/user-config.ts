import { z } from 'zod';

export const updateUserConfigSchema = z.object({
  allocations: z
    .object({
      needsPercentage: z.number().int().min(0).max(100),
      wantsPercentage: z.number().int().min(0).max(100),
      investmentsPercentage: z.number().int().min(0).max(100),
    })
    .refine(
      (v) =>
        v.needsPercentage + v.wantsPercentage + v.investmentsPercentage === 100,
      { message: 'Allocation percentages must sum to 100' }
    )
    .optional(),
  emergencyFundTarget: z.number().min(0).nullable().optional(),
});

export type UpdateUserConfigInput = z.infer<typeof updateUserConfigSchema>;
