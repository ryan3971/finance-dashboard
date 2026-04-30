/* eslint-disable no-console */
/**
 * Loads fixture sample data into an existing user's account.
 *
 * Usage (from repo root):
 *   pnpm seed:user --userId=<uuid>
 *
 * The user must already exist (registered via the API) and have no accounts.
 * If the account already has data, reset it first via POST /api/v1/user-config/reset.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { loadSampleData } from '@/seed/seed.service';

const arg = process.argv.find((a) => a.startsWith('--userId='));
const userId = arg?.split('=')[1];

if (!userId) {
  console.error('Usage: pnpm seed:user --userId=<uuid>');
  process.exit(1);
}

console.log(`Loading sample data for user ${userId}...`);

loadSampleData(userId)
  .then(() => {
    console.log('Sample data loaded successfully.');
    process.exit(0);
  })
  .catch((err: unknown) => {
    console.error('Failed to load sample data:', err);
    process.exit(1);
  });
