/* eslint-disable no-console */
/**
 * Bootstrap production — installs the full system category and rule set only.
 * Does not create any users or sample data.
 *
 * Usage (from repo root):
 *   pnpm seed:production
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { addSystemCategories } from '@/db/seeders/system-categories';
import { addSystemRules } from '@/db/seeders/system-rules';
import { backfillCategoriesToAllUsers } from '@/db/seeders/backfill-categories';
import { backfillRulesToAllUsers } from '@/db/seeders/backfill-rules';

async function main() {
  console.log('Finance Dashboard — seed:production');
  console.log(
    `Database: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@')}`
  );

  await addSystemCategories('system');
  await addSystemRules('system');
  await backfillCategoriesToAllUsers();
  await backfillRulesToAllUsers();

  console.log('\nDone.');
  process.exit(0);
}

main().catch((err) => {
  console.error('\nProduction seed failed:', err);
  process.exit(1);
});
