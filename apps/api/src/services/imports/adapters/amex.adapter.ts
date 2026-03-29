import type { CsvAdapter, RawTransaction, ValidationResult } from '@finance/shared';
import { parseDate, parseAmount, normaliseDescription, buildCompositeKey } from '../utils';

export class AmexAdapter implements CsvAdapter {
  readonly institution = 'amex';
  readonly fileType = 'csv' as const;
  readonly hasHeaderRow = true;

  detect(firstRow: string[]): boolean {
    return (
      firstRow.length >= 4 &&
      firstRow[0].trim().toLowerCase() === 'date' &&
      firstRow[1].trim().toLowerCase() === 'date processed' &&
      firstRow[2].trim().toLowerCase() === 'description' &&
      firstRow[3].trim().toLowerCase() === 'amount'
    );
  }

  validate(row: string[]): ValidationResult {
    const errors: string[] = [];
    if (!row[0]?.trim()) errors.push('Missing date');
    if (!row[2]?.trim()) errors.push('Missing description');
    if (!row[3]?.trim()) errors.push('Missing amount');
    if (row[3] && isNaN(parseFloat(row[3]))) errors.push(`Invalid amount: "${row[3]}"`);
    return { valid: errors.length === 0, errors };
  }

  parse(rows: string[][], accountId: string): RawTransaction[] {
    const dataRows = rows.slice(1).filter(r => r.some(c => c.trim() !== ''));
    const results: RawTransaction[] = [];

    for (const row of dataRows) {
      const validation = this.validate(row);
      if (!validation.valid) continue;

      const date = parseDate(row[0]);
      const rawDescription = row[2].trim();
      const description = normaliseDescription(rawDescription);
      // Amex: positive = charge (money out) → negate
      const amount = -(parseAmount(row[3]));

      results.push({
        date,
        description,
        rawDescription,
        amount,
        currency: 'CAD',
        compositeKey: buildCompositeKey(accountId, date, rawDescription, amount),
      });
    }

    return results;
  }
}
