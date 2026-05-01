/* eslint-disable no-console */
/**
 * Bootstrap the staging DB with a dev user and full sample data set.
 *
 * Usage (from repo root):
 *   pnpm seed:staging
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

import { and, eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '@/db';
import {
  accounts,
  anticipatedBudget,
  categories,
  categorizationRules,
  rebalancingGroups,
  users,
} from '@/db/schema';
import { addSystemCategories } from '@/db/seeders/system-categories';
import { addSystemRules } from '@/db/seeders/system-rules';
import { seedUserCategories } from '@/db/seeders/user-categories';
import { seedUserRules } from '@/db/seeders/user-rules';
import { seedSampleAccounts } from '@/db/seeders/sample-accounts';
import { seedSampleTransactions } from '@/db/seeders/sample-transactions';
import { seedSampleAnticipatedBudget } from '@/db/seeders/sample-anticipated-budget';
import { seedSampleRebalancingGroups } from '@/db/seeders/sample-rebalancing-groups';
import { STAGING_REBALANCING_GROUPS } from '@/db/seeds/staging/rebalancing-groups';
import { DEV_USER } from '@/db/seeds/test/users';
import { assertDefined } from '@/lib/assert';

function log(msg: string) {
  console.log(`  ${msg}`);
}

function section(title: string) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 50 - title.length))}`);
}

async function ensureUser(): Promise<string> {
  section('Dev user');

  const [existing] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, DEV_USER.email))
    .limit(1);

  if (existing) {
    log(`Already exists: ${existing.email} (id: ${existing.id})`);
    const userId = existing.id;

    const [uncategorized] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(eq(categories.userId, userId), eq(categories.name, 'Uncategorized'))
      )
      .limit(1);

    if (!uncategorized) {
      log('Categories missing — seeding now...');
      await seedUserCategories(userId, db);
    }

    const [existingRule] = await db
      .select({ id: categorizationRules.id })
      .from(categorizationRules)
      .where(eq(categorizationRules.userId, userId))
      .limit(1);

    if (!existingRule) {
      log('Rules missing — seeding now...');
      await seedUserRules(userId, db);
    }

    return userId;
  }

  const passwordHash = await bcrypt.hash(DEV_USER.password, 12);
  const user = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(users)
      .values({ email: DEV_USER.email, passwordHash })
      .returning({ id: users.id, email: users.email });
    assertDefined(created, 'Expected user insert to return a row');

    await seedUserCategories(created.id, tx);
    await seedUserRules(created.id, tx);
    return created;
  });

  log(`Created: ${user.email} (id: ${user.id})`);
  log(`Password: ${DEV_USER.password}`);
  return user.id;
}

async function ensureAnticipatedBudget(userId: string): Promise<void> {
  section('Anticipated budget');

  const [existing] = await db
    .select({ id: anticipatedBudget.id })
    .from(anticipatedBudget)
    .where(eq(anticipatedBudget.userId, userId))
    .limit(1);

  if (existing) {
    log('Already seeded — skipping');
    return;
  }

  const entryIds = await seedSampleAnticipatedBudget(userId, 'staging');
  log(`Seeded ${entryIds.size} entries`);
}

async function ensureRebalancingGroups(userId: string): Promise<void> {
  section('Rebalancing groups');

  const [existing] = await db
    .select({ id: rebalancingGroups.id })
    .from(rebalancingGroups)
    .where(eq(rebalancingGroups.userId, userId))
    .limit(1);

  if (existing) {
    log('Already seeded — skipping');
    return;
  }

  await seedSampleRebalancingGroups(userId, 'staging');
  log(`Seeded ${STAGING_REBALANCING_GROUPS.length} groups`);
}

async function ensureAccounts(userId: string): Promise<void> {
  section('Accounts');

  const [existing] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);

  if (existing) {
    log('Already seeded — skipping');
    return;
  }

  const accountIds = await seedSampleAccounts(userId, 'staging');
  section('Fixture imports');
  await seedSampleTransactions(userId, 'staging', accountIds);
}

async function main() {
  console.log('Finance Dashboard — seed:staging');
  console.log(
    `Database: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@')}`
  );

  await addSystemCategories('staging');
  await addSystemRules('staging');

  const userId = await ensureUser();
  await ensureAccounts(userId);
  await ensureAnticipatedBudget(userId);
  await ensureRebalancingGroups(userId);

  section('Done');
  console.log('\n  Login credentials:');
  console.log(`    Email:    ${DEV_USER.email}`);
  console.log(`    Password: ${DEV_USER.password}`);
  console.log('\n  API: POST http://localhost:3000/api/v1/auth/login');
  console.log('  Web: http://localhost:5173\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('\nStaging seed failed:', err);
  process.exit(1);
});
