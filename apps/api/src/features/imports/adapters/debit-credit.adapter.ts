import {
  buildCompositeKey,
  normaliseDescription,
  parseAmount,
  parseDate,
} from '../pipeline/utils';
import type {
  CsvAdapter,
  RawTransaction,
  ValidationResult,
} from '@finance/shared';

/**
 * Shared base class for debit/credit CSV adapters (CIBC, TD).
 * Both formats use the same five-column structure:
 *   col[0]: date (YYYY-MM-DD)
 *   col[1]: description
 *   col[2]: debit amount (positive number, or empty)
 *   col[3]: credit amount (positive number, or empty)
 *   col[4]: institution-specific (masked card, running balance, etc.)
 */
export abstract class DebitCreditAdapter implements CsvAdapter {
  abstract readonly institution: string;
  readonly fileType = 'csv' as const;
  readonly hasHeaderRow = false;

  abstract detect(firstRow: string[]): boolean;

  validate(row: string[]): ValidationResult {
    const errors: string[] = [];
    if (!row[0]?.trim()) errors.push('Missing date');
    if (!row[1]?.trim()) errors.push('Missing description');
    if (parseAmount(row[2]) === 0 && parseAmount(row[3]) === 0)
      errors.push('Both debit and credit are empty/zero');
    return { valid: errors.length === 0, errors };
  }

  protected buildMetadata(
    _row: string[]
  ): Record<string, string> | undefined {
    return undefined;
  }

  parse(rows: string[][], accountId: string): RawTransaction[] {
    const dataRows = rows.filter((r) => r.some((c) => c.trim() !== ''));
    const results: RawTransaction[] = [];

    for (const row of dataRows) {
      if (!this.validate(row).valid) continue;

      const date = parseDate(row[0]);
      const rawDescription = row[1].trim();
      const description = normaliseDescription(rawDescription);
      const debit = parseAmount(row[2]);
      const credit = parseAmount(row[3]);
      const amount = credit > 0 ? credit : -debit;

      results.push({
        date,
        description,
        rawDescription,
        amount,
        currency: 'CAD',
        compositeKey: buildCompositeKey(
          accountId,
          date,
          rawDescription,
          amount
        ),
        metadata: this.buildMetadata(row),
      });
    }

    return results;
  }
}
