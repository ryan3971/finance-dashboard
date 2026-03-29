import type { CsvAdapter, RawTransaction, ValidationResult } from '@finance/shared';
import { parseDate, parseAmount, normaliseDescription, buildCompositeKey } from '../utils';

export class TdAdapter implements CsvAdapter {
  readonly institution = 'td';
  readonly fileType = 'csv' as const;
  readonly hasHeaderRow = false;

  detect(firstRow: string[]): boolean {
    return (
      firstRow.length === 5 &&
      /^\d{4}-\d{2}-\d{2}$/.test(firstRow[0]?.trim()) &&
      !(firstRow[4]?.includes('****'))
    );
  }

  validate(row: string[]): ValidationResult {
    const errors: string[] = [];
    if (!row[0]?.trim()) errors.push('Missing date');
    if (!row[1]?.trim()) errors.push('Missing description');
    const debit = parseAmount(row[2]);
    const credit = parseAmount(row[3]);
    if (debit === 0 && credit === 0) errors.push('Both debit and credit are empty/zero');
    return { valid: errors.length === 0, errors };
  }

  parse(rows: string[][], accountId: string): RawTransaction[] {
    const dataRows = rows.filter(r => r.some(c => c.trim() !== ''));
    const results: RawTransaction[] = [];

    for (const row of dataRows) {
      const validation = this.validate(row);
      if (!validation.valid) continue;

      const date = parseDate(row[0]);
      const rawDescription = row[1].trim();
      const description = normaliseDescription(rawDescription);
      const debit = parseAmount(row[2]);
      const credit = parseAmount(row[3]);
      // col[4] is running balance — ignored
      const amount = credit > 0 ? credit : -debit;

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
