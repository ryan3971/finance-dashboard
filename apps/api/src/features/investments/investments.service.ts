import Decimal from 'decimal.js';
import type {
  AccountContributionSummary,
  ContributionRoomResponse,
  InvestmentTransactionAggregates,
  InvestmentTransactionRow,
} from '@finance/shared/types/investments';
import type {
  AccountMonthlyBreakdown,
  AccountMonthlyBreakdownRow,
  AccountMonthlyBreakdownTotals,
  MonthlyBreakdownResponse,
  MonthlyBreakdownRow,
  MonthlyBreakdownTotals,
} from '@finance/shared/types/investments-monthly-breakdown';
import type {
  CreateManualInvestmentTransactionInput,
  InvestmentTransactionFilters,
  UpsertContributionRoomInput,
} from '@finance/shared/schemas/investments';
import type { InvestmentTransactionSource } from '@finance/shared/types/investments';
import {
  REGISTERED_ACCOUNT_TYPES,
  TFSA_TYPE,
  queryAccountOwnerAndType,
  queryContributionAggregates,
  queryContributionRecords,
  queryInvestmentAccountDetails,
  queryMonthlyBreakdownByAccount,
  queryMonthlyBreakdownRaw,
  queryPaginatedTransactions,
  queryRegisteredAccounts,
  queryTransactionAggregates,
  upsertContributionRoomRecord,
  type ContributionAggRow,
  type ContributionRecordDbRow,
} from './investments.repository';
import { InvestmentError, InvestmentErrorCode } from './investments.errors';
import { INVESTMENT_ACCOUNT_TYPES, MONTHS_IN_YEAR } from '@finance/shared/constants';
import { TRANSACTION_SOURCE } from '@/lib/constants';
import { insertInvestmentTransaction } from '@/pipelines/investments/investment-insert';
import { resolveMonthlyIncome } from '@/lib/anticipated-income-query';
import { queryDashboardUserConfig } from '@/lib/user-config-query';

interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// Derives the TFSA carry-forward room estimate from prior-year data (spec Section 3.2).
// Returns null when prior-year annualLimit is unknown — a partial estimate is worse than none.
function estimateRoomCarried(
  priorRecord: ContributionRecordDbRow | undefined,
  priorAgg: ContributionAggRow | undefined
): number | null {
  if (priorRecord?.annualLimit === null || priorRecord?.annualLimit === undefined) {
    return null;
  }

  const priorAnnualLimit = new Decimal(priorRecord.annualLimit);
  const priorRoomCarried =
    priorRecord.roomCarried !== null && priorRecord.roomCarried !== undefined
      ? new Decimal(priorRecord.roomCarried)
      : new Decimal(0);
  const priorContributions = new Decimal(priorAgg?.contributions ?? '0');
  const priorWithdrawals = new Decimal(priorAgg?.withdrawals ?? '0');

  return priorAnnualLimit
    .plus(priorRoomCarried)
    .plus(priorWithdrawals)
    .minus(priorContributions)
    .toNumber();
}

