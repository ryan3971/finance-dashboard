import { z } from 'zod';

const envSchema = z.object({
  VITE_SENTRY_DSN: z.string().optional(),
  VITE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
});

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  const formatted = parsed.error.issues
    .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${formatted}`);
}

const env = parsed.data;

export const config = {
  sentryDsn: env.VITE_SENTRY_DSN,
  env: env.VITE_ENV,
} as const;
