/**
 * Centralised configuration module.
 *
 * This is the only place in the codebase that reads process.env directly.
 * All other modules import from here.
 *
 * Local dev:   values come from .env via dotenv
 * Production:  values will be injected by ECS task definition from
 *              AWS Secrets Manager — dotenv is skipped in that environment
 *
 * IMPORTANT: This module must be imported before any other module that needs
 * configuration. In server.ts it must be the first import.
 *
 * NOTE: Tests override DATABASE_URL by mutating process.env before this
 * module loads (via testing/setup.ts). Import order matters.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { z } from 'zod';

// Load .env in development and test. In production (ECS), env vars are
// injected directly by the task definition — dotenv is a no-op there.
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.resolve(process.cwd(), '@/../.env') });
}

const envSchema = z
  .object({
    // App
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z.string().default('info'),

    // Database
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

    // Auth
    JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
    JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
    BCRYPT_ROUNDS: z.coerce.number().int().positive().default(12),

    // CORS
    CORS_ORIGIN: z.string().default('http://localhost:5173'),

    // AI
    ENABLE_AI_CATEGORIZATION: z.enum(['true', 'false']).default('false'),
    AI_PROVIDER: z.enum(['anthropic', 'openai']).default('anthropic'),
    AI_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.7),
    ANTHROPIC_API_KEY: z.string().default(''),
    OPENAI_API_KEY: z.string().default(''),

    // Transfer detection
    TRANSFER_DETECTION_WINDOW_DAYS: z.coerce
      .number()
      .int()
      .positive()
      .default(3),

    // AWS (Phase 4 — optional until deployment)
    AWS_REGION: z.string().default('ca-central-1'),
    S3_BUCKET_NAME: z.string().default(''),
  })
  .superRefine((env, ctx) => {
    // JWT secrets must have adequate entropy in production.
    // Short secrets are permitted in development/test so the test suite can
    // use lightweight values without generating real keys.
    // Generate a production secret with:
    //   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    if (env.NODE_ENV === 'production') {
      if (env.JWT_SECRET.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_SECRET'],
          message: 'JWT_SECRET must be at least 32 characters in production (use randomBytes(32).toString("hex"))',
        });
      }
      if (env.JWT_REFRESH_SECRET.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_REFRESH_SECRET'],
          message: 'JWT_REFRESH_SECRET must be at least 32 characters in production (use randomBytes(32).toString("hex"))',
        });
      }
    }

    if (env.ENABLE_AI_CATEGORIZATION === 'true') {
      if (env.AI_PROVIDER === 'anthropic' && !env.ANTHROPIC_API_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ANTHROPIC_API_KEY'],
          message: 'ANTHROPIC_API_KEY is required when AI_PROVIDER=anthropic',
        });
      }
      if (env.AI_PROVIDER === 'openai' && !env.OPENAI_API_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['OPENAI_API_KEY'],
          message: 'OPENAI_API_KEY is required when AI_PROVIDER=openai',
        });
      }
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const formatted = parsed.error.issues
    .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${formatted}`);
}

const env = parsed.data;

export const config = {
  // App
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  logLevel: env.LOG_LEVEL,

  // Database
  databaseUrl: env.DATABASE_URL,

  // Auth
  jwtSecret: env.JWT_SECRET,
  jwtRefreshSecret: env.JWT_REFRESH_SECRET,
  bcryptRounds: env.BCRYPT_ROUNDS,

  // CORS
  corsOrigin: env.CORS_ORIGIN,

  // AI
  aiEnabled: env.ENABLE_AI_CATEGORIZATION === 'true',
  aiProvider: env.AI_PROVIDER,
  aiConfidenceThreshold: env.AI_CONFIDENCE_THRESHOLD,
  anthropicApiKey: env.ANTHROPIC_API_KEY,
  openaiApiKey: env.OPENAI_API_KEY,

  // Transfer detection
  transferWindowDays: env.TRANSFER_DETECTION_WINDOW_DAYS,

  // AWS (Phase 4 — optional until deployment)
  awsRegion: env.AWS_REGION,
  s3BucketName: env.S3_BUCKET_NAME,
} as const;
