import { and, eq, inArray, notInArray, sql } from 'drizzle-orm';
import Decimal from 'decimal.js';
import { db } from '@/db';
import { accounts, rebalancingGroupTransactions, rebalancingGroups, transactions, userConfig } from '@/db/schema';
import { REFUND_DETECTION_WINDOW_DAYS } from '@finance/shared/constants';
import type { RebalancingStatus } from '@finance/shared/types/rebalancing';
import { assertDefined } from '@/lib/assert';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Uses UTC arithmetic to avoid local-timezone day-boundary shifts.
// new Date("YYYY-MM-DD") parses as UTC midnight, but getDate()/setDate()
// operate in local time — in a non-UTC environment the result would be off
// by one day. Splitting the string and using Date.UTC keeps everything UTC.
function offsetDate(dateStr: string, days: number): string {
  const parts = dateStr.split('-').map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// Amount comparison uses string equality because Drizzle returns numeric(12,2)
// columns with consistent two-decimal formatting ("50.00", not "50"). If that
// ever changes, the match will silently fail — a Decimal comparison would be safer.
function negateAmount(amount: string): string {
  if (new Decimal(amount).isZero()) return amount.replace(/^-/, '');
  return amount.startsWith('-') ? amount.slice(1) : `-${amount}`;
}

async function getRefundWindowDays(userId: string): Promise<number> {
  const [row] = await db
    .select({ refundDetectionWindowDays: userConfig.refundDetectionWindowDays })
    .from(userConfig)
    .where(eq(userConfig.userId, userId))
    .limit(1);
  return row?.refundDetectionWindowDays ?? REFUND_DETECTION_WINDOW_DAYS;
}

// ─── Detection ────────────────────────────────────────────────────────────────

/**
 * Scans all eligible same-account transactions for inverse-amount pairs within
 * the configured window. Creates an open refund group for each detected pair.
 *
 * Eligibility:
 *   - Not already confirmed as a transfer (isTransfer = false)
 *   - Not already a member of any rebalancing group
 *
 * Matching:
 *   - Same account
 *   - Exact inverse amount (charge + credit of identical absolute value)
 *   - Within the refund detection window on either side of the transaction date
 *
 * Running detection twice produces no duplicate groups because both transactions
 * are added to `matchedIds` after pairing, and a second scan finds them already
 * grouped (excluded by the NOT IN subquery).
 */
export async function detectRefunds(userId: string): Promise<{ created: number }> {
  const windowDays = await getRefundWindowDays(userId);

  // Scoped to the current user so the subquery only touches this user's
  // groups rather than scanning every row in the table.
  const groupedSubquery = db
    .select({ id: rebalancingGroupTransactions.transactionId })
    .from(rebalancingGroupTransactions)
    .innerJoin(
      rebalancingGroups,
      eq(rebalancingGroupTransactions.groupId, rebalancingGroups.id)
    )
    .where(eq(rebalancingGroups.userId, userId));

  const eligible = await db
    .select({
      id: transactions.id,
      date: transactions.date,
      amount: transactions.amount,
      accountId: transactions.accountId,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(
      and(
        eq(accounts.userId, userId),
        eq(transactions.isTransfer, false),
        notInArray(transactions.id, groupedSubquery)
      )
    );

  if (eligible.length === 0) return { created: 0 };

  const dates = eligible.map((t) => t.date);
  const batchStart = offsetDate(dates.reduce((a, b) => (a < b ? a : b)), -windowDays);
  const batchEnd = offsetDate(dates.reduce((a, b) => (a > b ? a : b)), windowDays);
  const uniqueInverseAmounts = [...new Set(eligible.map((t) => negateAmount(t.amount)))];

  const pairPool = await db
    .select({
      id: transactions.id,
      date: transactions.date,
      amount: transactions.amount,
      accountId: transactions.accountId,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(
      and(
        eq(accounts.userId, userId),
        eq(transactions.isTransfer, false),
        notInArray(transactions.id, groupedSubquery),
        inArray(transactions.amount, uniqueInverseAmounts),
        sql`${transactions.date} >= ${batchStart}`,
        sql`${transactions.date} <= ${batchEnd}`
      )
    );

  const matchedIds = new Set<string>();
  const pairs: { chargeId: string; creditId: string }[] = [];

  for (const txn of eligible) {
    if (matchedIds.has(txn.id)) continue;

    const windowStart = offsetDate(txn.date, -windowDays);
    const windowEnd = offsetDate(txn.date, windowDays);

    // Pick the temporally closest candidate to avoid pairing a charge with the
    // wrong month's refund when the same amount recurs on a regular schedule.
    // Use Decimal comparison to be immune to numeric format differences ("50"
    // vs "50.00") even though Drizzle consistently returns two decimal places
    // for numeric(12,2) columns.
    const txnTime = new Date(txn.date).getTime();
    const txnDecimal = new Decimal(txn.amount);
    const match = pairPool
      .filter(
        (m) =>
          !matchedIds.has(m.id) &&
          m.id !== txn.id &&
          m.accountId === txn.accountId &&
          new Decimal(m.amount).plus(txnDecimal).isZero() &&
          m.date >= windowStart &&
          m.date <= windowEnd
      )
      .sort((a, b) => {
        const distA = Math.abs(new Date(a.date).getTime() - txnTime);
        const distB = Math.abs(new Date(b.date).getTime() - txnTime);
        return distA - distB;
      })[0];

    if (!match) continue;

    matchedIds.add(txn.id);
    matchedIds.add(match.id);

    // Charge (negative) is source; credit (positive) is offset.
    const chargeId = txnDecimal.isNegative() ? txn.id : match.id;
    const creditId = txnDecimal.isNegative() ? match.id : txn.id;
    pairs.push({ chargeId, creditId });
  }

  if (pairs.length === 0) return { created: 0 };

  // All groups are created inside a single transaction so detection is
  // atomic — either all pairs are recorded or none are.
  await db.transaction(async (tx) => {
    for (const { chargeId, creditId } of pairs) {
      const [group] = await tx
        .insert(rebalancingGroups)
        .values({
          userId,
          label: 'Refund',
          type: 'refund',
          status: 'open' satisfies RebalancingStatus,
        })
        .returning({ id: rebalancingGroups.id });

      assertDefined(group, 'Expected insert to return the new refund group');

      await tx.insert(rebalancingGroupTransactions).values([
        { groupId: group.id, transactionId: chargeId, role: 'source' },
        { groupId: group.id, transactionId: creditId, role: 'offset' },
      ]);
    }
  });

  return { created: pairs.length };
}
