// Import pipeline statuses
export const IMPORT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETE: 'complete',
  ERROR: 'error',
} as const;

// Transaction ingestion source
export const TRANSACTION_SOURCE = {
  CSV: 'csv',
  MANUAL: 'manual',
} as const;

// AI provider shared parameters
export const AI_MAX_TOKENS = 200;
export const AI_TEMPERATURE = 0;

// JWT refresh token duration in milliseconds (mirrors REFRESH_TOKEN_EXPIRY = '7d')
export const REFRESH_TOKEN_MS = 7 * 24 * 60 * 60 * 1000;

// Categorization confidence values
export const CONFIDENCE = {
  RULE: 1.0,
  MANUAL: '1.000', // stored as numeric string to match DB column type
  DEFAULT: 0,
} as const;

// Auto-rule creation defaults
export const AUTO_RULE_PRIORITY = 5;
export const KEYWORD_SLICE_LENGTH = 40;

// Investment transaction action types
export const INVESTMENT_ACTION = {
  DEPOSIT: 'deposit',
  WITHDRAWAL: 'withdrawal',
  BUY: 'buy',
  SELL: 'sell',
  DIVIDEND: 'dividend',
  TRANSFER: 'transfer',
  FEE: 'fee',
} as const;
