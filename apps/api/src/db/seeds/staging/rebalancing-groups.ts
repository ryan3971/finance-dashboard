export type StagingRebalancingRole = 'source' | 'offset';
export type StagingRebalancingStatus = 'open' | 'resolved';

export interface StagingRebalancingTransaction {
  accountName: string;
  description: string;
  role: StagingRebalancingRole;
}

export interface StagingRebalancingGroup {
  label: string;
  status: StagingRebalancingStatus;
  myShareOverride: number | null;
  flaggedForReview: boolean;
  transactions: StagingRebalancingTransaction[];
}

export const STAGING_REBALANCING_GROUPS: StagingRebalancingGroup[] = [
  {
    // Open group — user split a restaurant bill with friends, not yet resolved
    label: 'Dinner Split',
    status: 'open',
    myShareOverride: null,
    flaggedForReview: false,
    transactions: [
      {
        accountName: 'CIBC Mastercard',
        description: 'restaurant midtown',
        role: 'source',
      },
    ],
  },
  {
    // Resolved group — weekend trip shared expenses with partial reimbursement received
    // Two source transactions (coffee + supplies), one offset (e-transfer back from friends)
    label: 'Weekend Trip',
    status: 'resolved',
    myShareOverride: 50,
    flaggedForReview: false,
    transactions: [
      {
        accountName: 'Amex',
        description: 'city coffee shop',
        role: 'source',
      },
      {
        accountName: 'Amex',
        description: 'online retailer purchase',
        role: 'source',
      },
      {
        accountName: 'TD Chequing 2',
        description: 'e-transfer in reimbursement',
        role: 'offset',
      },
    ],
  },
  {
    // Open group — shared subscription, flagged for review as the split is unclear
    label: 'Shared Subscription',
    status: 'open',
    myShareOverride: null,
    flaggedForReview: true,
    transactions: [
      {
        accountName: 'CIBC Mastercard',
        description: 'stream plus subscription',
        role: 'source',
      },
    ],
  },
];
