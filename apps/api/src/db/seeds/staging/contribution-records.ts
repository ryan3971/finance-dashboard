export interface StagingContributionRecord {
  accountName: string;
  taxYear: number;
  annualLimit: string | null;
  roomCarried: string | null;
  roomCarriedConfirmed: boolean;
}

export const STAGING_CONTRIBUTION_RECORDS: StagingContributionRecord[] = [
  {
    accountName: 'Questrade TFSA',
    taxYear: 2024,
    annualLimit: '7000',
    roomCarried: '14500',
    roomCarriedConfirmed: true,
  },
  {
    // RRSP: annualLimit intentionally null to exercise the "enter limit" prompt in the UI
    accountName: 'Questrade RRSP',
    taxYear: 2024,
    annualLimit: null,
    roomCarried: null,
    roomCarriedConfirmed: false,
  },
];
