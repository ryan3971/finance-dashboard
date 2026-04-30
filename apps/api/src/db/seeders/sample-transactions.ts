/* eslint-disable no-console */
import * as fs from 'fs';
import * as path from 'path';
import { db as defaultDb } from '@/db';
import { processImport } from '@/features/imports/import.service';
import { STAGING_ACCOUNTS } from '@/db/seeds/staging/accounts';
import { DEV_ACCOUNTS } from '@/db/seeds/test/accounts';
import type { SeedEnv } from './system-categories';

type DbLike = typeof defaultDb;

function getAccountsData(env: SeedEnv) {
  if (env === 'staging') return STAGING_ACCOUNTS;
  return DEV_ACCOUNTS;
}

function getCsvDir(env: SeedEnv): string {
  if (env === 'staging') {
    return path.join(__dirname, '../seeds/staging/csv');
  }
  return path.join(__dirname, '../../testing/csv');
}

/**
 * Import CSV fixture transactions for each account.
 * Requires seedSampleAccounts to have run first so the accountIds map is populated.
 * Skips CSV files that do not exist (e.g. Questrade TFSA in test env).
 */
export async function seedSampleTransactions(
  userId: string,
  env: SeedEnv,
  accountIds: Record<string, string>,
  _db: DbLike = defaultDb
): Promise<void> {
  const data = getAccountsData(env);
  const csvDir = getCsvDir(env);

  for (const def of data) {
    const accountId = accountIds[def.name];
    if (!accountId) {
      console.warn(`  ⚠ No account ID for "${def.name}" — skipping import`);
      continue;
    }

    const csvPath = path.join(csvDir, def.fixture.file);
    if (!fs.existsSync(csvPath)) {
      console.warn(`  ⚠ Fixture not found, skipping: ${csvPath}`);
      continue;
    }

    const buffer = fs.readFileSync(csvPath);

    try {
      const result = await processImport(userId, accountId, def.fixture.file, buffer);

      if (result.importedCount > 0) {
        console.log(
          `  ${def.name}: imported ${result.importedCount} rows` +
            (result.flaggedCount > 0 ? `, ${result.flaggedCount} flagged` : '')
        );
      } else if (result.duplicateCount > 0) {
        console.log(
          `  ${def.name}: already imported (${result.duplicateCount} duplicates skipped)`
        );
      }

      if (result.errorCount > 0) {
        console.warn(
          `  ${def.name}: ⚠ ${result.errorCount} errors — ${result.errors.join(', ')}`
        );
      }
    } catch (err) {
      console.error(`  ${def.name}: ✗ Import failed — ${String(err)}`);
    }
  }
}
