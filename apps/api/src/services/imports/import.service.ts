import {
  accounts,
  imports,
  investmentTransactions,
  transactions,
} from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { detectAdapter, getAdapterByInstitution } from './registry';
import { parseCsv, parseXlsx } from './parser';
import type { RawInvestmentTransaction, RawTransaction } from '@finance/shared';
import { buildCompositeKey } from './utils';
import { categorize } from '../categorization/pipeline';
import { db } from '@/db';
import { detectTransfers } from '../transfers/transfer-detection.service';

export interface ImportResult {
  importId: string;
  rowCount: number;
  importedCount: number;
  duplicateCount: number;
  flaggedCount: number;
  errorCount: number;
  errors: string[];
  transferCandidateCount: number;
}

export async function processImport(
  userId: string,
  accountId: string,
  filename: string,
  fileBuffer: Buffer,
  fileType: 'csv' | 'xlsx'
): Promise<ImportResult> {
  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
    .limit(1);

  if (!account) throw new Error('Account not found');

  const rows =
    fileType === 'xlsx'
      ? parseXlsx(fileBuffer)
      : parseCsv(fileBuffer.toString('utf-8'));

  let adapter = getAdapterByInstitution(account.institution);
  if (!adapter) {
    const firstRow = rows[0] ?? [];
    adapter = detectAdapter(firstRow);
  }
  if (!adapter)
    throw new Error(`No adapter found for institution: ${account.institution}`);

  const s3Key = `imports/${userId}/${accountId}/${Date.now()}-${filename}`;
  const [importRecord] = await db
    .insert(imports)
    .values({
      userId,
      accountId,
      filename,
      s3Key,
      status: 'processing',
      rowCount: rows.length,
    })
    .returning({ id: imports.id });

  const result: ImportResult = {
    importId: importRecord.id,
    rowCount: rows.length,
    importedCount: 0,
    duplicateCount: 0,
    flaggedCount: 0,
    errorCount: 0,
    errors: [],
    transferCandidateCount: 0,
  };

  let parsed: (RawTransaction | RawInvestmentTransaction)[];
  try {
    parsed = adapter.parse(rows, accountId);
  } catch (err) {
    await db
      .update(imports)
      .set({ status: 'error', errorDetail: { message: String(err) } })
      .where(eq(imports.id, importRecord.id));
    throw err;
  }

  result.rowCount = parsed.length;

  const importedTransactionIds: string[] = [];

  for (const raw of parsed) {
    try {
      if (isInvestmentTransaction(raw)) {
        await processInvestmentRow(raw, accountId, importRecord.id, result);
      } else {
        const insertedId = await processTransactionRow(
          raw,
          accountId,
          importRecord.id,
          userId,
          result
        );
        if (insertedId) importedTransactionIds.push(insertedId);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('duplicate') || message.includes('unique')) {
        result.duplicateCount++;
      } else {
        result.errorCount++;
        result.errors.push(message);
      }
    }
  }

  const transferCandidates = await detectTransfers(
    importedTransactionIds,
    userId
  );
  result.transferCandidateCount = transferCandidates.length;

  await db
    .update(imports)
    .set({
      status: 'complete',
      rowCount: result.rowCount,
      importedCount: result.importedCount,
      duplicateCount: result.duplicateCount,
      flaggedCount: result.flaggedCount,
      errorCount: result.errorCount,
      errorDetail: result.errors.length > 0 ? result.errors : null,
    })
    .where(eq(imports.id, importRecord.id));

  return result;
}

function isInvestmentTransaction(
  raw: RawTransaction | RawInvestmentTransaction
): raw is RawInvestmentTransaction {
  return 'action' in raw && 'accountNumber' in raw;
}

async function processTransactionRow(
  raw: RawTransaction,
  accountId: string,
  importId: string,
  userId: string,
  result: ImportResult
): Promise<string | null> {
  const categorization = await categorize(
    raw.description,
    userId,
    raw.amount,
    raw.currency
  );

  if (categorization.flaggedForReview) result.flaggedCount++;

  const [inserted] = await db
    .insert(transactions)
    .values({
      accountId,
      importId,
      date: raw.date,
      description: raw.description,
      rawDescription: raw.rawDescription,
      sourceName: categorization.sourceName,
      amount: String(raw.amount),
      currency: raw.currency,
      categoryId: categorization.categoryId,
      subcategoryId: categorization.subcategoryId,
      needWant: categorization.needWant,
      categorySource: categorization.categorySource,
      categoryConfidence:
        categorization.categoryConfidence > 0
          ? String(categorization.categoryConfidence)
          : null,
      flaggedForReview: categorization.flaggedForReview,
      compositeKey: raw.compositeKey,
      source: 'csv',
      isIncome: raw.amount > 0,
    })
    .returning({ id: transactions.id });

  result.importedCount++;
  return inserted?.id ?? null;
}

async function processInvestmentRow(
  raw: RawInvestmentTransaction,
  accountId: string,
  importId: string,
  result: ImportResult
): Promise<void> {
  const compositeKey = buildCompositeKey(
    accountId,
    raw.date,
    raw.rawDescription,
    raw.netAmount
  );

  await db.insert(investmentTransactions).values({
    accountId,
    importId,
    date: raw.date,
    action: raw.action,
    rawAction: raw.rawAction,
    symbol: raw.symbol ?? null,
    description: raw.rawDescription,
    quantity: raw.quantity != null ? String(raw.quantity) : null,
    price: raw.price != null ? String(raw.price) : null,
    grossAmount: String(raw.grossAmount),
    commission: String(raw.commission),
    amount: String(raw.netAmount),
    currency: raw.currency,
    riskLevel: null,
    activityType: raw.activityType,
    compositeKey,
  });

  result.importedCount++;
}
