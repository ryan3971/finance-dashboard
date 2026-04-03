import {
  buildCompositeKey,
  parseAmount,
  parseDate,
} from '../../pipeline/utils';
import type {
  CsvAdapter,
  RawInvestmentTransaction,
  ValidationResult,
} from '@finance/shared';

const ACCOUNT_TYPE_MAP: Record<
  string,
  RawInvestmentTransaction['accountType']
> = {
  'individual tfsa': 'tfsa',
  'individual fhsa': 'fhsa',
  'individual rrsp': 'rrsp',
  individual: 'non-registered',
  margin: 'non-registered',
};

const ACTION_MAP: Record<string, RawInvestmentTransaction['action']> = {
  buy: 'buy',
  sell: 'sell',
  div: 'dividend',
  dep: 'deposit',
  wdw: 'withdrawal',
  tf6: 'transfer',
  tfe: 'transfer',
  fch: 'fee',
  rei: 'dividend',
  con: 'deposit',
};

export class QuestradeAdapter implements CsvAdapter {
  readonly institution = 'questrade';
  readonly fileType = 'csv' as const;
  readonly hasHeaderRow = true;

  detect(firstRow: string[]): boolean {
    const normalised = firstRow.map((h) => h.trim().toLowerCase());
    return (
      normalised.includes('transaction date') &&
      normalised.includes('action') &&
      normalised.includes('net amount') &&
      normalised.includes('account type')
    );
  }

  validate(row: string[]): ValidationResult {
    const errors: string[] = [];
    if (!row[0]?.trim()) errors.push('Missing transaction date');
    if (!row[11]?.trim()) errors.push('Missing account number');
    if (!row[13]?.trim()) errors.push('Missing account type');
    return { valid: errors.length === 0, errors };
  }

  parse(rows: string[][], _accountId: string): RawInvestmentTransaction[] {
    const dataRows = rows
      .slice(1)
      .filter((r) => r.some((c) => String(c).trim() !== ''));
    const results: RawInvestmentTransaction[] = [];

    for (const row of dataRows) {
      const validation = this.validate(row);
      if (!validation.valid) continue;

      const date = parseDate(String(row[0]));
      const settlementDate = row[1]?.trim()
        ? parseDate(String(row[1]))
        : undefined;
      const rawAction = String(row[2]).trim();
      const activityType = String(row[12] ?? '').trim();
      const action: RawInvestmentTransaction['action'] = rawAction
        ? (ACTION_MAP[rawAction.toLowerCase()] ?? 'transfer')
        : activityType.toLowerCase().includes('dividend')
          ? 'dividend'
          : activityType.toLowerCase().includes('deposit')
            ? 'deposit'
            : 'transfer';
      const symbol = String(row[3] ?? '').trim() || undefined;
      const rawDescription = String(row[4] ?? '').trim();
      const quantity = parseAmount(String(row[5])) || undefined;
      const price = parseAmount(String(row[6])) || undefined;
      const grossAmount = parseAmount(String(row[7]));
      const commission = parseAmount(String(row[8]));
      const netAmount = parseAmount(String(row[9]));
      const currency = String(row[10] ?? 'CAD').trim();
      const accountNumber = String(row[11]).trim();
      const rawAccountType = String(row[13] ?? '')
        .trim()
        .toLowerCase();
      const accountType = ACCOUNT_TYPE_MAP[rawAccountType] ?? 'non-registered';

      // compositeKey uses accountNumber — import service rewrites with real accountId
      const compositeKey = buildCompositeKey(
        accountNumber,
        date,
        rawDescription,
        netAmount
      );

      results.push({
        date,
        settlementDate,
        action,
        rawAction,
        symbol,
        description: rawDescription.toLowerCase(),
        rawDescription,
        quantity,
        price,
        grossAmount,
        commission,
        netAmount,
        currency,
        accountNumber,
        accountType,
        activityType,
        compositeKey,
      });
    }

    return results;
  }
}
