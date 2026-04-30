// Test rebalancing group set — minimal and frozen.
//
// Three groups cover every state and configuration the UI can display:
//
//   Hardware Run      (open,     one source, no override, not flagged)
//                    → myShare = full source amount ($60)
//
//   Montreal Weekend  (resolved, two sources, myShareOverride $200)
//                    → user negotiated a fixed share across multiple expenses
//
//   LCBO Party Run    (open,     one source, no override, flaggedForReview)
//                    → flagged: prompts user to confirm whether to include
//
// Transaction lookups use (accountName, description) pairs — descriptions are
// lowercase-normalised, matching normaliseDescription() output from the import
// pipeline.  The seeder resolves them to DB IDs at insert time so this file
// stays independent of auto-generated UUIDs.

export type TestRebalancingRole = 'source' | 'offset';
export type TestRebalancingStatus = 'open' | 'resolved';

export interface TestRebalancingTransaction {
  // Matches an entry in DEV_ACCOUNTS[].name
  accountName: string;
  // Lowercased, as stored after normaliseDescription()
  description: string;
  role: TestRebalancingRole;
}

export interface TestRebalancingGroup {
  label: string;
  status: TestRebalancingStatus;
  myShareOverride: number | null;
  flaggedForReview: boolean;
  transactions: TestRebalancingTransaction[];
}

export const TEST_REBALANCING_GROUPS: TestRebalancingGroup[] = [
  // Simple open group — one source, nothing offset yet
  {
    label: 'Hardware Run',
    status: 'open',
    myShareOverride: null,
    flaggedForReview: false,
    transactions: [
      {
        accountName: 'CIBC Mastercard',
        description: 'hardware supply 789 burnaby, bc',
        role: 'source',
      },
    ],
  },
  // Resolved group — two sources, agreed-upon fixed share via override
  {
    label: 'Montreal Weekend',
    status: 'resolved',
    myShareOverride: 200,
    flaggedForReview: false,
    transactions: [
      {
        accountName: 'TD Chequing',
        description: 'e-transfer out ***abc',
        role: 'source',
      },
      {
        accountName: 'Amex',
        description: 'sunrise boutique 99812',
        role: 'source',
      },
    ],
  },
  // Open group flagged for review — user hasn't confirmed whether to track it
  {
    label: 'LCBO Party Run',
    status: 'open',
    myShareOverride: null,
    flaggedForReview: true,
    transactions: [
      {
        accountName: 'CIBC Mastercard',
        description: 'lcbo #456 vancouver, bc',
        role: 'source',
      },
    ],
  },
];
