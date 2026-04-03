import { and, eq, gte, inArray, lte, ne, sql } from 'drizzle-orm';
import { config } from '@/lib/config';
import { db } from '@/db';
import { logger } from '@/middleware/logger';
import { transactions } from '@/db/schema';

const WINDOW_DAYS = () => config.transferWindowDays;

// Transfer keywords — descriptions containing these are candidate transfers
// Matches the ADD sentinel rules already seeded in categorization_rules
const TRANSFER_KEYWORDS = [
  'e-tfr',
  'e-transfer',
  'tfr-to',
  'tfr-fr',
  'trf-to',
  'trf-fr',
  'transfer',
  'interac',
  'payment thank you',
  'paiement merci',
  'payment received',
  'bill pymt',
];

export interface TransferCandidate {
  transactionId: string;
  matchedTransactionId: string | null; // null if only description match, no amount pair
  detectionMethod: 'description' | 'amount' | 'both';
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Run transfer detection on a set of newly imported transactions.
 * Called by the import service after all rows are inserted.
 *
 * Detection strategy:
 *   1. Description match — transaction description contains a known transfer keyword
 *   2. Amount pair match — another transaction in a different account has the inverse
 *      amount within the configured time window
 *
 * Both matches together = high confidence, auto-flag both sides.
 * Description only = medium confidence, flag for review.
 * Amount only = low confidence, flag for review.
 */
export async function detectTransfers(
  importedTransactionIds: string[],
  userId: string
): Promise<TransferCandidate[]> {
  if (importedTransactionIds.length === 0) return [];

  // Fetch the newly imported transactions
  const newTxns = await db
    .select({
      id: transactions.id,
      date: transactions.date,
      description: transactions.description,
      amount: transactions.amount,
      accountId: transactions.accountId,
      isTransfer: transactions.isTransfer,
    })
    .from(transactions)
    .where(inArray(transactions.id, importedTransactionIds));

  const candidates: TransferCandidate[] = [];

  for (const txn of newTxns) {
    // Skip transactions already confirmed as transfers
    if (txn.isTransfer) continue;

    const descLower = txn.description.toLowerCase();
    const hasTransferKeyword = TRANSFER_KEYWORDS.some((kw) =>
      descLower.includes(kw)
    );

    // Look for an amount pair in a different account within the time window
    const windowStart = offsetDate(txn.date, -WINDOW_DAYS());
    const windowEnd = offsetDate(txn.date, WINDOW_DAYS());
    const inverseAmount = (parseFloat(txn.amount) * -1).toFixed(2);

    const amountMatch = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        and(
          ne(transactions.accountId, txn.accountId),
          eq(transactions.amount, inverseAmount),
          gte(transactions.date, windowStart),
          lte(transactions.date, windowEnd),
          eq(transactions.isTransfer, false),
          // Scope to this user's accounts via a subquery join
          sql`${transactions.accountId} IN (
            SELECT id FROM accounts WHERE user_id = ${userId}
          )`
        )
      )
      .limit(1);

    const hasAmountMatch = amountMatch.length > 0;
    const matchedId = amountMatch[0]?.id ?? null;

    if (hasTransferKeyword && hasAmountMatch) {
      candidates.push({
        transactionId: txn.id,
        matchedTransactionId: matchedId,
        detectionMethod: 'both',
        confidence: 'high',
      });
    } else if (hasTransferKeyword) {
      candidates.push({
        transactionId: txn.id,
        matchedTransactionId: null,
        detectionMethod: 'description',
        confidence: 'medium',
      });
    } else if (hasAmountMatch) {
      candidates.push({
        transactionId: txn.id,
        matchedTransactionId: matchedId,
        detectionMethod: 'amount',
        confidence: 'low',
      });
    }
  }

  // Flag all candidates for review
  if (candidates.length > 0) {
    const idsToFlag = candidates.map((c) => c.transactionId);
    await db
      .update(transactions)
      .set({ flaggedForReview: true })
      .where(inArray(transactions.id, idsToFlag));

    logger.info(
      {
        count: candidates.length,
        importedCount: importedTransactionIds.length,
      },
      'Transfer candidates detected and flagged'
    );
  }

  return candidates;
}

/**
 * Confirm a transfer pair — marks both transactions as transfers
 * and links them via transfer_pair_id.
 */
export async function confirmTransfer(
  transactionId: string,
  pairedTransactionId: string,
  userId: string
): Promise<void> {
  // Verify both transactions belong to this user
  const [txnA, txnB] = await Promise.all([
    getOwnedTransaction(transactionId, userId),
    getOwnedTransaction(pairedTransactionId, userId),
  ]);

  if (!txnA || !txnB) throw new Error('One or both transactions not found');

  await db
    .update(transactions)
    .set({
      isTransfer: true,
      transferPairId: pairedTransactionId,
      flaggedForReview: false,
    })
    .where(eq(transactions.id, transactionId));

  await db
    .update(transactions)
    .set({
      isTransfer: true,
      transferPairId: transactionId,
      flaggedForReview: false,
    })
    .where(eq(transactions.id, pairedTransactionId));
}

/**
 * Confirm a single transaction as a transfer (no paired transaction known).
 * Used when only a description match was found and no pair can be identified.
 */
export async function confirmSingleTransfer(
  transactionId: string,
  userId: string
): Promise<void> {
  const txn = await getOwnedTransaction(transactionId, userId);
  if (!txn) throw new Error('Transaction not found');

  await db
    .update(transactions)
    .set({ isTransfer: true, flaggedForReview: false })
    .where(eq(transactions.id, transactionId));
}

/**
 * Dismiss a transfer candidate — clears the flagged state without marking as transfer.
 */
export async function dismissTransferFlag(
  transactionId: string,
  userId: string
): Promise<void> {
  const txn = await getOwnedTransaction(transactionId, userId);
  if (!txn) throw new Error('Transaction not found');

  await db
    .update(transactions)
    .set({ flaggedForReview: false })
    .where(eq(transactions.id, transactionId));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getOwnedTransaction(transactionId: string, userId: string) {
  const [txn] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(
        eq(transactions.id, transactionId),
        sql`${transactions.accountId} IN (SELECT id FROM accounts WHERE user_id = ${userId})`
      )
    )
    .limit(1);
  return txn ?? null;
}

function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
