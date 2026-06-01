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
