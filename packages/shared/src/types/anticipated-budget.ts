import type { z } from 'zod';
import type {
  anticipatedBudgetEntrySchema,
  anticipatedBudgetMonthSchema,
  anticipatedBudgetResponseSchema,
} from '../schemas/anticipated-budget';

export type AnticipatedBudgetMonth = z.infer<typeof anticipatedBudgetMonthSchema>;
export type AnticipatedBudgetEntry = z.infer<typeof anticipatedBudgetEntrySchema>;
export type AnticipatedBudgetResponse = z.infer<typeof anticipatedBudgetResponseSchema>;
