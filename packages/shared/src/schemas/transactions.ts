import { NEED_WANT_OPTIONS } from '../types/transactions';
import { z } from 'zod';

export const needWantSchema = z.enum(NEED_WANT_OPTIONS);
