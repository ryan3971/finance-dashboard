import { sql } from 'drizzle-orm';
import { transactions } from '@/db/schema';

/**
 * Returns a Drizzle SQL condition that excludes transactions belonging to
 * resolved refund groups owned by the given user. Use inside an `and()` clause
 * on any dashboard query to prevent confirmed refund pairs from appearing in
 * expense or income aggregates.
 *
 * The userId filter on rebalancing_groups scopes the subquery to the requesting
 * user, avoiding a full-table scan across all users' resolved refund groups.
 *
 * Uses raw SQL rather than a Drizzle subquery because Drizzle's type system
 * does not support NOT IN (SELECT ...) natively. Drizzle parameterizes the
 * interpolated userId so there is no injection risk. Table names are hardcoded
 * strings — a DB rename would not be caught by TypeScript, so keep in sync
 * with schema.ts if tables are ever renamed.
 */
export function resolvedRefundExclusion(userId: string) {
  return sql`${transactions.id} NOT IN (
    SELECT rgt.transaction_id
    FROM rebalancing_group_transactions rgt
    JOIN rebalancing_groups rg ON rg.id = rgt.group_id
    WHERE rg.type = 'refund'
      AND rg.status = 'resolved'
      AND rg.user_id = ${userId}
  )`;
}
