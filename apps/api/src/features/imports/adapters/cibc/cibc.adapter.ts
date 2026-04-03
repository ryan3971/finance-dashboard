import { DebitCreditAdapter } from '../debit-credit.adapter';

export class CibcAdapter extends DebitCreditAdapter {
  readonly institution = 'cibc';

  detect(firstRow: string[]): boolean {
    return (
      firstRow.length === 5 &&
      /^\d{4}-\d{2}-\d{2}$/.test(firstRow[0]?.trim()) &&
      !!firstRow[4]?.includes('****')
    );
  }

  protected buildMetadata(row: string[]) {
    return row[4] ? { cardNumber: row[4].trim() } : undefined;
  }
}