export async function getInvestmentTransactions(
  userId: string,
  filters: InvestmentTransactionFilters
): Promise<{ data: InvestmentTransactionRow[]; pagination: PaginationMeta; aggregates: InvestmentTransactionAggregates }> {
  const [{ rows, total }, aggRow] = await Promise.all([
    queryPaginatedTransactions(userId, filters),
    queryTransactionAggregates(userId, filters),
  ]);

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
    // The DB CHECK constraint guarantees 'csv' | 'manual'; Drizzle returns string.
    source: row.source as InvestmentTransactionSource,
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
    aggregates: {
      dividends: new Decimal(aggRow.dividends).toNumber(),
      fees: new Decimal(aggRow.fees).toNumber(),
      netDeposits: new Decimal(aggRow.netDeposits).toNumber(),
    },
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
    .filter((a) => a.type === TFSA_TYPE)
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
      roomCarriedIsEstimate = !record.roomCarriedConfirmed;
    } else if (account.type === TFSA_TYPE) {
      // Derive an estimate from prior-year data (spec Section 3.2).
      // Only when prior-year annualLimit is known — a partial estimate is worse than none.
      const estimate = estimateRoomCarried(
        priorRecordByAccount.get(account.id),
        priorAggByAccount.get(account.id)
      );
      if (estimate !== null) {
        roomCarried = estimate;
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
      accountType: account.type,
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

export async function createManualInvestmentTransaction(
  userId: string,
  input: CreateManualInvestmentTransactionInput
): Promise<InvestmentTransactionRow> {
  const account = await queryAccountOwnerAndType(input.accountId);

  if (!account) {
    throw new InvestmentError(InvestmentErrorCode.INVESTMENT_ACCOUNT_NOT_FOUND);
  }

  if (account.userId !== userId) {
    throw new InvestmentError(InvestmentErrorCode.INVESTMENT_ACCOUNT_FORBIDDEN);
  }

  // Widen to string[] so TypeScript accepts the string argument to includes.
  const investmentTypes: readonly string[] = INVESTMENT_ACCOUNT_TYPES;
  if (!investmentTypes.includes(account.type)) {
    throw new InvestmentError(InvestmentErrorCode.INVALID_ACCOUNT_TYPE_FOR_TRANSACTION);
  }

  const row = await insertInvestmentTransaction({
    accountId:    input.accountId,
    importId:     null,
    date:         input.date,
    action:       input.action,
    rawAction:    input.action,
    symbol:       input.symbol ?? null,
    description:  input.description ?? null,
    quantity:     input.quantity ?? null,
    price:        input.price ?? null,
    grossAmount:  null,
    commission:   null,
    amount:       input.amount,
    currency:     input.currency,
    activityType: input.activityType ?? null,
    note:         input.note ?? null,
    source:       TRANSACTION_SOURCE.MANUAL,
  });

  if (!row) {
    throw new InvestmentError(InvestmentErrorCode.DUPLICATE_INVESTMENT_TRANSACTION);
  }

  return {
    id:           row.id,
    accountId:    row.accountId,
    accountName:  account.name,
    date:         row.date,
    action:       row.action,
    rawAction:    row.rawAction,
    symbol:       row.symbol,
    description:  row.description,
    quantity:     row.quantity !== null ? new Decimal(row.quantity).toNumber() : null,
    price:        row.price !== null ? new Decimal(row.price).toNumber() : null,
    grossAmount:  null,
    commission:   null,
    amount:       new Decimal(row.amount).toNumber(),
    currency:     row.currency,
    activityType: row.activityType,
    note:         row.note,
    source:       row.source,
  };
}

const ACCOUNT_TYPE_RANK: Record<string, number> = { tfsa: 0, rrsp: 1, fhsa: 2 };

export async function getMonthlyBreakdown(
  userId: string,
  year: number
): Promise<MonthlyBreakdownResponse> {
  const [accountDetails, config, incomeResult] = await Promise.all([
    queryInvestmentAccountDetails(userId),
    queryDashboardUserConfig(userId),
    resolveMonthlyIncome(userId, year),
  ]);

  const accountIds = accountDetails.map((a) => a.id);

  const [rawRows, perAccountRows, contribRecs] = await Promise.all([
    queryMonthlyBreakdownRaw(accountIds, year),
    queryMonthlyBreakdownByAccount(accountIds, year),
    queryContributionRecords(accountIds, year),
  ]);

  const investmentsPercentage = config.investmentsPercentage;
  const { months: monthlyIncome, hasEntries: hasIncomeEntries } = incomeResult;

  // Index combined DB rows by month for O(1) lookup.
  const dbByMonth = new Map(rawRows.map((r) => [r.month, r]));

  const months: MonthlyBreakdownRow[] = Array.from({ length: MONTHS_IN_YEAR }, (_, i) => {
    const month = i + 1;
    const dbRow = dbByMonth.get(month);

    const contributed = dbRow ? new Decimal(dbRow.contributed).toNumber() : 0;
    const deployed = dbRow ? new Decimal(dbRow.deployed).toNumber() : 0;
    const uninvestedDelta = new Decimal(contributed).plus(deployed).toNumber();

    let target: number | null = null;
    if (investmentsPercentage !== null && hasIncomeEntries) {
      const income = monthlyIncome[i]?.amount ?? 0;
      target = new Decimal(income)
        .times(investmentsPercentage)
        .dividedBy(100)
        .toDecimalPlaces(2)
        .toNumber();
    }

    return { month, contributed, deployed, uninvestedDelta, target };
  });

  const anyNullTarget = investmentsPercentage === null || !hasIncomeEntries;

  const initial: MonthlyBreakdownTotals = {
    contributed: 0,
    deployed: 0,
    uninvestedDelta: 0,
    target: anyNullTarget ? null : 0,
  };

  const totals = months.reduce<MonthlyBreakdownTotals>((acc, m) => ({
    contributed: new Decimal(acc.contributed).plus(m.contributed).toNumber(),
    deployed: new Decimal(acc.deployed).plus(m.deployed).toNumber(),
    uninvestedDelta: new Decimal(acc.uninvestedDelta).plus(m.uninvestedDelta).toNumber(),
    target: acc.target !== null && m.target !== null
      ? new Decimal(acc.target).plus(m.target).toNumber()
      : null,
  }), initial);

  // Index per-account rows by "accountId:month" for O(1) lookup.
  const perAccountByKey = new Map(
    perAccountRows.map((r) => [`${r.accountId}:${r.month}`, r])
  );

  // Index contribution records by accountId.
  const contribByAccount = new Map(contribRecs.map((r) => [r.accountId, r]));

  const sortedAccounts = [...accountDetails].sort(
    (a, b) => (ACCOUNT_TYPE_RANK[a.type] ?? 3) - (ACCOUNT_TYPE_RANK[b.type] ?? 3)
  );

  const accounts: AccountMonthlyBreakdown[] = sortedAccounts.map((account) => {
    const contribRec = contribByAccount.get(account.id);
    const annualLimit =
      contribRec?.annualLimit !== null && contribRec?.annualLimit !== undefined
        ? new Decimal(contribRec.annualLimit).toNumber()
        : null;

    const accountMonths: AccountMonthlyBreakdownRow[] = Array.from(
      { length: MONTHS_IN_YEAR },
      (_, i) => {
        const month = i + 1;
        const row = perAccountByKey.get(`${account.id}:${month}`);
        const contributed = row ? new Decimal(row.contributed).toNumber() : 0;
        const deployed = row ? new Decimal(row.deployed).toNumber() : 0;
        const uninvestedDelta = new Decimal(contributed).plus(deployed).toNumber();
        return { month, contributed, deployed, uninvestedDelta };
      }
    );

    const accountTotals = accountMonths.reduce<AccountMonthlyBreakdownTotals>(
      (acc, m) => ({
        contributed: new Decimal(acc.contributed).plus(m.contributed).toNumber(),
        deployed: new Decimal(acc.deployed).plus(m.deployed).toNumber(),
        uninvestedDelta: new Decimal(acc.uninvestedDelta).plus(m.uninvestedDelta).toNumber(),
      }),
      { contributed: 0, deployed: 0, uninvestedDelta: 0 }
    );

    return {
      accountId: account.id,
      accountName: account.name,
      accountType: account.type,
      institution: account.institution,
      annualLimit,
      months: accountMonths,
      totals: accountTotals,
    };
  });

  return {
    year,
    investmentsPercentage,
    months,
    totals,
    accounts,
  };
}

export async function upsertContributionRoom(
  userId: string,
  accountId: string,
  year: number,
  body: UpsertContributionRoomInput
): Promise<void> {
  const account = await queryAccountOwnerAndType(accountId);

  if (!account) {
    throw new InvestmentError(InvestmentErrorCode.INVESTMENT_ACCOUNT_NOT_FOUND);
  }

  if (account.userId !== userId) {
    throw new InvestmentError(InvestmentErrorCode.INVESTMENT_ACCOUNT_FORBIDDEN);
  }

  // Widen to string[] so TypeScript accepts the string argument to includes.
  const registeredTypes: readonly string[] = REGISTERED_ACCOUNT_TYPES;
  if (!registeredTypes.includes(account.type)) {
    throw new InvestmentError(InvestmentErrorCode.INVALID_ACCOUNT_TYPE_FOR_ROOM);
  }

  await upsertContributionRoomRecord(accountId, year, body);
}
