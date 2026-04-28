/* eslint-disable no-console */
/**
 * scripts/seed-dev.ts
 *
 * Populates finance_dev with a baseline set of data for manual development
 * and Bruno testing. Safe to re-run — idempotent throughout.
 *
 * Creates:
 *   1. A dev user     (dev@example.com / password123)
 *   2. Four accounts  (Amex credit, CIBC chequing, TD chequing, Questrade TFSA)
 *   3. Fixture imports for each account using the test fixture files
 *
 * Usage (from repo root):
 *   pnpm seed:dev
 *
 * After running:
 *   - Log in at http://localhost:5173 with dev@example.com / password123
 *   - Or POST /api/v1/auth/login in Bruno to get a token
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import {
  accounts,
  anticipatedBudget,
  categories,
  categorizationRules,
  rebalancingGroups,
  users,
} from './schema';
import { and, eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from './index';
import { processImport } from '../features/imports/import.service';
import { seedUserCategories, seedUserRules } from './seed-categories';
import { DEV_ACCOUNTS } from '../testing/seeds/accounts';
import { DEV_USER } from '../testing/seeds/users';
import { assertDefined } from '@/lib/assert';
import { resetTestSystemData } from '@/testing/seeders/reset-system-data';
import { seedTestAnticipatedBudget } from '@/testing/seeders/seed-anticipated-budget';
import { seedTestRebalancingGroups } from '@/testing/seeders/seed-rebalancing-groups';
import { TEST_REBALANCING_GROUPS } from '@/testing/seeds/rebalancing-groups';

// ─── Config ───────────────────────────────────────────────────────────────────

const FIXTURES_DIR = path.resolve(__dirname, '../testing/csv');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(`  ${msg}`);
}

function section(title: string) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 50 - title.length))}`);
}

// ─── Steps ───────────────────────────────────────────────────────────────────

async function ensureUser(): Promise<string> {
  section('Dev user');

  const existing = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, DEV_USER.email))
    .limit(1);

  if (existing.length > 0) {
    const existingUser = existing[0];
    assertDefined(existingUser, 'Expected existing user row');
    log(`Already exists: ${existingUser.email} (id: ${existingUser.id})`);
    const userId = existingUser.id;

    // User may have been created before category seeding was added — ensure categories exist
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

async function ensureAccounts(userId: string): Promise<Record<string, string>> {
  section('Accounts');
  const accountIds: Record<string, string> = {};

  for (const def of DEV_ACCOUNTS) {
    const existing = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.name, def.name)))
      .limit(1);

    if (existing.length > 0) {
      const existingAccount = existing[0];
      assertDefined(existingAccount, 'Expected existing account row');
      log(`Already exists: ${def.name} (id: ${existingAccount.id})`);
      accountIds[def.name] = existingAccount.id;
      continue;
    }

    const [account] = await db
      .insert(accounts)
      .values({
        userId,
        name: def.name,
        type: def.type,
        institution: def.institution,
        isCredit: def.isCredit,
        currency: 'CAD',
      })
      .returning({ id: accounts.id });
    assertDefined(account, 'Expected account insert to return a row');

    log(`Created: ${def.name} (id: ${account.id})`);
    accountIds[def.name] = account.id;
  }

  return accountIds;
}

async function importFixtures(
  userId: string,
  accountIds: Record<string, string>
): Promise<void> {
  section('Fixture imports');

  for (const def of DEV_ACCOUNTS) {
    const accountId = accountIds[def.name];
    assertDefined(
      accountId,
      `Expected account ID for "${def.name}" in accountIds map`
    );
    const fixturePath = path.join(FIXTURES_DIR, def.fixture.file);

    if (!fs.existsSync(fixturePath)) {
      log(`⚠ Fixture not found, skipping: ${fixturePath}`);
      continue;
    }

    const buffer = fs.readFileSync(fixturePath);

    try {
      const result = await processImport(
        userId,
        accountId,
        def.fixture.file,
        buffer
      );

      if (result.importedCount > 0) {
        log(
          `${def.name}: imported ${result.importedCount} rows` +
            (result.flaggedCount > 0 ? `, ${result.flaggedCount} flagged` : '')
        );
      } else if (result.duplicateCount > 0) {
        log(
          `${def.name}: already imported (${result.duplicateCount} duplicates skipped)`
        );
      }

      if (result.errorCount > 0) {
        log(
          `${def.name}: ⚠ ${result.errorCount} errors — ${result.errors.join(', ')}`
        );
      }
    } catch (err) {
      log(`${def.name}: ✗ Import failed — ${String(err)}`);
    }
  }
}

// ─── Steps (continued) ────────────────────────────────────────────────────────

async function ensureAnticipatedBudget(userId: string): Promise<void> {
  section('Anticipated budget');

  const existing = await db
    .select({ id: anticipatedBudget.id })
    .from(anticipatedBudget)
    .where(eq(anticipatedBudget.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    log('Already seeded — skipping');
    return;
  }

  const entryIds = await seedTestAnticipatedBudget(userId);
  log(`Seeded ${entryIds.size} entries`);
}

async function ensureRebalancingGroups(userId: string): Promise<void> {
  section('Rebalancing groups');

  const existing = await db
    .select({ id: rebalancingGroups.id })
    .from(rebalancingGroups)
    .where(eq(rebalancingGroups.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    log('Already seeded — skipping');
    return;
  }

  await seedTestRebalancingGroups(userId);
  log(`Seeded ${TEST_REBALANCING_GROUPS.length} groups`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Finance Dashboard — dev seed');
  console.log(
    `Database: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@')}`
  );

  await resetTestSystemData();
  const userId = await ensureUser();
  const accountIds = await ensureAccounts(userId);
  await importFixtures(userId, accountIds);
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
  console.error('\nDev seed failed:', err);
  process.exit(1);
});
