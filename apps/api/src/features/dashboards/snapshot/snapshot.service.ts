import Decimal from 'decimal.js';
import { NEED_WANT_OPTIONS, type AccountType } from '@finance/shared/constants';
import type {
  SnapshotColumnValues,
  SnapshotDashboardResponse,
  SnapshotMonthlyIncome,
} from '@finance/shared/types/dashboard';
import type {
  AccountBalanceRow,
  AnticipatedRow,
  ExpenseNeedWantRow,
} from './snapshot.repository';
import type { RebalancingAdjustments } from '@/pipelines/rebalancing/rebalancing-adjustments';

const [NEED, WANT] = NEED_WANT_OPTIONS;

// Compile-time guard: fails if 'chequing' is removed from ACCOUNT_TYPES in shared.
const CHEQUING_ACCOUNT_TYPE = 'chequing' satisfies AccountType;

export interface SnapshotConfig {
  emergencyFundTarget: string | null;
  needsPercentage: number | null;
  wantsPercentage: number | null;
  investmentsPercentage: number | null;
}

interface Percentages {
  needs: number;
  wants: number;
  investments: number;
}

function zeroColumns(): SnapshotColumnValues {
  return { total: 0, needs: 0, wants: 0, rebalancingAdjustment: 0 };
}

function subtractColumns(
  a: SnapshotColumnValues,
  b: SnapshotColumnValues
): SnapshotColumnValues {
  return {
    total: new Decimal(a.total).minus(b.total).toNumber(),
    needs: new Decimal(a.needs).minus(b.needs).toNumber(),
    wants: new Decimal(a.wants).minus(b.wants).toNumber(),
    rebalancingAdjustment: 0,
  };
}

function buildExpensesColumns(
  rows: ExpenseNeedWantRow[]
): SnapshotColumnValues {
  let total = new Decimal(0);
  let needs = new Decimal(0);
  let wants = new Decimal(0);

  for (const row of rows) {
    const amount = new Decimal(row.total);
    total = total.plus(amount);
    if (row.needWant === NEED) needs = needs.plus(amount);
    else if (row.needWant === WANT) wants = wants.plus(amount);
  }

  return {
    total: total.toNumber(),
    needs: needs.toNumber(),
    wants: wants.toNumber(),
    rebalancingAdjustment: 0,
  };
}

// Investment tracking is deferred — actual investment transactions are not yet
// queried. actualInvestments is always zero until the feature ships, at which
// point only the repository query needs to be added; the response shape and
// downstream callers are already stable.
function buildMonthlyIncome(
  grossIncome: Decimal,
  percentages: Percentages | null
): SnapshotMonthlyIncome {
  const actualInvestments = new Decimal(0);
  const spendingIncome = grossIncome.minus(actualInvestments);

  if (spendingIncome.isZero() || percentages === null) {
    return {
      income: grossIncome.toNumber(),
      actualInvestments: actualInvestments.toNumber(),
      spendingIncome: spendingIncome.toNumber(),
      needs: 0,
      wants: 0,
    };
  }

  const needs = spendingIncome
    .mul(percentages.needs)
    .div(100)
    .toDecimalPlaces(2);
  const wants = spendingIncome
    .mul(percentages.wants)
    .div(100)
    .toDecimalPlaces(2);

  return {
    income: grossIncome.toNumber(),
    actualInvestments: actualInvestments.toNumber(),
    spendingIncome: spendingIncome.toNumber(),
    needs: needs.toNumber(),
    wants: wants.toNumber(),
  };
}

interface AnticipatedTotals {
  expectedIncome: Decimal;
  expectedExpenses: SnapshotColumnValues;
}

function accumulateAnticipated(rows: AnticipatedRow[]): AnticipatedTotals {
  let income = new Decimal(0);
  let expNeeds = new Decimal(0);
  let expWants = new Decimal(0);
  let expTotal = new Decimal(0);

  for (const row of rows) {
    const amount = new Decimal(row.overrideAmount ?? row.monthlyAmount ?? '0');
    if (row.isIncome) {
      income = income.plus(amount);
    } else {
      expTotal = expTotal.plus(amount);
      if (row.needWant === NEED) expNeeds = expNeeds.plus(amount);
      else if (row.needWant === WANT) expWants = expWants.plus(amount);
    }
  }

  return {
    expectedIncome: income,
    expectedExpenses: {
      total: expTotal.toNumber(),
      needs: expNeeds.toNumber(),
      wants: expWants.toNumber(),
      rebalancingAdjustment: 0,
    },
  };
}

