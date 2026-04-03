import { DebitCreditAdapter } from '../debit-credit.adapter';

export class TdAdapter extends DebitCreditAdapter {
  readonly institution = 'td';

  detect(firstRow: string[]): boolean {
    return (
      firstRow.length === 5 &&
      /^\d{4}-\d{2}-\d{2}$/.test(firstRow[0]?.trim()) &&
      !firstRow[4]?.includes('****')
    );
  }
}
