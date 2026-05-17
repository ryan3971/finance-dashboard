import Decimal from 'decimal.js';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { accounts, contributionRecords } from '@/db/schema';
import type {
  AccountContributionSummary,
  ContributionRoomResponse,
  InvestmentSummaryResponse,
  InvestmentTransactionRow,
} from '@finance/shared/types/investments';
import type { InvestmentTransactionFilters } from '@finance/shared/schemas/investments';
import {
  REGISTERED_ACCOUNT_TYPES,
  queryActivitySummary,
  queryContributionAggregates,
  queryContributionRecords,
  queryPaginatedTransactions,
  queryRegisteredAccounts,
  type RegisteredAccountType,
} from './investments.repository';
import { InvestmentError, InvestmentErrorCode } from './investments.errors';

interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface UpsertContributionRoomBody {
  annualLimit?: number;
  roomCarried?: number;
  roomCarriedConfirmed?: boolean;
}

export async function getInvestmentTransactions(
  userId: string,
  filters: InvestmentTransactionFilters
): Promise<{ data: InvestmentTransactionRow[]; pagination: PaginationMeta }> {
  const { rows, total } = await queryPaginatedTransactions(userId, filters);

  const data: InvestmentTransactionRow[] = rows.map((row) => ({
    id: row.id,
    accountId: row.accountId,
    accountName: row.accountName,
    date: row.date,
    action: row.action,
    rawAction: row.rawAction,
    symbol: row.symbol,
    description: row.description,
    quantity: row.quantity !== null ? new Decimal(row.quantity).toNumber() : null,
    price: row.price !== null ? new Decimal(row.price).toNumber() : null,
    grossAmount: row.grossAmount !== null ? new Decimal(row.grossAmount).toNumber() : null,
    commission: row.commission !== null ? new Decimal(row.commission).toNumber() : null,
    amount: new Decimal(row.amount).toNumber(),
    currency: row.currency,
    activityType: row.activityType,
    note: row.note,
  }));

  const { page, pageSize } = filters;

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function getActivitySummary(
  userId: string,
  year: number,
  accountId?: string
): Promise<InvestmentSummaryResponse> {
  const row = await queryActivitySummary(userId, year, accountId);

  const totalContributions = new Decimal(row.totalContributions);
  const totalWithdrawals = new Decimal(row.totalWithdrawals);

  return {
    year,
    dividendsReceived: new Decimal(row.dividendsReceived).toNumber(),
    feesPaid: new Decimal(row.feesPaid).toNumber(),
    netDeposits: totalContributions.minus(totalWithdrawals).toNumber(),
    totalContributions: totalContributions.toNumber(),
    totalWithdrawals: totalWithdrawals.toNumber(),
  };
}

export async function getContributionRoom(
  userId: string,
  year: number
): Promise<ContributionRoomResponse> {
  const registeredAccounts = await queryRegisteredAccounts(userId);

  if (registeredAccounts.length === 0) {
    return { year, accounts: [] };
  }

  const accountIds = registeredAccounts.map((a) => a.id);
  const tfsaAccountIds = registeredAccounts
    .filter((a) => a.type === 'tfsa')
    .map((a) => a.id);
  const priorYear = year - 1;

  const [currentRecords, currentAggregates, priorYearRecords, priorYearAggregates] =
    await Promise.all([
      queryContributionRecords(accountIds, year),
      queryContributionAggregates(accountIds, year),
      tfsaAccountIds.length > 0
        ? queryContributionRecords(tfsaAccountIds, priorYear)
        : Promise.resolve([]),
      tfsaAccountIds.length > 0
        ? queryContributionAggregates(tfsaAccountIds, priorYear)
        : Promise.resolve([]),
    ]);

  const recordByAccount = new Map(currentRecords.map((r) => [r.accountId, r]));
  const aggByAccount = new Map(currentAggregates.map((a) => [a.accountId, a]));
  const priorRecordByAccount = new Map(priorYearRecords.map((r) => [r.accountId, r]));
  const priorAggByAccount = new Map(priorYearAggregates.map((a) => [a.accountId, a]));

  const summaries: AccountContributionSummary[] = registeredAccounts.map((account) => {
    const record = recordByAccount.get(account.id);
    const agg = aggByAccount.get(account.id);

    const contributions = new Decimal(agg?.contributions ?? '0').toNumber();
    const withdrawals = new Decimal(agg?.withdrawals ?? '0').toNumber();
    const annualLimit =
      record?.annualLimit !== null && record?.annualLimit !== undefined
        ? new Decimal(record.annualLimit).toNumber()
        : null;

    let roomCarried: number | null = null;
    let roomCarriedIsEstimate = false;

    if (record?.roomCarried !== null && record?.roomCarried !== undefined) {
      roomCarried = new Decimal(record.roomCarried).toNumber();
      // roomCarriedIsEstimate is true when the record hasn't been explicitly confirmed
      roomCarriedIsEstimate = !record.roomCarriedConfirmed;
    } else if (account.type === 'tfsa') {
      // Derive an estimate from prior-year data (spec Section 3.2).
      // Only when prior-year annualLimit is known — a partial estimate is worse than none.
      const priorRecord = priorRecordByAccount.get(account.id);
      const priorAgg = priorAggByAccount.get(account.id);

      if (priorRecord?.annualLimit !== null && priorRecord?.annualLimit !== undefined) {
        const priorAnnualLimit = new Decimal(priorRecord.annualLimit);
        const priorRoomCarried =
          priorRecord.roomCarried !== null && priorRecord.roomCarried !== undefined
            ? new Decimal(priorRecord.roomCarried)
            : new Decimal(0);
        const priorContributions = new Decimal(priorAgg?.contributions ?? '0');
        const priorWithdrawals = new Decimal(priorAgg?.withdrawals ?? '0');

        roomCarried = priorAnnualLimit
          .plus(priorRoomCarried)
          .plus(priorWithdrawals)
          .minus(priorContributions)
          .toNumber();
        roomCarriedIsEstimate = true;
      }
    }

    const availableRoom =
      annualLimit !== null
        ? new Decimal(annualLimit)
            .plus(roomCarried ?? 0)
            .plus(withdrawals)
            .minus(contributions)
            .toNumber()
        : null;

    return {
      accountId: account.id,
      accountName: account.name,
      accountType: account.type as RegisteredAccountType,
      annualLimit,
      roomCarried,
      roomCarriedIsEstimate,
      contributions,
      withdrawals,
      availableRoom,
    };
  });

  return { year, accounts: summaries };
}

export async function upsertContributionRoom(
  userId: string,
  accountId: string,
  year: number,
  body: UpsertContributionRoomBody
): Promise<void> {
  const [account] = await db
    .select({ type: accounts.type })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)));

  if (!account) {
    throw new InvestmentError(InvestmentErrorCode.INVESTMENT_ACCOUNT_NOT_FOUND);
  }

  if (!(REGISTERED_ACCOUNT_TYPES as readonly string[]).includes(account.type)) {
    throw new InvestmentError(InvestmentErrorCode.INVALID_ACCOUNT_TYPE_FOR_ROOM);
  }

  const updateSet = {
    ...(body.annualLimit !== undefined ? { annualLimit: String(body.annualLimit) } : {}),
    ...(body.roomCarried !== undefined ? { roomCarried: String(body.roomCarried) } : {}),
    ...(body.roomCarriedConfirmed !== undefined
      ? { roomCarriedConfirmed: body.roomCarriedConfirmed }
      : {}),
  };

  const insertQuery = db.insert(contributionRecords).values({
    accountId,
    taxYear: year,
    annualLimit: body.annualLimit !== undefined ? String(body.annualLimit) : undefined,
    roomCarried: body.roomCarried !== undefined ? String(body.roomCarried) : undefined,
    roomCarriedConfirmed: body.roomCarriedConfirmed ?? false,
  });

  if (Object.keys(updateSet).length > 0) {
    await insertQuery.onConflictDoUpdate({
      target: [contributionRecords.accountId, contributionRecords.taxYear],
      set: updateSet,
    });
  } else {
    await insertQuery.onConflictDoNothing();
  }
}
