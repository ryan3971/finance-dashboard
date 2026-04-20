export type RebalancingRole = 'source' | 'offset';
export type RebalancingStatus = 'open' | 'resolved';

export interface RebalancingGroupTransaction {
  transactionId: string;
  role: RebalancingRole;
  amount: string;
  date: string;
  description: string;
  accountName: string;
  categoryName: string | null;
  subcategoryName: string | null;
}

export interface RebalancingGroup {
  id: string;
  label: string;
  status: RebalancingStatus;
  myShareOverride: number | null;
  flaggedForReview: boolean;
  createdAt: string;
  sourceTotal: number;
  offsetTotal: number;
  myShare: number;
  transactions: RebalancingGroupTransaction[];
}

export interface RebalancingGroupsResponse {
  groups: RebalancingGroup[];
}
