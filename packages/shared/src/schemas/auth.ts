import { FIELD_LIMITS } from '../constants';
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(FIELD_LIMITS.PASSWORD_MIN, 'Password must be at least 8 characters')
    .max(100, 'Password must be less than 100 characters'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type User = z.infer<typeof userSchema>;
