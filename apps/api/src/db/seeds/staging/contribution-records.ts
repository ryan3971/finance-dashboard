export interface StagingContributionRecord {
  accountName: string;
  // Tax year is resolved dynamically at seed time: taxYear = currentYear - yearsAgo.
  // yearsAgo: 1 = the most recently completed tax year
  yearsAgo: number;
  annualLimit: string | null;
  roomCarried: string | null;
  roomCarriedConfirmed: boolean;
}

export const STAGING_CONTRIBUTION_RECORDS: StagingContributionRecord[] = [
  {
    accountName: 'Questrade TFSA',
    yearsAgo: 1,
    annualLimit: '7000',
    roomCarried: '14500',
    roomCarriedConfirmed: true,
  },
  {
    // annualLimit intentionally null to exercise the "enter limit" prompt in the UI
    accountName: 'Questrade RRSP',
    yearsAgo: 1,
    annualLimit: null,
    roomCarried: null,
    roomCarriedConfirmed: false,
  },
];
