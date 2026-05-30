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

export interface AccountMonthlyBreakdownRow {
  month: number;
  contributed: number;
  deployed: number;
  uninvestedDelta: number;
}

export interface AccountMonthlyBreakdownTotals {
  contributed: number;
  deployed: number;
  uninvestedDelta: number;
}

import type { InvestmentAccountType } from '../constants';

export interface AccountMonthlyBreakdown {
  accountId: string;
  accountName: string;
  accountType: InvestmentAccountType;
  institution: string;
  annualLimit: number | null;
  months: AccountMonthlyBreakdownRow[];
  totals: AccountMonthlyBreakdownTotals;
}

export interface MonthlyBreakdownResponse {
  year: number;
  investmentsPercentage: number | null;
  months: MonthlyBreakdownRow[];
  totals: MonthlyBreakdownTotals;
  accounts: AccountMonthlyBreakdown[];
}
