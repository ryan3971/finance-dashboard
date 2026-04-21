export interface IncomeMonthAllocation {
  needs: number;
  wants: number;
  investments: number;
}

export interface IncomeMonth {
  month: number;
  total: number;
  allocation: IncomeMonthAllocation | null;
  rebalancingAdjustment: number;
}

export interface IncomeDashboardResponse {
  year: number;
  months: IncomeMonth[];
}

export interface ExpenseMonth {
  month: number;
  need: number;
  want: number;
  other: number;
  total: number;
  rebalancingAdjustment: number;
}

export interface ExpenseDashboardResponse {
  year: number;
  months: ExpenseMonth[];
  annualTotal: number;
}

export interface ExpenseCategoryRow {
  month: number;
  category: string | null;
  subcategory: string | null;
  total: number;
  rebalancingAdjustment: number | null;
}

export interface ExpenseCategoriesResponse {
  year: number;
  rows: ExpenseCategoryRow[];
}

export interface SnapshotAccountRow {
  id: string;
  name: string;
  type: string;
  institution: string;
  currency: string;
  isCredit: boolean;
  balance: number;
}

export interface SnapshotEmergencyFund {
  target: number | null;
  balance: number;
  percentage: number | null;
}

export interface SnapshotColumnValues {
  total: number;
  needs: number;
  wants: number;
  rebalancingAdjustment: number;
}

export interface SnapshotMonthlyIncome {
  income: number;
  incomeLessInvestment: SnapshotColumnValues;
}

export interface SnapshotAnticipated {
  hasEntries: boolean;
  expectedIncome: number;
  expectedSpendingIncome: SnapshotColumnValues;
  expectedExpenses: SnapshotColumnValues;
  expectedAvailable: SnapshotColumnValues;
  remainingBudget: SnapshotColumnValues;
}

export interface SnapshotDashboardResponse {
  lastUploadedAt: string | null;
  accounts: SnapshotAccountRow[];
  emergencyFund: SnapshotEmergencyFund;
  monthlyIncome: SnapshotMonthlyIncome;
  monthlyExpenses: SnapshotColumnValues;
  anticipated: SnapshotAnticipated;
}

export type YtdMonth =
  | {
      month: number;
      spendingIncome: null;
      expenses: null;
      netSpendingIncome: null;
      wants: null;
      needs: null;
    }
  | {
      month: number;
      spendingIncome: number;
      expenses: number;
      netSpendingIncome: number;
      wants: number;
      needs: number;
      rebalancingAdjustment: number;
    };

export interface YtdDashboardResponse {
  year: number;
  months: YtdMonth[];
}
