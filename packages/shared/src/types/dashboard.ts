export interface IncomeMonthAllocation {
  needs: number;
  wants: number;
  investments: number;
}

export interface IncomeMonth {
  month: number;
  total: number;
  allocation: IncomeMonthAllocation | null;
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
}

export interface ExpenseDashboardResponse {
  year: number;
  months: ExpenseMonth[];
}

export interface ExpenseCategoryRow {
  month: number;
  category: string | null;
  subcategory: string | null;
  total: number;
}

export interface ExpenseCategoriesResponse {
  year: number;
  rows: ExpenseCategoryRow[];
}
