import * as dotenv from 'dotenv';
import * as path from 'path';
import { execSync } from 'child_process';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const testUrl = process.env.DATABASE_URL_TEST;
if (!testUrl) {
  console.error('DATABASE_URL_TEST is not set in .env');
  process.exit(1);
}

execSync('tsx src/db/seeds/index.ts', {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: testUrl },
});
