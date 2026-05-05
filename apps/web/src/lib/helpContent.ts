export interface HelpSection {
  heading: string;
  description: string;
}

export interface HelpEntry {
  title: string;
  body?: string;
  sections?: HelpSection[];
}

export const helpContent = {
  // Snapshot
  'snapshot.accounts': {
    title: 'Accounts',
    body: 'Help content coming soon.',
  },
  'snapshot.incomeFlow': {
    title: 'Income Flow',
    body: 'Help content coming soon.',
  },
  'snapshot.spendingSummary': {
    title: 'Spending Summary',
    body: 'Help content coming soon.',
  },

  // Income
  'income.monthlyBreakdown': {
    title: 'Monthly Breakdown',
    body: 'Help content coming soon.',
  },
  'income.incomeTransactions': {
    title: 'Income Transactions',
    body: 'Help content coming soon.',
  },

  // Expenses
  'expenses.monthlyBreakdown': {
    title: 'Monthly Breakdown',
    body: 'Help content coming soon.',
  },
  'expenses.transactions': {
    title: 'Expense Transactions',
    body: 'Help content coming soon.',
  },
  'expenses.categoryBreakdown': {
    title: 'Category Breakdown',
    body: 'Help content coming soon.',
  },

  // YTD
  'ytd.summary': {
    title: 'Year to Date',
    body: 'Help content coming soon.',
  },

  // Anticipated Budget
  'anticipatedBudget.entryList': {
    title: 'Anticipated Budget',
    body: 'Help content coming soon.',
  },

  // Transactions
  'transactions.list': {
    title: 'Transactions',
    body: 'Help content coming soon.',
  },
  'transactions.rebalancing': {
    title: 'Rebalancing',
    body: 'Help content coming soon.',
  },

  // Accounts
  'accounts.page': {
    title: 'Accounts',
    body: 'Help content coming soon.',
  },

  // Import
  'import.page': {
    title: 'Import Transactions',
    body: 'Help content coming soon.',
  },

  // Config
  'config.categories': {
    title: 'Categories',
    body: 'Help content coming soon.',
  },
  'config.rules': {
    title: 'Rules',
    body: 'Help content coming soon.',
  },
  'config.preferences': {
    title: 'Preferences',
    body: 'Help content coming soon.',
  },
} satisfies Record<string, HelpEntry>;
