import { DebitCreditAdapter } from '../debit-credit.adapter';
import { ISO_DATE_REGEX } from '@/lib/constants';

export class TdAdapter extends DebitCreditAdapter {
  readonly institution = 'td';

  detect(firstRow: string[]): boolean {
    return (
      firstRow.length === 5 &&
      ISO_DATE_REGEX.test(firstRow[0]?.trim()) &&
      !firstRow[4]?.includes('****')
    );
  }
}
