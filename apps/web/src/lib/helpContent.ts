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
    body: 'Define your expected income and expenses for the year. These entries power the Expected column in the Income Flow card and the Budget benchmark in the Spending Summary.',
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
      {
        heading: 'Copy from year',
        description:
          'Use the Copy from [year] button to duplicate all entries from the previous year into the current year. This is only available when the current year has no entries yet, and is useful for years where your budget does not change significantly.',
      },
      {
        heading: 'Adding and editing entries',
        description:
          'Click Add Entry to create a new income or expense line. Choose whether it is income or an expense, set the Need/Want classification for expenses, and enter the default monthly amount. Expand the entry afterwards to override individual months.',
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
          'A transaction is flagged on import for one of two reasons: it has no matching categorization rule and needs a category assigned, or its description matches a known transfer pattern and needs to be confirmed or dismissed. Unresolved flags can cause dashboard totals to be incomplete or inaccurate.',
      },
      {
        heading: 'Category source badge',
        description:
          'Each categorized transaction shows how its category was assigned: Rule (matched a categorization rule on import), AI (assigned by the AI categorization model), or Manual (set by you directly). Badges appear in the transaction detail panel.',
      },
      {
        heading: 'Filters',
        description:
          'Open the Filters panel to narrow the list by account, month or date range, category, Need/Want classification, tags, transfer status, or review status. Active filters are shown as a count badge on the Filters button. Use Clear all to reset all filters at once.',
      },
      {
        heading: 'Tags',
        description:
          'Tags are coloured labels you can attach to transactions for custom grouping or tracking — for example, tagging a group of transactions to a specific trip or project. Filter by one or more tags using the Filters panel.',
      },
      {
        heading: 'Editing and duplicating',
        description:
          'Open any transaction to edit its category, Need/Want classification, note, or transfer status. Use Duplicate to quickly create a copy — useful for recurring manual entries.',
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
      {
        heading: 'Apply Rules',
        description:
          'Re-runs all categorization rules against existing uncategorized transactions. Useful after adding new rules to catch transactions that were previously flagged for review.',
      },
    ],
  },

  'transactions.rebalancing': {
    title: 'Rebalancing Groups',
    body: 'Rebalancing groups let you link related transactions — such as split expenses, reimbursements, or refunds — so that only your net cost appears in dashboard totals.',
    sections: [
      {
        heading: 'Stats bar',
        description:
          'Shows a summary across all groups: total count, open groups awaiting resolution, resolved groups, and groups flagged for review. Use these to quickly gauge how many outstanding items need attention.',
      },
      {
        heading: 'Filtering and search',
        description:
          'Filter groups by status (All, Flagged, Open, Resolved) and search by label to quickly locate a specific group. Filters apply together — for example, Flagged + a label search narrows to flagged groups matching that name.',
      },
      {
        heading: 'Flagged groups',
        description:
          'A group is flagged for review when its calculated share may not reflect reality — for example, when offset amounts are incomplete or when a transaction in the group has been modified. Review flagged groups to confirm the share is correct, then mark it resolved.',
      },
      {
        heading: 'Sources and offsets',
        description:
          'Each group contains source transactions (the original expenses you paid) and offset transactions (reimbursements or payments received from others). The dashboard subtracts the offset total from the source total, so only your net share affects spending figures.',
      },
      {
        heading: 'My share',
        description:
          'Your net cost after offsets are applied. If the offsets do not fully cover the sources, the remainder is counted against your spending totals. A manual override is available on each group if the calculated share does not reflect reality — the original calculated amount is shown in parentheses when an override is active.',
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
          'On import, each transaction is matched against your categorization rules. Transactions that match a rule are categorized automatically. Unmatched transactions are either sent to the AI categorization model (if enabled) or flagged for manual review.',
      },
      {
        heading: 'AI categorization',
        description:
          'When AI categorization is enabled, transactions that do not match any rule are sent to an AI model for classification. The model assigns a category based on the transaction description and a confidence score. Only results that meet the confidence threshold are applied — lower-confidence results are flagged for review instead. AI-categorized transactions show an "AI" badge in the transaction detail panel.',
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
        heading: 'Match type: Substring vs Wildcard',
        description:
          'Substring rules match anywhere in the description — the keyword "netflix" matches "NETFLIX.COM/CA". Wildcard rules use * as a stand-in for any sequence of characters, giving you more precise control — for example, "AMAZON*CA" matches descriptions that start with "AMAZON" and end with "CA" but not other Amazon variants. Wildcard rules are marked with a "W" badge in the rules list.',
      },
      {
        heading: 'Priority',
        description:
          'A numeric field you set on each rule. Higher numbers take precedence. Assign higher priority to more specific rules so they are not overridden by broader ones.',
      },
      {
        heading: 'Flag for review',
        description:
          'Instead of assigning a category, a rule can be configured to flag matching transactions for manual review. Use this for transactions that look like transfers or that you always want to inspect before they are counted.',
      },
      {
        heading: 'Suggested rules',
        description:
          'The Suggested Rules panel appears when the AI model has identified patterns across flagged transactions that could become rules. Each suggestion shows the proposed keyword, category, and a confidence score. Accept a suggestion to create the rule immediately, use Edit & Accept to adjust it first, or Dismiss to discard it.',
      },
      {
        heading: 'Creating rules automatically',
        description:
          "While reviewing a flagged transaction, check 'Save as rule' before saving. This creates a rule from the category you assigned, so similar transactions are categorized automatically on future imports.",
      },
      {
        heading: 'Applying a rule to existing transactions',
        description:
          'After editing a rule, you are offered the option to apply the updated categorization to existing transactions that match the rule. This re-categorizes transactions previously assigned by a rule, by AI, or left uncategorized — but intentionally skips any transaction you have categorized manually. To update a manually categorized transaction, open it in the transaction list and change its category directly.',
      },
      {
        heading: 'Apply Rules',
        description:
          'The Apply Rules button on the Transactions page re-runs all rules against existing transactions that have no category. Use it after adding new rules to categorize transactions that were previously left unresolved without needing to re-import.',
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
      {
        heading: 'Reset Account',
        description:
          'Permanently deletes all accounts, transactions, categories, rules, and budget entries and restores the default categories and rules. This cannot be undone. Use only if you want to start completely fresh.',
      },
    ],
  },
  // ── Investments ──────────────────────────────────────────────────────────────

  'investments.contributionRoom': {
    title: 'Contribution Room',
    body: 'Tracks your remaining registered contribution room for TFSA, RRSP, and FHSA accounts for the selected year.',
    sections: [
      {
        heading: 'Annual limit',
        description:
          'The maximum you can contribute to this account type in the tax year. For TFSA, this is set by the CRA each year. Click the pencil icon on any row to enter or update your limit.',
      },
      {
        heading: 'Room carried',
        description:
          'Unused contribution room carried forward from prior years. For TFSA, this is estimated automatically from last year\'s limit when you haven\'t confirmed the current amount — look for the "Est." label.',
      },
      {
        heading: 'Available room',
        description:
          'How much you can still contribute: annual limit plus room carried, minus contributions made so far, plus any withdrawals (TFSA only). Turns red when you\'ve exceeded your room.',
      },
      {
        heading: 'Contributions and withdrawals',
        description:
          'Derived automatically from deposit and withdrawal transactions in your investment accounts for the selected year. No manual entry needed — add or import transactions to keep these current.',
      },
    ],
  },

  'investments.riskBudget': {
    title: 'Risk Budget',
    body: 'Tracks how much of your annual contributions are allocated to higher-risk positions, relative to a configurable target percentage.',
    sections: [
      {
        heading: 'Risky %',
        description:
          'The share of your total annual contributions you\'re targeting for higher-risk investments. Click the pencil icon to set or update this percentage. Once set, the budget and remaining figures are calculated automatically.',
      },
      {
        heading: 'Risky budget',
        description:
          'Total annual contributions multiplied by the risky percentage. This is your spending limit for higher-risk positions.',
      },
      {
        heading: 'Risky invested',
        description:
          'The total cost of all buy transactions classified as "risky" for the year. Click any buy row\'s risk badge in the Activity tab to toggle it between Regular and Risky.',
      },
      {
        heading: 'Remaining',
        description:
          'Budget minus invested. Turns red when you\'ve exceeded your risky budget. A negative remaining means your risky exposure is above the target percentage.',
      },
    ],
  },

  'investments.monthlyBreakdown': {
    title: 'Monthly Breakdown',
    body: 'A month-by-month view of contribution and deployment activity across all investment accounts for the selected year.',
    sections: [
      {
        heading: 'Contributed',
        description:
          'The total deposited into investment accounts in each month. This counts deposit transactions only — transfers and other action types are excluded.',
      },
      {
        heading: 'Deployed',
        description:
          'Net buy/sell activity for the month: buys are negative, sells are positive. A negative deployed figure means more was invested than liquidated.',
      },
      {
        heading: 'Uninvested',
        description:
          'Contributed minus deployed. A positive amount (shown in amber) means cash is sitting in the account that hasn\'t been put to work yet.',
      },
      {
        heading: 'Annual limit progress',
        description:
          'The YTD progress bar compares total contributions so far against the combined annual limit of all registered accounts. Limits must be entered in the Contribution Room card for this to appear.',
      },
      {
        heading: 'Per-account tabs',
        description:
          'Switch to a specific account to see its monthly breakdown and YTD progress in isolation. Future months in the current year are shown but greyed out.',
      },
    ],
  },

  'investments.activity': {
    title: 'Activity',
    body: 'The full history of investment transactions across all accounts, with filtering and manual entry.',
    sections: [
      {
        heading: 'Stats bar',
        description:
          'Shows totals for the current filtered view: dividends received, fees paid, and net deposits (contributions minus withdrawals). All three update when filters are applied.',
      },
      {
        heading: 'Filters',
        description:
          'Narrow the list by account, action type, symbol, or date range. Multiple filters apply together. Clear individual filters using the × on each chip.',
      },
      {
        heading: 'Column visibility',
        description:
          'Use the toggle buttons above the table to show or hide optional columns: Qty, Price, Gross, Commission, Currency, and Activity type. Hidden by default to keep the table compact.',
      },
      {
        heading: 'Risk classification',
        description:
          'Buy transactions have a clickable risk badge. Click it to toggle between Regular and Risky. Risky buys count toward your Risk Budget. All other action types are unclassified.',
      },
      {
        heading: 'Manual transactions',
        description:
          'Use Add Transaction to record a buy, sell, deposit, or any other activity that wasn\'t captured by a CSV import. Manual entries are marked with a "manual" source badge.',
      },
      {
        heading: 'Duplicate',
        description:
          'Hover any row and click Duplicate to open the Add Transaction panel pre-filled with the same values. Useful for recurring manual entries or correcting a mis-entered transaction.',
      },
    ],
  },
} satisfies Record<string, HelpEntry>;
