import { investmentTransactions } from '@/db/schema';
import { db } from '@/db';
import { buildCompositeKey } from '@/lib/composite-key';
import type { InvestmentTransactionSource } from '@finance/shared/types/investments';

export interface InvestmentTransactionInsert {
  accountId:    string;
  importId:     string | null;
  date:         string;
  action:       string;
  /** For import rows: the raw CSV action string. For manual entries: same as action. */
  rawAction:    string;
  symbol:       string | null;
  /** The description string used both for storage and compositeKey generation. */
  description:  string | null;
  quantity:     number | null;
  price:        number | null;
  grossAmount:  number | null;
  commission:   number | null;
  amount:       number;
  currency:     string;
  activityType: string | null;
  note:         string | null;
  source:       InvestmentTransactionSource;
  riskLevel?:   string | null;
}

/** All columns returned from .returning() — no JOIN, so accountName is absent. */
export interface InsertedInvestmentTransactionRow {
  id:           string;
  accountId:    string;
  date:         string;
  action:       string;
  rawAction:    string;
  symbol:       string | null;
  description:  string | null;
  quantity:     string | null;
  price:        string | null;
  grossAmount:  string | null;
  commission:   string | null;
  amount:       string;
  currency:     string;
  activityType: string | null;
  note:         string | null;
  // The CHECK constraint on investment_transactions.source guarantees this is
  // always 'csv' | 'manual'. Drizzle cannot narrow text columns statically,
  // so we cast once at this boundary.
  source:       InvestmentTransactionSource;
  riskLevel:    string | null;
}

/**
 * Insert one investment transaction row.
 *
 * Builds the compositeKey internally from (accountId, date, description, amount).
 * Uses onConflictDoNothing so duplicate imports are silently skipped.
 *
 * Returns the inserted row, or null when the compositeKey already exists.
 *
 * This is the single authoritative write path shared by both the CSV import
 * pipeline (processInvestmentRow) and the manual-entry service.
 */
export async function insertInvestmentTransaction(
  input: InvestmentTransactionInsert
): Promise<InsertedInvestmentTransactionRow | null> {
  const compositeKey = buildCompositeKey(
    input.accountId,
    input.date,
    input.description ?? '',
    input.amount
  );

  const [row] = await db
    .insert(investmentTransactions)
    .values({
      accountId:    input.accountId,
      importId:     input.importId,
      date:         input.date,
      action:       input.action,
      rawAction:    input.rawAction,
      symbol:       input.symbol,
      description:  input.description,
      quantity:     input.quantity !== null ? String(input.quantity) : null,
      price:        input.price !== null ? String(input.price) : null,
      grossAmount:  input.grossAmount !== null ? String(input.grossAmount) : null,
      commission:   input.commission !== null ? String(input.commission) : null,
      amount:       String(input.amount),
      currency:     input.currency,
      activityType: input.activityType,
      note:         input.note,
      source:       input.source,
      riskLevel:    input.riskLevel ?? null,
      compositeKey,
    })
    .onConflictDoNothing()
    .returning({
      id:           investmentTransactions.id,
      accountId:    investmentTransactions.accountId,
      date:         investmentTransactions.date,
      action:       investmentTransactions.action,
      rawAction:    investmentTransactions.rawAction,
      symbol:       investmentTransactions.symbol,
      description:  investmentTransactions.description,
      quantity:     investmentTransactions.quantity,
      price:        investmentTransactions.price,
      grossAmount:  investmentTransactions.grossAmount,
      commission:   investmentTransactions.commission,
      amount:       investmentTransactions.amount,
      currency:     investmentTransactions.currency,
      activityType: investmentTransactions.activityType,
      note:         investmentTransactions.note,
      source:       investmentTransactions.source,
      riskLevel:    investmentTransactions.riskLevel,
    });

  if (!row) return null;

  // The DB CHECK constraint guarantees source is always 'csv' | 'manual'.
  // Drizzle cannot narrow text columns statically, so we cast once here.
  return { ...row, source: row.source as InvestmentTransactionSource };
}
