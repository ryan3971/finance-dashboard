export interface StagingInvestmentTransaction {
  accountName: string;
  // Date is resolved dynamically at seed time relative to the current month.
  // monthsAgo: 0 = current month, 1 = last month, 2 = two months ago
  monthsAgo: number;
  day: number;
  action: string;
  rawAction: string;
  symbol?: string;
  description: string;
  quantity?: string;
  price?: string;
  grossAmount?: string;
  commission?: string;
  amount: string;
  currency: string;
  activityType?: string;
}

export const STAGING_INVESTMENT_TRANSACTIONS: StagingInvestmentTransaction[] = [
  // ── Questrade TFSA — Prior year (M-16 to M-5) ────────────────────────────

  {
    accountName: 'Questrade TFSA',
    monthsAgo: 16, day: 15,
    action: 'deposit', rawAction: 'CON',
    description: 'Cash Contribution',
    amount: '7000.00', currency: 'CAD',
    activityType: 'Deposits',
  },
  {
    accountName: 'Questrade TFSA',
    monthsAgo: 16, day: 22,
    action: 'buy', rawAction: 'Buy',
    symbol: 'VFV',
    description: 'Vanguard FTSE Canada All Cap ETF',
    quantity: '50.000000', price: '120.0000', grossAmount: '6000.00', commission: '4.95',
    amount: '-6004.95', currency: 'CAD',
    activityType: 'Trades',
  },
  {
    accountName: 'Questrade TFSA',
    monthsAgo: 16, day: 22,
    action: 'buy', rawAction: 'Buy',
    symbol: 'VEQT',
    description: 'Vanguard All-Equity ETF Portfolio',
    quantity: '20.000000', price: '42.0000', grossAmount: '840.00', commission: '4.95',
    amount: '-844.95', currency: 'CAD',
    activityType: 'Trades',
  },
  {
    accountName: 'Questrade TFSA',
    monthsAgo: 14, day: 1,
    action: 'dividend', rawAction: 'DIV',
    symbol: 'VFV',
    description: 'Vanguard FTSE Canada All Cap ETF — Dividend',
    amount: '45.00', currency: 'CAD',
    activityType: 'Dividends',
  },
  {
    accountName: 'Questrade TFSA',
    monthsAgo: 14, day: 1,
    action: 'dividend', rawAction: 'DIV',
    symbol: 'VEQT',
    description: 'Vanguard All-Equity ETF Portfolio — Dividend',
    amount: '12.50', currency: 'CAD',
    activityType: 'Dividends',
  },
  {
    accountName: 'Questrade TFSA',
    monthsAgo: 13, day: 1,
    action: 'transfer', rawAction: 'TF6',
    description: 'Broker Transfer In',
    amount: '5000.00', currency: 'CAD',
    activityType: 'Transfers',
  },
  {
    accountName: 'Questrade TFSA',
    monthsAgo: 11, day: 1,
    action: 'dividend', rawAction: 'DIV',
    symbol: 'VFV',
    description: 'Vanguard FTSE Canada All Cap ETF — Dividend',
    amount: '47.25', currency: 'CAD',
    activityType: 'Dividends',
  },
  {
    accountName: 'Questrade TFSA',
    monthsAgo: 11, day: 28,
    action: 'fee', rawAction: 'FCH',
    description: 'Quarterly Management Fee',
    amount: '-15.00', currency: 'CAD',
    activityType: 'Fees',
  },
  {
    accountName: 'Questrade TFSA',
    monthsAgo: 8, day: 1,
    action: 'dividend', rawAction: 'DIV',
    symbol: 'VEQT',
    description: 'Vanguard All-Equity ETF Portfolio — Dividend',
    amount: '14.00', currency: 'CAD',
    activityType: 'Dividends',
  },
  {
    accountName: 'Questrade TFSA',
    monthsAgo: 8, day: 28,
    action: 'fee', rawAction: 'FCH',
    description: 'Quarterly Management Fee',
    amount: '-15.00', currency: 'CAD',
    activityType: 'Fees',
  },
  {
    accountName: 'Questrade TFSA',
    monthsAgo: 7, day: 15,
    action: 'deposit', rawAction: 'CON',
    description: 'Additional Contribution',
    amount: '2500.00', currency: 'CAD',
    activityType: 'Deposits',
  },
  {
    accountName: 'Questrade TFSA',
    monthsAgo: 5, day: 1,
    action: 'dividend', rawAction: 'DIV',
    symbol: 'VFV',
    description: 'Vanguard FTSE Canada All Cap ETF — Dividend',
    amount: '49.50', currency: 'CAD',
    activityType: 'Dividends',
  },

  // ── Questrade TFSA — Current year (M-4 to M-0) ───────────────────────────

  {
    accountName: 'Questrade TFSA',
    monthsAgo: 4, day: 15,
    action: 'deposit', rawAction: 'CON',
    description: 'Annual Contribution',
    amount: '7000.00', currency: 'CAD',
    activityType: 'Deposits',
  },
  {
    accountName: 'Questrade TFSA',
    monthsAgo: 4, day: 20,
    action: 'buy', rawAction: 'Buy',
    symbol: 'VFV',
    description: 'Vanguard FTSE Canada All Cap ETF',
    quantity: '30.000000', price: '130.0000', grossAmount: '3900.00', commission: '4.95',
    amount: '-3904.95', currency: 'CAD',
    activityType: 'Trades',
  },
  {
    accountName: 'Questrade TFSA',
    monthsAgo: 2, day: 1,
    action: 'dividend', rawAction: 'DIV',
    symbol: 'VFV',
    description: 'Vanguard FTSE Canada All Cap ETF — Dividend',
    amount: '52.00', currency: 'CAD',
    activityType: 'Dividends',
  },
  {
    accountName: 'Questrade TFSA',
    monthsAgo: 1, day: 10,
    action: 'sell', rawAction: 'Sell',
    symbol: 'VEQT',
    description: 'Vanguard All-Equity ETF Portfolio — Partial Sell',
    quantity: '5.000000', price: '45.0000', grossAmount: '225.00', commission: '4.95',
    amount: '220.05', currency: 'CAD',
    activityType: 'Trades',
  },
  {
    accountName: 'Questrade TFSA',
    monthsAgo: 0, day: 15,
    action: 'withdrawal', rawAction: 'WDW',
    description: 'Withdrawal',
    amount: '-1500.00', currency: 'CAD',
    activityType: 'Withdrawals',
  },

  // ── Questrade RRSP — Prior year (M-16 to M-5) ────────────────────────────

  {
    accountName: 'Questrade RRSP',
    monthsAgo: 16, day: 15,
    action: 'deposit', rawAction: 'CON',
    description: 'RRSP Contribution',
    amount: '18000.00', currency: 'CAD',
    activityType: 'Deposits',
  },
  {
    accountName: 'Questrade RRSP',
    monthsAgo: 16, day: 22,
    action: 'buy', rawAction: 'Buy',
    symbol: 'VXC',
    description: 'Vanguard FTSE Global ex Canada ETF',
    quantity: '200.000000', price: '43.0000', grossAmount: '8600.00', commission: '4.95',
    amount: '-8604.95', currency: 'CAD',
    activityType: 'Trades',
  },
  {
    accountName: 'Questrade RRSP',
    monthsAgo: 14, day: 1,
    action: 'dividend', rawAction: 'DIV',
    symbol: 'VXC',
    description: 'Vanguard FTSE Global ex Canada ETF — Dividend',
    amount: '180.00', currency: 'CAD',
    activityType: 'Dividends',
  },
  {
    accountName: 'Questrade RRSP',
    monthsAgo: 11, day: 1,
    action: 'dividend', rawAction: 'DIV',
    symbol: 'VXC',
    description: 'Vanguard FTSE Global ex Canada ETF — Dividend',
    amount: '185.00', currency: 'CAD',
    activityType: 'Dividends',
  },
  {
    accountName: 'Questrade RRSP',
    monthsAgo: 11, day: 28,
    action: 'fee', rawAction: 'FCH',
    description: 'Quarterly Management Fee',
    amount: '-15.00', currency: 'CAD',
    activityType: 'Fees',
  },
  {
    accountName: 'Questrade RRSP',
    monthsAgo: 8, day: 1,
    action: 'dividend', rawAction: 'DIV',
    symbol: 'VXC',
    description: 'Vanguard FTSE Global ex Canada ETF — Dividend',
    amount: '190.00', currency: 'CAD',
    activityType: 'Dividends',
  },
  {
    accountName: 'Questrade RRSP',
    monthsAgo: 7, day: 15,
    action: 'buy', rawAction: 'Buy',
    symbol: 'VCN',
    description: 'Vanguard FTSE Canada All Cap ETF',
    quantity: '100.000000', price: '42.0000', grossAmount: '4200.00', commission: '4.95',
    amount: '-4204.95', currency: 'CAD',
    activityType: 'Trades',
  },
  {
    accountName: 'Questrade RRSP',
    monthsAgo: 5, day: 1,
    action: 'dividend', rawAction: 'DIV',
    symbol: 'VCN',
    description: 'Vanguard FTSE Canada All Cap ETF — Dividend',
    amount: '95.00', currency: 'CAD',
    activityType: 'Dividends',
  },
  {
    accountName: 'Questrade RRSP',
    monthsAgo: 5, day: 28,
    action: 'fee', rawAction: 'FCH',
    description: 'Annual Account Fee',
    amount: '-25.00', currency: 'CAD',
    activityType: 'Fees',
  },

  // ── Questrade RRSP — Current year (M-4 to M-1) ───────────────────────────

  {
    accountName: 'Questrade RRSP',
    monthsAgo: 4, day: 15,
    action: 'deposit', rawAction: 'CON',
    description: 'RRSP Contribution',
    amount: '19000.00', currency: 'CAD',
    activityType: 'Deposits',
  },
  {
    accountName: 'Questrade RRSP',
    monthsAgo: 2, day: 1,
    action: 'dividend', rawAction: 'DIV',
    symbol: 'VXC',
    description: 'Vanguard FTSE Global ex Canada ETF — Dividend',
    amount: '195.00', currency: 'CAD',
    activityType: 'Dividends',
  },
  {
    accountName: 'Questrade RRSP',
    monthsAgo: 2, day: 1,
    action: 'dividend', rawAction: 'DIV',
    symbol: 'VCN',
    description: 'Vanguard FTSE Canada All Cap ETF — Dividend',
    amount: '50.00', currency: 'CAD',
    activityType: 'Dividends',
  },
  {
    accountName: 'Questrade RRSP',
    monthsAgo: 1, day: 1,
    action: 'sell', rawAction: 'Sell',
    symbol: 'VCN',
    description: 'Vanguard FTSE Canada All Cap ETF — Rebalance',
    quantity: '25.000000', price: '44.0000', grossAmount: '1100.00', commission: '4.95',
    amount: '1095.05', currency: 'CAD',
    activityType: 'Trades',
  },
];
