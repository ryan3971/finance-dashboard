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
  // ── Snapshot ────────────────────────────────────────────────────────────────

  'snapshot.accounts': {
    title: 'Accounts',
    body: 'A live snapshot of all active accounts and their current balances, grouped by account type.',
    sections: [
      {
        heading: 'Emergency Fund',
        description:
          'Tracks progress toward your emergency fund target. The current balance is the sum of all chequing accounts. Set a target amount in Config → Preferences.',
      },
    ],
  },

  'snapshot.incomeFlow': {
    title: 'Income Flow',
    body: 'Shows how gross income for the current month flows down to spending money, with an optional comparison against your anticipated budget.',
    sections: [
      {
        heading: 'Spending Income',
        description:
          'Gross income minus the investment allocation. This is the amount available for needs and wants spending, and is used as the income-side benchmark in the Spending Summary.',
      },
      {
        heading: 'Expected column',
        description:
          'Appears when anticipated budget entries exist for the current year. Compares each row against what you planned.',
      },
      {
        heading: 'Needs / Wants rows',
        description:
          'Only shown when allocation percentages are configured in Preferences. Each reflects the corresponding share of spending income for the month.',
      },
    ],
  },

  'snapshot.spendingSummary': {
    title: 'Spending Summary',
    body: 'Compares actual expenses this month against either your anticipated budget or your spending income.',
    sections: [
      {
        heading: 'Budget / Income toggle',
        description:
          'Switch between two benchmarks. Budget uses your anticipated expense entries for the year. Income uses your spending income split by the allocation percentages configured in Preferences. The toggle is only shown when anticipated budget entries exist.',
      },
      {
        heading: 'Remaining',
        description:
          'How much of the benchmark is left. Turns red when actual spending exceeds the benchmark.',
      },
      {
        heading: 'Progress bars',
        description:
          'Visual representation of actual vs benchmark for total, needs, and wants. Bars turn red when the benchmark is exceeded.',
      },
    ],
  },

  // ── Income ──────────────────────────────────────────────────────────────────

  'income.monthlyBreakdown': {
    title: 'Monthly Breakdown',
    body: 'A month-by-month breakdown of income for the selected year.',
    sections: [
      {
        heading: 'Needs / Wants / Investments columns',
        description:
          "These columns appear when allocation percentages are configured in Config → Preferences. Each reflects the corresponding share of that month's gross income.",
      },
      {
        heading: 'Filtering by month',
        description:
          'Click any month row to filter the Income Transactions pane to that month. Click the same row again, or the Total row, to clear the filter.',
      },
    ],
  },

  'income.incomeTransactions': {
    title: 'Income Transactions',
    body: 'The list of income transactions for the selected year or month. Syncs with whichever month is selected in the Monthly Breakdown table — or shows the full year when no month is selected.',
  },

  // ── Expenses ────────────────────────────────────────────────────────────────

  'expenses.monthlyBreakdown': {
    title: 'Monthly Breakdown',
    body: 'A month-by-month breakdown of expenses for the selected year.',
    sections: [
      {
        heading: 'Filtering by month',
        description:
          "Click any month row to filter the right panel to that month's transactions or category breakdown. Click the same row again to clear the filter.",
      },
      {
        heading: 'Needs / Wants / Other columns',
        description:
          'Appear when allocation percentages are configured. Needs and Wants reflect transactions explicitly classified as such. Other covers expenses that have not been classified as either a need or a want.',
      },
    ],
  },

  'expenses.transactions': {
    title: 'Expense Transactions',
    body: 'The list of expense transactions for the selected year or month. Syncs with whichever month is selected in the Monthly Breakdown table — or shows the full year when no month is selected.',
  },

  'expenses.categoryBreakdown': {
    title: 'Category Breakdown',
    body: 'Total expenses grouped by category and subcategory for the selected period.',
    sections: [
      {
        heading: '% of Total',
        description:
          "Each category's share of total expenses for the period. For subcategories, the percentage is relative to the parent category, not the overall total.",
      },
      {
        heading: 'Expand / Collapse',
        description:
          'Use the +/− button on each category row to show or hide its subcategories. Use Expand All / Collapse All to toggle everything at once.',
      },
    ],
  },

  // ── YTD ─────────────────────────────────────────────────────────────────────

  'ytd.summary': {
    title: 'Year to Date',
    body: 'A month-by-month view of your spending income, expenses, and net position for the selected year.',
    sections: [
      {
        heading: 'Spending Income',
        description:
          'Gross income minus the investment allocation for each month. Months with no income data show dashes.',
      },
      {
        heading: 'Net Spending Income',
        description:
          'Spending income minus total expenses for the month. Positive means you spent less than your spending income; negative means you overspent.',
      },
      {
        heading: 'Needs / Wants',
        description:
          'Expense totals classified as needs or wants based on the Need/Want field set on each transaction.',
      },
    ],
  },

  // ── Anticipated Budget ───────────────────────────────────────────────────────

  'anticipatedBudget.entryList': {
    title: 'Anticipated Budget',
    body: 'Define your expected income and expenses for the year. These entries power the Expected columns in the Income Flow card and the Budget benchmark in the Spending Summary.',
    sections: [
      {
        heading: 'Default vs monthly overrides',
        description:
          'Each entry has a default monthly amount. Expand an entry to set a different amount for specific months — useful for irregular expenses like insurance premiums or one-off income.',
      },
      {
        heading: 'Needs / Wants / NA classification',
        description:
          'Expense entries are classified as Need, Want, or NA. Need and Want drive the split benchmarks in the Spending Summary. NA is for expenses that do not fit either classification.',
      },
    ],
  },

  // ── Transactions ─────────────────────────────────────────────────────────────

  'transactions.list': {
    title: 'Transactions',
    body: 'The full ledger of all transactions across your accounts, with filtering, manual entry, and CSV export.',
    sections: [
      {
        heading: 'Flagged for review',
        description:
          'A transaction is flagged on import if it is uncategorized, or if it matches the pattern of an internal transfer. Open a flagged row to assign a category and clear the flag, or to confirm or dismiss the transfer suggestion. Dashboard totals may not be fully accurate while flagged transactions remain unresolved.',
      },
      {
        heading: 'Editing and duplicating',
        description:
          'Open any transaction to edit its category, Need/Want classification, or note. Use Duplicate to quickly create a copy — useful for recurring manual entries. Transfers can be marked or unmarked from the edit panel.',
      },
      {
        heading: 'Transfers',
        description:
          'Transactions marked as transfers are excluded from income and expense totals across all dashboard views.',
      },
      {
        heading: 'Manual transactions',
        description:
          'Use Add Transaction to record cash purchases or other transactions not captured by a CSV import.',
      },
    ],
  },

  'transactions.rebalancing': {
    title: 'Rebalancing Groups',
    body: 'Rebalancing groups let you link related transactions — such as split expenses, reimbursements, or refunds — so that only your net cost appears in dashboard totals.',
    sections: [
      {
        heading: 'Sources and offsets',
        description:
          'Each group contains source transactions (the original expenses you paid) and offset transactions (reimbursements or payments received from others). The dashboard subtracts the offset total from the source total, so only your net share affects spending figures.',
      },
      {
        heading: 'My share',
        description:
          'Your net cost after offsets are applied. If the offsets do not fully cover the sources, the remainder is counted against your spending totals. A manual override is available on each group if the calculated share does not reflect reality.',
      },
      {
        heading: 'Open vs resolved',
        description:
          'Only resolved groups are factored into dashboard totals. Mark a group as resolved once all offsets have been received. You can re-open it at any time if circumstances change.',
      },
      {
        heading: 'Creating a group',
        description:
          'Switch to the Transactions tab, open any transaction involved in the expense, and use the Rebalancing action to add it to a new or existing group. Assign it a role — source or offset — then add the remaining transactions the same way.',
      },
    ],
  },

  // ── Accounts ─────────────────────────────────────────────────────────────────

  'accounts.page': {
    title: 'Accounts',
    body: 'Manage the financial accounts that transactions are imported into and balances are tracked against.',
    sections: [
      {
        heading: 'Account types',
        description:
          'Supported types are chequing, savings, credit, TFSA, FHSA, RRSP, and non-registered. The type affects how balances are displayed and how the emergency fund is calculated.',
      },
      {
        heading: 'Investment accounts',
        description:
          'Dedicated tracking and analytics for investment account types (TFSA, FHSA, RRSP, non-registered) are coming soon.',
      },
      {
        heading: 'Deactivating accounts',
        description:
          'Deactivated accounts are hidden from the Snapshot but their transactions remain in the ledger and are included in all historical reports.',
      },
    ],
  },

  // ── Import ───────────────────────────────────────────────────────────────────

  'import.page': {
    title: 'Import Transactions',
    body: 'Upload a CSV file exported from your bank or brokerage to add transactions to an account.',
    sections: [
      {
        heading: 'Auto-categorization',
        description:
          'On import, each transaction is matched against your categorization rules. Transactions that match a rule are categorized automatically. Unmatched transactions are flagged for review.',
      },
      {
        heading: 'Duplicate detection',
        description:
          'Transactions already in the system are detected and skipped automatically, so it is safe to re-import a file that partially overlaps with a previous import.',
      },
    ],
  },

  // ── Config ───────────────────────────────────────────────────────────────────

  'config.categories': {
    title: 'Categories',
    body: 'Categories and subcategories are used to classify transactions. Each category is either income or expense, and expense categories carry a Need or Want classification.',
    sections: [
      {
        heading: 'Subcategories',
        description:
          'Add subcategories under any parent category for finer-grained reporting. The Category Breakdown on the Expenses page shows both levels.',
      },
      {
        heading: 'Need / Want',
        description:
          'Classifies an expense category as a need or a want. This drives the needs and wants splits across the dashboard. The classification can be overridden on individual transactions.',
      },
    ],
  },

  'config.rules': {
    title: 'Rules',
    body: 'Categorization rules automatically assign a category and subcategory to transactions on import based on their description.',
    sections: [
      {
        heading: 'How matching works',
        description:
          'Each rule matches against the transaction description using a keyword or phrase. Matching is case-insensitive. When multiple rules match the same transaction, the rule with the highest priority number is applied.',
      },
      {
        heading: 'Priority',
        description:
          'A numeric field you set on each rule. Higher numbers take precedence. Assign higher priority to more specific rules so they are not overridden by broader ones.',
      },
      {
        heading: 'Creating rules automatically',
        description:
          "While reviewing a flagged transaction, check 'Save as rule' before saving. This creates a rule from the category you assigned, so similar transactions are categorized automatically on future imports.",
      },
    ],
  },

  'config.preferences': {
    title: 'Preferences',
    body: 'Account-level settings that drive calculations across the dashboard.',
    sections: [
      {
        heading: 'Needs / Wants / Investments split',
        description:
          'The percentage of spending income allocated to each bucket. The three values must sum to 100%. These percentages are used to compute the expected amounts shown in the Income Flow and Spending Summary cards on the Snapshot.',
      },
      {
        heading: 'Emergency fund target',
        description:
          'The savings balance you are working toward. Displayed as a progress bar in the Snapshot Accounts card. Progress is calculated from the combined balance of all chequing accounts.',
      },
    ],
  },
} satisfies Record<string, HelpEntry>;
