import { INVESTMENT_ACCOUNT_TYPES } from '@finance/shared/constants';

export const INVESTMENT_TYPES_SET = new Set<string>(INVESTMENT_ACCOUNT_TYPES);

export const INVESTMENT_ACTION_OPTIONS = [
  { value: 'buy',        label: 'Buy' },
  { value: 'sell',       label: 'Sell' },
  { value: 'deposit',    label: 'Deposit' },
  { value: 'withdrawal', label: 'Withdrawal' },
  { value: 'dividend',   label: 'Dividend' },
  { value: 'transfer',   label: 'Transfer' },
  { value: 'fee',        label: 'Fee' },
] as const;
