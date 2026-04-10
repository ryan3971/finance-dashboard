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
