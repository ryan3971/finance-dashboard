import { and, eq } from 'drizzle-orm';
import { assertDefined } from '@/lib/assert';
import { db as defaultDb } from '@/db';
import { accounts } from '@/db/schema';
import { STAGING_ACCOUNTS } from '@/db/seeds/staging/accounts';
import { DEV_ACCOUNTS } from '@/db/seeds/test/accounts';
import type { SeedEnv } from './system-categories';
import type { AccountType, Institution } from '@finance/shared/constants';

type DbLike = typeof defaultDb;

function getAccountsData(env: SeedEnv) {
  if (env === 'staging') return STAGING_ACCOUNTS;
  return DEV_ACCOUNTS;
}

/**
 * Insert sample accounts for a user based on the given env data set.
 * Idempotent — skips accounts that already exist by name.
 * Returns a name → id map for use by subsequent seeders.
 */
export async function seedSampleAccounts(
  userId: string,
  env: SeedEnv,
  db: DbLike = defaultDb
): Promise<Record<string, string>> {
  const data = getAccountsData(env);
  const accountIds: Record<string, string> = {};

  for (const def of data) {
    const [existing] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.name, def.name)))
      .limit(1);

    if (existing) {
      accountIds[def.name] = existing.id;
      continue;
    }

    const [account] = await db
      .insert(accounts)
      .values({
        userId,
        name: def.name,
        type: def.type as AccountType,
        institution: def.institution as Institution,
        currency: 'CAD',
        isCredit: def.isCredit,
      })
      .returning({ id: accounts.id });
    assertDefined(account, `Expected account insert to return a row for "${def.name}"`);

    accountIds[def.name] = account.id;
  }

  return accountIds;
}
