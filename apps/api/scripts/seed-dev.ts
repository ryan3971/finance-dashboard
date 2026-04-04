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

import { accounts, users } from '../src/db/schema';
import { and, eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '../src/db/index';
import { processImport } from '../src/features/imports/pipeline/import.service';

// ─── Config ───────────────────────────────────────────────────────────────────

const DEV_USER = {
  email: 'dev@example.com',
  password: 'password123',
};

const FIXTURES_DIR = path.resolve(
  __dirname,
  '../src/features/imports/adapters/__fixtures__'
);

const DEV_ACCOUNTS = [
  {
    name: 'Amex',
    type: 'credit',
    institution: 'amex',
    isCredit: true,
    fixture: { file: 'amex.csv' },
  },
  {
    name: 'CIBC Mastercard',
    type: 'credit',
    institution: 'cibc',
    isCredit: true,
    fixture: { file: 'cibc.csv' },
  },
  {
    name: 'TD Chequing',
    type: 'chequing',
    institution: 'td',
    isCredit: false,
    fixture: { file: 'td.csv' },
  },
  {
    name: 'Questrade TFSA',
    type: 'tfsa',
    institution: 'questrade',
    isCredit: false,
    fixture: { file: 'questrade.csv' },
  },
];

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
    log(`Already exists: ${existing[0].email} (id: ${existing[0].id})`);
    return existing[0].id;
  }

  const passwordHash = await bcrypt.hash(DEV_USER.password, 12);
  const [user] = await db
    .insert(users)
    .values({ email: DEV_USER.email, passwordHash })
    .returning({ id: users.id, email: users.email });

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
      log(`Already exists: ${def.name} (id: ${existing[0].id})`);
      accountIds[def.name] = existing[0].id;
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
        log(`${def.name}: already imported (${result.duplicateCount} duplicates skipped)`);
      }

      if (result.errorCount > 0) {
        log(`${def.name}: ⚠ ${result.errorCount} errors — ${result.errors.join(', ')}`);
      }
    } catch (err) {
      log(`${def.name}: ✗ Import failed — ${String(err)}`);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Finance Dashboard — dev seed');
  console.log(`Database: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@')}`);

  const userId = await ensureUser();
  const accountIds = await ensureAccounts(userId);
  await importFixtures(userId, accountIds);

  section('Done');
  console.log('\n  Login credentials:');
  console.log(`    Email:    ${DEV_USER.email}`);
  console.log(`    Password: ${DEV_USER.password}`);
  console.log('\n  API: POST http://localhost:3001/api/v1/auth/login');
  console.log('  Web: http://localhost:5173\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('\nDev seed failed:', err);
  process.exit(1);
});
