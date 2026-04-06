import { DebitCreditAdapter } from '../debit-credit.adapter';
import { ISO_DATE_REGEX } from '@finance/shared';

export class CibcAdapter extends DebitCreditAdapter {
  readonly institution = 'cibc';

  detect(firstRow: string[]): boolean {
    return (
      firstRow.length === 5 &&
      ISO_DATE_REGEX.test(firstRow[0]?.trim()) &&
      !!firstRow[4]?.includes('****')
    );
  }

  protected buildMetadata(row: string[]) {
    return row[4] ? { cardNumber: row[4].trim() } : undefined;
  }
}
