import type { z } from 'zod';
import type { accountResponseSchema } from '../schemas/accounts';

export type Account = z.infer<typeof accountResponseSchema>;
