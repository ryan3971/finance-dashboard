export const ACCOUNT_TYPES = [
  'chequing',
  'savings',
  'credit',
  'tfsa',
  'fhsa',
  'rrsp',
  'non-registered',
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_ORDER: Record<AccountType, number> = {
  chequing: 0,
  savings: 1,
  credit: 2,
  tfsa: 3,
  fhsa: 4,
  rrsp: 5,
  'non-registered': 6,
};

export const INSTITUTIONS = [
  'amex',
  'cibc',
  'td',
  'questrade',
  'manual',
] as const;

export type Institution = (typeof INSTITUTIONS)[number];

export const TRANSFER_KEYWORDS = [
  'e-tfr',
  'e-transfer',
  'tfr-to',
  'tfr-fr',
  'trf-to',
  'trf-fr',
  'transfer',
  'interac',
  'payment thank you',
  'paiement merci',
  'payment received',
  'bill pymt',
] as const;

export const DEFAULT_CURRENCY = 'CAD';

export const MONTHS_IN_YEAR = 12;

export const FIELD_LIMITS = {
  NOTE_MAX: 500,
  TAG_NAME_MAX: 15,
  ACCOUNT_NAME_MAX: 100,
  SUBCATEGORY_NAME_MAX: 100,
  RULE_KEYWORD_MAX: 200,
  BUDGET_ENTRY_NAME_MAX: 100,
  PASSWORD_MIN: 8,
  PASSWORD_MAX: 100,
} as const;

export const NEED_WANT_OPTIONS = ['Need', 'Want', 'NA'] as const;
export type NeedWant = (typeof NEED_WANT_OPTIONS)[number];

export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const PAGINATION = {
  DEFAULT_LIMIT: 50,
  EXPORT_LIMIT: 10000,
} as const;
