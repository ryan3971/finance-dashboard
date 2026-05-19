export type RiskLevel = 'regular' | 'risky';

export type InvestmentAction =
  | 'buy'
  | 'sell'
  | 'dividend'
  | 'deposit'
  | 'withdrawal'
  | 'transfer'
  | 'fee';

/** Provenance of an investment transaction row. */
export type InvestmentTransactionSource = 'csv' | 'manual';

export interface InvestmentTransactionRow {
  id: string;
  accountId: string;
  accountName: string;
  date: string;
  action: InvestmentAction;
  rawAction: string;
  symbol: string | null;
  description: string | null;
  quantity: number | null;
  price: number | null;
  grossAmount: number | null;
  commission: number | null;
  amount: number;
  currency: string;
  activityType: string | null;
  note: string | null;
  source: InvestmentTransactionSource;
  riskLevel: RiskLevel | null;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface InvestmentTransactionAggregates {
  dividends: number;
  fees: number;
  netDeposits: number;
}

export interface InvestmentTransactionsResponse {
  data: InvestmentTransactionRow[];
  pagination: PaginationMeta;
  aggregates: InvestmentTransactionAggregates;
}


export interface AccountContributionSummary {
  accountId: string;
  accountName: string;
  accountType: 'tfsa' | 'rrsp' | 'fhsa';
  annualLimit: number | null;
  roomCarried: number | null;
  roomCarriedIsEstimate: boolean;
  contributions: number;
  withdrawals: number;
  availableRoom: number | null;
}

export interface ContributionRoomResponse {
  year: number;
  accounts: AccountContributionSummary[];
}

export interface RiskBudgetResponse {
  year: number;
  riskyPercentage: number | null;
  totalContributions: number;
  riskyBudget: number | null;
  riskyInvested: number;
  remaining: number | null;
}
