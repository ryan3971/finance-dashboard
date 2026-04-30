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
