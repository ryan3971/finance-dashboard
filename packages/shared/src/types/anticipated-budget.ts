import type { NeedWant } from '../constants';

export interface AnticipatedBudgetMonth {
  month: number;
  amount: string;
  isOverride: boolean;
}

export interface AnticipatedBudgetEntry {
  id: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  needWant: NeedWant | null;
  isIncome: boolean;
  monthlyAmount: string | null;
  notes: string | null;
  effectiveYear: number;
  months: AnticipatedBudgetMonth[];
}

export type AnticipatedBudgetResponse = AnticipatedBudgetEntry[];