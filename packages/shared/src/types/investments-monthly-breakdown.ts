export interface MonthlyBreakdownRow {
  month: number;
  contributed: number;
  deployed: number;
  uninvestedDelta: number;
  target: number | null;
}

export interface MonthlyBreakdownTotals {
  contributed: number;
  deployed: number;
  uninvestedDelta: number;
  target: number | null;
}

export interface MonthlyBreakdownResponse {
  year: number;
  investmentsPercentage: number | null;
  months: MonthlyBreakdownRow[];
  totals: MonthlyBreakdownTotals;
}
