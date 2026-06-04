import { and, eq, gte, inArray, isNull, lte, notInArray, or, sql } from 'drizzle-orm';
import Decimal from 'decimal.js';
import { config } from '@/lib/config';
import { db } from '@/db';
import { logger } from '@/middleware/logger';
import { transactions, userConfig } from '@/db/schema';
import { CATEGORY_SOURCE, TRANSFER_DETECTION_WINDOW_DAYS, TRANSFER_KEYWORDS } from '@finance/shared/constants';
import { TransferError, TransferErrorCode } from './transfer-detection.errors';

async function getTransferWindowDays(userId: string): Promise<number> {
  const [row] = await db
    .select({ transferDetectionWindowDays: userConfig.transferDetectionWindowDays })
    .from(userConfig)
    .where(eq(userConfig.userId, userId))
    .limit(1);
  // User DB value > env var > shared constant fallback
  return row?.transferDetectionWindowDays ?? config.transferWindowDays ?? TRANSFER_DETECTION_WINDOW_DAYS;
}

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

  // Fetch the newly imported transactions, scoped to this user
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
    .where(
      and(inArray(transactions.id, importedTransactionIds), ownedByUser(userId))
    );

  // Only consider transactions not already confirmed as transfers
  const activeTxns = newTxns.filter((t) => !t.isTransfer);
  if (activeTxns.length === 0) return [];

  // Batch all amount-pair lookups into one query, then match in memory per txn.
  // This avoids an N+1 pattern (one DB round-trip per transaction).
  const windowDays = await getTransferWindowDays(userId);
  const dates = activeTxns.map((t) => t.date);
  const batchWindowStart = offsetDate(
    dates.reduce((a, b) => (a < b ? a : b)),
    -windowDays
  );
  const batchWindowEnd = offsetDate(
    dates.reduce((a, b) => (a > b ? a : b)),
    windowDays
  );
  const uniqueInverseAmounts = [
    ...new Set(activeTxns.map((t) => negateAmount(t.amount))),
  ];

  const pairCandidates = await db
    .select({
      id: transactions.id,
      amount: transactions.amount,
      date: transactions.date,
      accountId: transactions.accountId,
    })
    .from(transactions)
    .where(
      and(
        inArray(transactions.amount, uniqueInverseAmounts),
        gte(transactions.date, batchWindowStart),
        lte(transactions.date, batchWindowEnd),
        eq(transactions.isTransfer, false),
        ownedByUser(userId)
      )
    );

  const candidates: TransferCandidate[] = [];

  for (const txn of activeTxns) {
    const descLower = txn.description.toLowerCase();
    const hasTransferKeyword = TRANSFER_KEYWORDS.some((kw) =>
      descLower.includes(kw)
    );

    const inverseAmount = negateAmount(txn.amount);
    const windowStart = offsetDate(txn.date, -windowDays);
    const windowEnd = offsetDate(txn.date, windowDays);

    const amountMatch = pairCandidates.find(
      (m) =>
        m.accountId !== txn.accountId &&
        m.amount === inverseAmount &&
        m.date >= windowStart &&
        m.date <= windowEnd
    );
    const hasAmountMatch = amountMatch !== undefined;
    const matchedId = amountMatch?.id ?? null;

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

  // Flag all candidates for review and persist pair suggestions
  if (candidates.length > 0) {
    const idsToFlag = candidates.map((c) => c.transactionId);
    const paired = candidates.filter(
      (c): c is typeof c & { matchedTransactionId: string } =>
        c.matchedTransactionId !== null
    );

    await db.transaction(async (tx) => {
      await tx
        .update(transactions)
        .set({ flaggedForReview: true })
        .where(inArray(transactions.id, idsToFlag));

      // Write transferMatchId bidirectionally so either side can confirm with the pre-populated pair
      for (const c of paired) {
        await tx
          .update(transactions)
          .set({ transferMatchId: c.matchedTransactionId })
          .where(eq(transactions.id, c.transactionId));
        await tx
          .update(transactions)
          .set({ transferMatchId: c.transactionId })
          .where(eq(transactions.id, c.matchedTransactionId));
      }
    });

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
 * Run transfer detection across all unmatched transactions for a user.
 *
 * Eligible transactions must satisfy all three conditions:
 *   1. Not already a confirmed transfer (isTransfer = false)
 *   2. Not already flagged as a transfer candidate (flaggedForReview = false)
 *   3. Not already explicitly categorized by the user or their rules
 *      (categorySource NOT IN ('manual', 'rule'))
 *
 * Condition 3 is necessary because both patchTransaction and applyRules clear
 * flaggedForReview as a side-effect of categorization.  Without it, a transaction
 * that was previously flagged as a transfer candidate, categorized by a rule, and
 * thereby had its flaggedForReview cleared would be re-detected on the next scan.
 * Excluding manual/rule-sourced transactions respects the user's explicit decision.
 *
 * Note: description-only candidates (no matched amount pair, confidence =
 * 'medium') are flagged for review but have no matchedTransactionId, so they
 * do not contribute to the returned pair count.  The count reflects only pairs
 * where both sides were successfully linked.
 */
export async function detectAllTransfers(
  userId: string
): Promise<{ matched: number }> {
  const rows = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(
        eq(transactions.isTransfer, false),
        eq(transactions.flaggedForReview, false),
        or(
          notInArray(transactions.categorySource, [
            CATEGORY_SOURCE.MANUAL,
            CATEGORY_SOURCE.RULE,
          ]),
          isNull(transactions.categorySource)
        ),
        ownedByUser(userId)
      )
    );

  if (rows.length === 0) return { matched: 0 };

  const candidates = await detectTransfers(
    rows.map((r) => r.id),
    userId
  );

  // When both sides of a pair are in the input, detectTransfers emits a
  // candidate for each side. De-duplicate by sorting the two IDs into a key.
  const pairSet = new Set<string>();
  for (const c of candidates) {
    if (c.matchedTransactionId !== null) {
      const key = [c.transactionId, c.matchedTransactionId].sort().join(':');
      pairSet.add(key);
    }
  }

  return { matched: pairSet.size };
}

/**
 * Confirm a transfer — marks the transaction (and its pair, if known) as a
 * transfer and links them via transfer_pair_id.
 */
export async function confirmTransfer(
  transactionId: string,
  pairedTransactionId: string | undefined,
  userId: string
): Promise<void> {
  if (pairedTransactionId) {
    const [txnA, txnB] = await Promise.all([
      getOwnedTransaction(transactionId, userId),
      getOwnedTransaction(pairedTransactionId, userId),
    ]);

    if (!txnA) throw new TransferError(TransferErrorCode.TRANSACTION_NOT_FOUND);
    if (!txnB)
      throw new TransferError(TransferErrorCode.PAIRED_TRANSACTION_NOT_FOUND);
    if (txnA.isTransfer || txnB.isTransfer)
      throw new TransferError(TransferErrorCode.ALREADY_CONFIRMED);

    await db.transaction(async (tx) => {
      await tx
        .update(transactions)
        .set({
          isTransfer: true,
          transferPairId: pairedTransactionId,
          transferMatchId: null,
          flaggedForReview: false,
        })
        .where(eq(transactions.id, transactionId));

      await tx
        .update(transactions)
        .set({
          isTransfer: true,
          transferPairId: transactionId,
          transferMatchId: null,
          flaggedForReview: false,
        })
        .where(eq(transactions.id, pairedTransactionId));
    });
  } else {
    const txn = await getOwnedTransaction(transactionId, userId);
    if (!txn) throw new TransferError(TransferErrorCode.TRANSACTION_NOT_FOUND);
    if (txn.isTransfer)
      throw new TransferError(TransferErrorCode.ALREADY_CONFIRMED);

    await db
      .update(transactions)
      .set({ isTransfer: true, transferMatchId: null, flaggedForReview: false })
      .where(eq(transactions.id, transactionId));
  }
}

/**
 * Unmark a confirmed transfer — clears isTransfer and transferPairId on the
 * target transaction and, if a pair is linked, on the paired transaction too.
 */
export async function unmarkTransfer(
  transactionId: string,
  userId: string
): Promise<void> {
  const [txn] = await db
    .select({ id: transactions.id, transferPairId: transactions.transferPairId })
    .from(transactions)
    .where(and(eq(transactions.id, transactionId), ownedByUser(userId)))
    .limit(1);

  if (!txn) throw new TransferError(TransferErrorCode.TRANSACTION_NOT_FOUND);

  if (txn.transferPairId) {
    const pairId = txn.transferPairId;
    await db.transaction(async (tx) => {
      await tx
        .update(transactions)
        .set({ isTransfer: false, transferPairId: null })
        .where(eq(transactions.id, pairId));
      await tx
        .update(transactions)
        .set({ isTransfer: false, transferPairId: null })
        .where(eq(transactions.id, transactionId));
    });
  } else {
    await db
      .update(transactions)
      .set({ isTransfer: false, transferPairId: null })
      .where(eq(transactions.id, transactionId));
  }
}

/**
 * Dismiss a transfer candidate — clears the flagged state without marking as transfer.
 */
export async function dismissTransferFlag(
  transactionId: string,
  userId: string
): Promise<void> {
  const txn = await getOwnedTransaction(transactionId, userId);
  if (!txn) throw new TransferError(TransferErrorCode.TRANSACTION_NOT_FOUND);

  if (txn.transferMatchId) {
    await db
      .update(transactions)
      .set({ transferMatchId: null, flaggedForReview: false })
      .where(eq(transactions.id, txn.transferMatchId));
  }

  await db
    .update(transactions)
    .set({ flaggedForReview: false, transferMatchId: null })
    .where(eq(transactions.id, transactionId));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns a Drizzle SQL condition scoping transactions to accounts owned by userId. */
function ownedByUser(userId: string) {
  return sql`${transactions.accountId} IN (SELECT id FROM accounts WHERE user_id = ${userId})`;
}

async function getOwnedTransaction(transactionId: string, userId: string) {
  const [txn] = await db
    .select({
      id: transactions.id,
      isTransfer: transactions.isTransfer,
      transferMatchId: transactions.transferMatchId,
    })
    .from(transactions)
    .where(and(eq(transactions.id, transactionId), ownedByUser(userId)))
    .limit(1);
  return txn ?? null;
}

/** Negates a numeric string amount without floating-point conversion. */
export function negateAmount(amount: string): string {
  if (new Decimal(amount).isZero()) return amount.replace(/^-/, '');
  return amount.startsWith('-') ? amount.slice(1) : `-${amount}`;
}

function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
