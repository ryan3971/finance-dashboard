export const STAGING_ACCOUNTS = [
  {
    name: 'Amex',
    type: 'credit',
    institution: 'amex',
    isCredit: true,
    fixture: { file: 'amex.csv' },
  },
  {
    name: 'CIBC Mastercard',
    type: 'credit',
    institution: 'cibc',
    isCredit: true,
    fixture: { file: 'cibc.csv' },
  },
  {
    name: 'TD Chequing',
    type: 'chequing',
    institution: 'td',
    isCredit: false,
    fixture: { file: 'td.csv' },
  },
];
