/* eslint-disable no-console */
/**
 * Populates the test DB (finance_test) with the test-fixture system categories
 * and rules, replacing any existing system rows.
 *
 * Uses DATABASE_URL_TEST when set, otherwise falls back to DATABASE_URL.
 *
 * Usage (from repo root):
 *   pnpm seed:test-system
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Override DATABASE_URL before the db module loads so we target finance_test.
if (process.env.DATABASE_URL_TEST) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
}

import { resetTestSystemData } from '@/testing/seeders/reset-test-system-data';

async function main() {
  console.log('Seeding test system categories and rules...');
  await resetTestSystemData();
  console.log('Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Test system seed failed:', err);
  process.exit(1);
});
