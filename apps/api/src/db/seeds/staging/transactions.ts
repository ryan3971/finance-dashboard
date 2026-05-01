export interface StagingTransaction {
  accountName: string;
  date: string;
  description: string;
  amount: string;
  isIncome: boolean;
}

export const STAGING_TRANSACTIONS: StagingTransaction[] = [
  // Amex — positive = income, negative = expense
  { accountName: 'Amex', date: '2026-01-15', description: 'amazon.ca order 4521', amount: '-42.99', isIncome: false },
  { accountName: 'Amex', date: '2026-01-15', description: 'netflix.com', amount: '-17.99', isIncome: false },
  { accountName: 'Amex', date: '2026-01-22', description: 'whole foods market 12', amount: '-95.40', isIncome: false },
  { accountName: 'Amex', date: '2026-02-14', description: 'sunrise boutique 99812', amount: '-182.50', isIncome: false },
  { accountName: 'Amex', date: '2026-03-08', description: 'tim hortons 4521', amount: '-6.25', isIncome: false },

  // CIBC Mastercard
  { accountName: 'CIBC Mastercard', date: '2026-01-10', description: 'metro grocery 456', amount: '-78.34', isIncome: false },
  { accountName: 'CIBC Mastercard', date: '2026-01-18', description: 'lcbo #456 vancouver, bc', amount: '-45.00', isIncome: false },
  { accountName: 'CIBC Mastercard', date: '2026-02-03', description: 'hardware supply 789 burnaby, bc', amount: '-234.60', isIncome: false },
  { accountName: 'CIBC Mastercard', date: '2026-02-20', description: 'cineplex odeon 321', amount: '-28.00', isIncome: false },
  { accountName: 'CIBC Mastercard', date: '2026-03-01', description: 'spotify canada', amount: '-11.99', isIncome: false },

  // TD Chequing
  { accountName: 'TD Chequing', date: '2026-01-01', description: 'payroll deposit - employer', amount: '3800.00', isIncome: true },
  { accountName: 'TD Chequing', date: '2026-01-15', description: 'hydro one bill payment', amount: '-85.00', isIncome: false },
  { accountName: 'TD Chequing', date: '2026-02-01', description: 'payroll deposit - employer', amount: '3800.00', isIncome: true },
  { accountName: 'TD Chequing', date: '2026-02-10', description: 'e-transfer out ***abc', amount: '-150.00', isIncome: false },
];
