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
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env in development and test. In production (ECS), env vars are
// injected directly by the task definition — dotenv is a no-op there.
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
}

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const config = {
  // App
  nodeEnv:  optionalEnv('NODE_ENV', 'development'),
  port:     parseInt(optionalEnv('PORT', '3001'), 10),
  logLevel: optionalEnv('LOG_LEVEL', 'info'),

  // Database
  databaseUrl: requireEnv('DATABASE_URL'),

  // Auth
  jwtSecret:        requireEnv('JWT_SECRET'),
  jwtRefreshSecret: requireEnv('JWT_REFRESH_SECRET'),

  // CORS
  corsOrigin: optionalEnv('CORS_ORIGIN', 'http://localhost:5173'),

  // AI
  aiEnabled:             optionalEnv('ENABLE_AI_CATEGORIZATION', 'false') === 'true',
  aiProvider:            optionalEnv('AI_PROVIDER', 'anthropic') as 'anthropic' | 'openai',
  aiConfidenceThreshold: parseFloat(optionalEnv('AI_CONFIDENCE_THRESHOLD', '0.70')),
  anthropicApiKey:       optionalEnv('ANTHROPIC_API_KEY', ''),
  openaiApiKey:          optionalEnv('OPENAI_API_KEY', ''),

  // Transfer detection
  transferWindowDays: parseInt(optionalEnv('TRANSFER_DETECTION_WINDOW_DAYS', '3'), 10),

  // AWS (Phase 4 — optional until deployment)
  awsRegion:    optionalEnv('AWS_REGION', 'ca-central-1'),
  s3BucketName: optionalEnv('S3_BUCKET_NAME', ''),
} as const;

// Validate AI keys at startup if AI is enabled
// if (config.aiEnabled) {
//     if (config.aiProvider === 'anthropic' && !config.anthropicApiKey) {
//       throw new Error('ANTHROPIC_API_KEY is required when AI_PROVIDER=anthropic');
//     }
//     if (config.aiProvider === 'openai' && !config.openaiApiKey) {
//       throw new Error('OPENAI_API_KEY is required when AI_PROVIDER=openai');
//     }
// }

/**TODO See below
 * Unsafe parseFloat/parseInt Without Validation 
 * If someone sets AI_CONFIDENCE_THRESHOLD=abc, [parseFloat]
 * silently returns NaN, which will cause all AI results to pass or 
 * fail the threshold check unexpectedly. Add guards:
 * 
 * as const Prevents Runtime Mutation but Not Type Widening on aiProvider 
 * The as 'anthropic' | 'openai' assertion is correct, but it's worth adding a 
 * runtime guard since the value comes from user input:
 * 
 */