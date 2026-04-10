export interface IncomeMonthAllocation {
  needs: string;
  wants: string;
  investments: string;
}

export interface IncomeMonth {
  month: number;
  total: string;
  allocation: IncomeMonthAllocation | null;
}

export interface IncomeDashboardResponse {
  year: number;
  months: IncomeMonth[];
}
