import {
  accounts,
  imports,
  investmentTransactions,
  transactions,
} from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { categorize, type LoadedRule, loadRules } from '../../../pipelines/categorization/pipeline';
import { detectAdapter, getAdapterByInstitution } from './registry';
import { ImportError, ImportErrorCode } from '@/features/imports/imports.errors';
import type { RawInvestmentTransaction, RawTransaction } from '@finance/shared';
import { buildCompositeKey } from './utils';
import { db } from '@/db';
import { detectTransfers } from '../../../pipelines/transfer-detection/transfer-detection.service';
import { logger } from '@/middleware/logger';
import { parseCsv } from './parser';

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
  fileBuffer: Buffer
): Promise<ImportResult> {
  const [account] = await db
    .select({ institution: accounts.institution })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
    .limit(1);

  if (!account) throw new ImportError(ImportErrorCode.ACCOUNT_NOT_FOUND);

  const rows = parseCsv(fileBuffer.toString('utf-8'));

  // Issue 8: guard against empty files before adapter detection, which would
  // otherwise surface a misleading NO_ADAPTER error.
  if (rows.length === 0) throw new ImportError(ImportErrorCode.EMPTY_FILE);

  let adapter = getAdapterByInstitution(account.institution);
  if (!adapter) {
    const firstRow = rows[0] ?? [];
    adapter = detectAdapter(firstRow);
  }
  if (!adapter) throw new ImportError(ImportErrorCode.NO_ADAPTER);

  // TODO: upload the raw file buffer to S3 at this key before processing.
  // The key is stored in the DB so the original file can be retrieved later.
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

  // The adapter may filter or transform rows (e.g. skip headers, unsupported
  // action types), so parsed.length may differ from the raw rows.length written
  // to the DB above. The final DB update below will correct the stored value.
  result.rowCount = parsed.length;

  // Issue 2: load categorization rules once for the entire batch rather than
  // fetching them inside processTransactionRow on every iteration.
  const rules = await loadRules(userId);

  const importedTransactionIds: string[] = [];

  // Issue 3: wrap the row loop and post-processing in try/finally so the import
  // record is always resolved to 'complete' or 'error', never left as 'processing'.
  try {
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
            rules,
            result
          );
          if (insertedId) importedTransactionIds.push(insertedId);
        }
      } catch (err: unknown) {
        logger.error({ err }, 'Unexpected error processing import row');
        result.errorCount++;
        result.errors.push('Failed to process row — see server logs for details');
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
  } catch (err) {
    await db
      .update(imports)
      .set({ status: 'error', errorDetail: { message: String(err) } })
      .where(eq(imports.id, importRecord.id));
    throw err;
  }

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
  rules: LoadedRule[],
  result: ImportResult
): Promise<string | null> {
  const categorization = await categorize(
    raw.description,
    userId,
    raw.amount,
    raw.currency,
    rules
  );

  if (categorization.flaggedForReview) result.flaggedCount++;

  // Issue 4: use onConflictDoNothing on the compositeKey unique constraint
  // instead of catching Postgres error code 23505.
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
    .onConflictDoNothing()
    .returning({ id: transactions.id });

  if (!inserted) {
    result.duplicateCount++;
    return null;
  }

  result.importedCount++;
  return inserted.id;
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

  // onConflictDoNothing handles duplicate investment rows via compositeKey
  const [inserted] = await db
    .insert(investmentTransactions)
    .values({
      accountId,
      importId,
      date: raw.date,
      action: raw.action,
      rawAction: raw.rawAction,
      symbol: raw.symbol ?? null,
      description: raw.rawDescription,
      quantity: raw.quantity !== null && raw.quantity !== undefined ? String(raw.quantity) : null,
      price: raw.price !== null && raw.price !== undefined ? String(raw.price) : null,
      grossAmount: String(raw.grossAmount),
      commission: String(raw.commission),
      amount: String(raw.netAmount),
      currency: raw.currency,
      riskLevel: null,
      activityType: raw.activityType,
      compositeKey,
    })
    .onConflictDoNothing()
    .returning({ id: investmentTransactions.id });

  if (inserted) result.importedCount++;
  else result.duplicateCount++;
}
