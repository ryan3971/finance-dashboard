export interface RawTransaction {
  date: string;
  description: string;
  rawDescription: string;
  amount: number;
  currency: string;
  compositeKey: string;
  metadata?: Record<string, string>;
}

export interface RawInvestmentTransaction {
  date: string;
  settlementDate?: string;
  action: 'buy' | 'sell' | 'deposit' | 'withdrawal' | 'dividend' | 'transfer' | 'fee';
  rawAction: string;
  symbol?: string;
  description: string;
  rawDescription: string;
  quantity?: number;
  price?: number;
  grossAmount: number;
  commission: number;
  netAmount: number;
  currency: string;
  accountNumber: string;
  accountType: 'tfsa' | 'fhsa' | 'rrsp' | 'non-registered';
  activityType: string;
  compositeKey: string;
}

export type AdapterOutput = RawTransaction | RawInvestmentTransaction;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface CsvAdapter {
  readonly institution: string;
  readonly fileType: 'csv' | 'xlsx';
  readonly hasHeaderRow: boolean;
  detect(firstRow: string[]): boolean;
  parse(rows: string[][]): AdapterOutput[];
  validate(row: string[]): ValidationResult;
}
