/* eslint-disable no-console */
/**
 * Loads staging sample data into an existing user's account.
 *
 * Usage (from repo root):
 *   pnpm seed:user --userId=<uuid> [--env=staging|test]
 *
 * The user must already exist and have no accounts.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

import { db } from '@/db';
import { accounts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { addSystemCategories } from '@/db/seeders/system-categories';
import { addSystemRules } from '@/db/seeders/system-rules';
import { seedUserCategories } from '@/db/seeders/user-categories';
import { seedUserRules } from '@/db/seeders/user-rules';
import { seedSampleAccounts } from '@/db/seeders/sample-accounts';
import { seedSampleTransactions } from '@/db/seeders/sample-transactions';
import { seedSampleAnticipatedBudget } from '@/db/seeders/sample-anticipated-budget';
import { seedSampleRebalancingGroups } from '@/db/seeders/sample-rebalancing-groups';
import type { SeedEnv } from '@/db/seeders/system-categories';

const VALID_ENVS: SeedEnv[] = ['system', 'staging', 'test'];

function parseArgs(): { userId: string; env: SeedEnv } {
  const userIdArg = process.argv
    .find((a) => a.startsWith('--userId='))
    ?.split('=')[1];
  const envArg =
    process.argv.find((a) => a.startsWith('--env='))?.split('=')[1] ??
    'staging';

  if (!userIdArg) {
    console.error(
      'Usage: pnpm seed:user --userId=<uuid> [--env=staging|test]'
    );
    process.exit(1);
  }

  if (!VALID_ENVS.includes(envArg as SeedEnv)) {
    console.error(`--env must be one of: ${VALID_ENVS.join(', ')}`);
    process.exit(1);
  }

  return { userId: userIdArg, env: envArg as SeedEnv };
}

async function main() {
  const { userId, env } = parseArgs();

  console.log(`Finance Dashboard — seed:user (userId=${userId}, env=${env})`);

  const [existing] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);

  if (existing) {
    console.error('User already has accounts. Reset first via POST /api/v1/user-config/reset');
    process.exit(1);
  }

  await addSystemCategories(env);
  await addSystemRules(env);
  await seedUserCategories(userId, db);
  await seedUserRules(userId, db);

  const accountIds = await seedSampleAccounts(userId, env);
  await seedSampleTransactions(userId, env, accountIds);
  await seedSampleAnticipatedBudget(userId, env);
  await seedSampleRebalancingGroups(userId, env);

  console.log('Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error('seed:user failed:', err);
  process.exit(1);
});
