export interface StagingTransaction {
  accountName: string;
  // Date is resolved dynamically at seed time relative to the current month.
  // monthsAgo: 0 = current month, 1 = last month, 2 = two months ago
  monthsAgo: number;
  day: number;
  description: string;
  amount: string;
  isIncome: boolean;
}

export const STAGING_TRANSACTIONS: StagingTransaction[] = [
  // ── M-2: Two months ago ───────────────────────────────────────────────────

  // TD Chequing — income & fixed expenses
  { accountName: 'TD Chequing', monthsAgo: 2, day: 1,  description: 'employer direct deposit',  amount: '4000.00',   isIncome: true  },
  { accountName: 'TD Chequing', monthsAgo: 2, day: 8,  description: 'gst/hst credit deposit',   amount: '500.00',    isIncome: true  },
  { accountName: 'TD Chequing', monthsAgo: 2, day: 1,  description: 'rent payment ref 001',     amount: '-1500.00',  isIncome: false },
  { accountName: 'TD Chequing', monthsAgo: 2, day: 14, description: 'transit pass reload',       amount: '-100.00',   isIncome: false },

  // Amex — discretionary spending
  { accountName: 'Amex', monthsAgo: 2, day: 8,  description: 'fresh market groceries',   amount: '-120.00', isIncome: false },
  { accountName: 'Amex', monthsAgo: 2, day: 19, description: 'online retailer purchase', amount: '-55.00',  isIncome: false },
  { accountName: 'Amex', monthsAgo: 2, day: 20, description: 'city pharmacy',            amount: '-45.00',  isIncome: false },

  // CIBC Mastercard — subscription and grocery
  { accountName: 'CIBC Mastercard', monthsAgo: 2, day: 12, description: 'stream plus subscription', amount: '-18.00', isIncome: false },
  { accountName: 'CIBC Mastercard', monthsAgo: 2, day: 18, description: 'neighborhood groceries',   amount: '-95.00', isIncome: false },

  // ── M-1: Last month ───────────────────────────────────────────────────────

  // TD Chequing — income, fixed expenses, and transfers
  { accountName: 'TD Chequing', monthsAgo: 1, day: 1,  description: 'employer direct deposit', amount: '4000.00',  isIncome: true  },
  { accountName: 'TD Chequing', monthsAgo: 1, day: 1,  description: 'rent payment ref 002',    amount: '-1500.00', isIncome: false },
  { accountName: 'TD Chequing', monthsAgo: 1, day: 5,  description: 'e-transfer out personal', amount: '-200.00',  isIncome: false },
  { accountName: 'TD Chequing', monthsAgo: 1, day: 14, description: 'transit pass reload',      amount: '-100.00',  isIncome: false },

  // Credit card bill payments — detected as transfer pairs with Amex/CIBC entries below
  { accountName: 'TD Chequing', monthsAgo: 1, day: 22, description: 'bill payment - amex', amount: '-350.00', isIncome: false },
  { accountName: 'TD Chequing', monthsAgo: 1, day: 22, description: 'bill payment - cibc', amount: '-420.00', isIncome: false },

  // Amex — groceries, dining (Weekend Trip source), pharmacy, then payment + two flagged transactions
  { accountName: 'Amex', monthsAgo: 1, day: 9,  description: 'corner grocery store',      amount: '-85.00',  isIncome: false },
  { accountName: 'Amex', monthsAgo: 1, day: 14, description: 'city coffee shop',          amount: '-22.00',  isIncome: false },
  { accountName: 'Amex', monthsAgo: 1, day: 20, description: 'city pharmacy',             amount: '-48.00',  isIncome: false },
  { accountName: 'Amex', monthsAgo: 1, day: 22, description: 'payment received',          amount: '350.00',  isIncome: false },
  { accountName: 'Amex', monthsAgo: 1, day: 25, description: 'hillside community centre', amount: '-80.00',  isIncome: false },
  { accountName: 'Amex', monthsAgo: 1, day: 27, description: 'north point athletics',     amount: '-45.00',  isIncome: false },

  // CIBC Mastercard — subscription (Shared Subscription source), restaurant (Dinner Split source), payment
  { accountName: 'CIBC Mastercard', monthsAgo: 1, day: 12, description: 'stream plus subscription', amount: '-18.00',  isIncome: false },
  { accountName: 'CIBC Mastercard', monthsAgo: 1, day: 16, description: 'restaurant midtown',        amount: '-68.00',  isIncome: false },
  { accountName: 'CIBC Mastercard', monthsAgo: 1, day: 22, description: 'payment thank you',         amount: '420.00',  isIncome: false },

  // TD Chequing 2 — receives the chequing transfer and a reimbursement (Weekend Trip offset)
  { accountName: 'TD Chequing 2', monthsAgo: 1, day: 5,  description: 'e-transfer in personal',       amount: '200.00', isIncome: false },
  { accountName: 'TD Chequing 2', monthsAgo: 1, day: 18, description: 'e-transfer in reimbursement',  amount: '75.00',  isIncome: false },

  // ── M-0: Current month (sparse — partway through) ─────────────────────────

  // TD Chequing — income and rent
  { accountName: 'TD Chequing', monthsAgo: 0, day: 1, description: 'employer direct deposit', amount: '4000.00',  isIncome: true  },
  { accountName: 'TD Chequing', monthsAgo: 0, day: 1, description: 'rent payment ref 003',    amount: '-1500.00', isIncome: false },
  { accountName: 'TD Chequing', monthsAgo: 0, day: 6, description: 'oakmont services ltd',    amount: '-120.00',  isIncome: false },

  // Amex — early-month grocery run
  { accountName: 'Amex', monthsAgo: 0, day: 5, description: 'morning grocery stop', amount: '-65.00', isIncome: false },

  // CIBC Mastercard — uncategorized transaction for review
  { accountName: 'CIBC Mastercard', monthsAgo: 0, day: 2, description: 'riverside pet supply', amount: '-35.00', isIncome: false },
];