function buildExpectedSpendingIncome(
  expectedIncome: Decimal,
  percentages: Percentages | null
): SnapshotColumnValues {
  if (percentages === null) {
    return zeroColumns();
  }
  const spendingTotal = expectedIncome
    .mul(100 - percentages.investments)
    .div(100)
    .toDecimalPlaces(2);
  // needs and wants are rounded independently — their sum may differ from
  // spendingTotal by ±0.01. The client should display each column from its
  // own value rather than summing needs + wants to derive the total.
  const spendingNeeds = spendingTotal
    .mul(percentages.needs)
    .div(100)
    .toDecimalPlaces(2);
  const spendingWants = spendingTotal
    .mul(percentages.wants)
    .div(100)
    .toDecimalPlaces(2);
  return {
    total: spendingTotal.toNumber(),
    needs: spendingNeeds.toNumber(),
    wants: spendingWants.toNumber(),
    rebalancingAdjustment: 0,
  };
}

export function buildSnapshotResponse(
  accountRows: AccountBalanceRow[],
  incomeTotal: string,
  expenseRows: ExpenseNeedWantRow[],
  anticipatedRows: AnticipatedRow[],
  config: SnapshotConfig,
  date: { year: number; month: number },
  adjustments: RebalancingAdjustments,
  lastUploadedAt: string | null
): SnapshotDashboardResponse {
  const { month } = date;
  // ── Accounts ────────────────────────────────────────────────────────────────
  const accountList = accountRows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    institution: row.institution,
    currency: row.currency,
    isCredit: row.isCredit,
    balance: new Decimal(row.balance).toNumber(),
  }));

  // ── Emergency fund ──────────────────────────────────────────────────────────
  const emergencyFundBalance = accountList
    .filter((a) => a.type === CHEQUING_ACCOUNT_TYPE)
    .reduce<Decimal>((sum, a) => sum.plus(a.balance), new Decimal(0))
    .toNumber();
  const emergencyFundTarget =
    config.emergencyFundTarget !== null
      ? new Decimal(config.emergencyFundTarget).toNumber()
      : null;
  const emergencyFundPercentage =
    emergencyFundTarget !== null && emergencyFundTarget > 0
      ? new Decimal(emergencyFundBalance)
          .div(emergencyFundTarget)
          .mul(100)
          .toDecimalPlaces(1)
          .toNumber()
      : null;

  // ── Allocation config ────────────────────────────────────────────────────────
  // Narrowed into a single object so all three values are non-null together,
  // avoiding the need for ! assertions at each use site.
  const { needsPercentage, wantsPercentage, investmentsPercentage } = config;
  const percentages =
    needsPercentage !== null &&
    wantsPercentage !== null &&
    investmentsPercentage !== null
      ? {
          needs: needsPercentage,
          wants: wantsPercentage,
          investments: investmentsPercentage,
        }
      : null;

  // ── Monthly income ──────────────────────────────────────────────────────────
  // Offset transactions from resolved rebalancing groups are excluded from income.
  const incomeExclusion =
    adjustments.incomeByMonth.get(month) ?? new Decimal(0);
  const grossIncome = new Decimal(incomeTotal).minus(incomeExclusion);
  const monthlyIncome = buildMonthlyIncome(grossIncome, percentages);

  // ── Monthly expenses ────────────────────────────────────────────────────────
  const baseExpenses = buildExpensesColumns(expenseRows);
  const expAdj = adjustments.expenseByMonth.get(month);
  const totalExpAdj = expAdj
    ? expAdj.need.plus(expAdj.want).plus(expAdj.other)
    : new Decimal(0);
  const monthlyExpenses: SnapshotColumnValues = {
    total: new Decimal(baseExpenses.total).minus(totalExpAdj).toNumber(),
    needs: new Decimal(baseExpenses.needs)
      .minus(expAdj?.need ?? new Decimal(0))
      .toNumber(),
    wants: new Decimal(baseExpenses.wants)
      .minus(expAdj?.want ?? new Decimal(0))
      .toNumber(),
    rebalancingAdjustment: totalExpAdj.toNumber(),
  };

  // ── Anticipated ─────────────────────────────────────────────────────────────
  const hasEntries = anticipatedRows.length > 0;
  const { expectedIncome, expectedExpenses } =
    accumulateAnticipated(anticipatedRows);
  const expectedSpendingIncome = buildExpectedSpendingIncome(
    expectedIncome,
    percentages
  );

  const expectedAvailable = subtractColumns(
    expectedSpendingIncome,
    expectedExpenses
  );
  const remainingBudget = subtractColumns(
    expectedSpendingIncome,
    monthlyExpenses
  );

  return {
    year: date.year,
    month: date.month,
    lastUploadedAt,
    accounts: accountList,
    emergencyFund: {
      target: emergencyFundTarget,
      balance: emergencyFundBalance,
      percentage: emergencyFundPercentage,
    },
    monthlyIncome,
    monthlyExpenses,
    anticipated: {
      hasEntries,
      expectedIncome: expectedIncome.toNumber(),
      expectedSpendingIncome,
      expectedExpenses,
      expectedAvailable,
      remainingBudget,
    },
  };
}
