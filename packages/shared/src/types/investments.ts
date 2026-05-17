export type InvestmentAction =
  | 'buy'
  | 'sell'
  | 'dividend'
  | 'deposit'
  | 'withdrawal'
  | 'transfer'
  | 'fee';

export interface InvestmentTransactionRow {
  id: string;
  accountId: string;
  accountName: string;
  date: string;
  action: string;
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
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface InvestmentTransactionsResponse {
  data: InvestmentTransactionRow[];
  pagination: PaginationMeta;
}

export interface InvestmentSummaryResponse {
  year: number;
  dividendsReceived: number;
  feesPaid: number;
  netDeposits: number;
  totalContributions: number;
  totalWithdrawals: number;
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
