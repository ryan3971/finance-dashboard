import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { seedSystemCategories } from './seed-test-system-data';

/**
 * Full reset called once per test session from global-setup.ts.
 *
 * Two responsibilities:
 *   1. Wipe all data — including stale rows from a crashed or failed previous
 *      run whose per-test cleanDatabase() never fired. RESTART IDENTITY resets
 *      sequences; CASCADE satisfies FK ordering automatically.
 *   2. Re-seed system categories so every test file sees the expected category
 *      tree without having to set it up itself.
 *
 * System categorization rules are intentionally NOT re-seeded here. Tests that
 * need a system rule (e.g. "returns 403 when patching a system rule") create one
 * directly via categorizationRuleFixture(), which registers the rule ID for
 * per-worker cleanup. Globally seeding rules caused a race condition in parallel
 * mode: one worker's cleanDatabase() would wipe another worker's just-created
 * fixture rule before the assertion ran.
 */
export async function resetTestSystemData(): Promise<void> {
  await db.execute(sql`
    TRUNCATE
      transactions,
      investment_transactions,
      investment_snapshots,
      contribution_records,
      imports,
      accounts,
      refresh_tokens,
      categorization_rules,
      tags,
      anticipated_budget_months,
      anticipated_budget,
      user_config,
      rebalancing_groups,
      categories,
      users
    RESTART IDENTITY CASCADE
  `);

  await seedSystemCategories();
}
