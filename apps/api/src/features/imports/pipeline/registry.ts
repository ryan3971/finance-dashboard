import { AmexAdapter } from '../adapters/amex/amex.adapter';
import { CibcAdapter } from '../adapters/cibc/cibc.adapter';
import type { CsvAdapter } from '@finance/shared';
import { QuestradeAdapter } from '../adapters/questrade/questrade.adapter';
import { TdAdapter } from '../adapters/td/td.adapter';

// Ordered — more specific detectors first
const ADAPTERS: CsvAdapter[] = [
  new QuestradeAdapter(), // CSV with unique header — detect() checks header content
  new AmexAdapter(), // has header row — detect() checks header content
  new CibcAdapter(), // no header, has masked card number in col[4]
  new TdAdapter(), // no header, 5 columns, no masked card
];

export function getAdapterByInstitution(
  institution: string
): CsvAdapter | null {
  return ADAPTERS.find((a) => a.institution === institution) ?? null;
}

export function detectAdapter(firstRow: string[]): CsvAdapter | null {
  return ADAPTERS.find((a) => a.detect(firstRow)) ?? null;
}

export { ADAPTERS };
