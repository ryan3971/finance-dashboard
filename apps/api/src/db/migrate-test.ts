import * as dotenv from 'dotenv';
import * as path from 'path';
import { execSync } from 'child_process';

// Load .env from monorepo root
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const testUrl = process.env.DATABASE_URL_TEST;
if (!testUrl) {
  console.error('DATABASE_URL_TEST is not set in .env');
  process.exit(1);
}

// Run drizzle-kit migrate with the test database URL
execSync('drizzle-kit migrate', {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: testUrl },
});