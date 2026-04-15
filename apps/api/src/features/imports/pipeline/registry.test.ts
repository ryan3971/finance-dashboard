import { describe, expect, it } from 'vitest';
import { AmexAdapter } from '../adapters/amex/amex.adapter';
import { CibcAdapter } from '../adapters/cibc/cibc.adapter';
import { QuestradeAdapter } from '../adapters/questrade/questrade.adapter';
import { TdAdapter } from '../adapters/td/td.adapter';
import { ADAPTERS, detectAdapter, getAdapterByInstitution } from './registry';

// Representative first-rows for each format
const QUESTRADE_HEADER = [
  'Transaction Date',
  'Settlement Date',
  'Action',
  'Symbol',
  'Description',
  'Quantity',
  'Price',
  'Gross Amount',
  'Commission',
  'Net Amount',
  'Currency',
  'Account #',
  'Activity Type',
  'Account Type',
];
const AMEX_HEADER = ['Date', 'Date Processed', 'Description', 'Amount'];
const CIBC_DATA_ROW = ['2026-02-17', 'WAREHOUSE GROCERY CO', '198.45', '', '4321****5678'];
const TD_DATA_ROW = ['2026-02-02', 'SOME MERCHANT', '28.8', '', '14878.00'];

// ---------------------------------------------------------------------------
// Individual adapter detect() — own format vs. a clearly alien format
// ---------------------------------------------------------------------------
describe('QuestradeAdapter.detect()', () => {
  const adapter = new QuestradeAdapter();

  it('returns true for Questrade header row', () => {
    expect(adapter.detect(QUESTRADE_HEADER)).toBe(true);
  });

  it('returns false for Amex header row', () => {
    expect(adapter.detect(AMEX_HEADER)).toBe(false);
  });

  it('returns false for a TD data row', () => {
    expect(adapter.detect(TD_DATA_ROW)).toBe(false);
  });
});

describe('AmexAdapter.detect()', () => {
  const adapter = new AmexAdapter();

  it('returns true for Amex header row', () => {
    expect(adapter.detect(AMEX_HEADER)).toBe(true);
  });

  it('returns false for Questrade header row', () => {
    expect(adapter.detect(QUESTRADE_HEADER)).toBe(false);
  });

  it('returns false for a CIBC data row', () => {
    expect(adapter.detect(CIBC_DATA_ROW)).toBe(false);
  });
});

describe('CibcAdapter.detect()', () => {
  const adapter = new CibcAdapter();

  it('returns true for a CIBC data row with masked card number', () => {
    expect(adapter.detect(CIBC_DATA_ROW)).toBe(true);
  });

  it('returns false for a TD data row (no masked card)', () => {
    expect(adapter.detect(TD_DATA_ROW)).toBe(false);
  });

  it('returns false for an Amex header row', () => {
    expect(adapter.detect(AMEX_HEADER)).toBe(false);
  });
});

describe('TdAdapter.detect()', () => {
  const adapter = new TdAdapter();

  it('returns true for a TD data row', () => {
    expect(adapter.detect(TD_DATA_ROW)).toBe(true);
  });

  it('returns false for a CIBC data row (has masked card)', () => {
    expect(adapter.detect(CIBC_DATA_ROW)).toBe(false);
  });

  it('returns false for an Amex header row', () => {
    expect(adapter.detect(AMEX_HEADER)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Detection ordering — header-based adapters must precede DebitCredit ones
// ---------------------------------------------------------------------------
describe('ADAPTERS ordering', () => {
  it('QuestradeAdapter appears before CibcAdapter', () => {
    const questradeIdx = ADAPTERS.findIndex((a) => a.institution === 'questrade');
    const cibcIdx = ADAPTERS.findIndex((a) => a.institution === 'cibc');
    expect(questradeIdx).toBeLessThan(cibcIdx);
  });

  it('QuestradeAdapter appears before TdAdapter', () => {
    const questradeIdx = ADAPTERS.findIndex((a) => a.institution === 'questrade');
    const tdIdx = ADAPTERS.findIndex((a) => a.institution === 'td');
    expect(questradeIdx).toBeLessThan(tdIdx);
  });

  it('AmexAdapter appears before CibcAdapter', () => {
    const amexIdx = ADAPTERS.findIndex((a) => a.institution === 'amex');
    const cibcIdx = ADAPTERS.findIndex((a) => a.institution === 'cibc');
    expect(amexIdx).toBeLessThan(cibcIdx);
  });

  it('AmexAdapter appears before TdAdapter', () => {
    const amexIdx = ADAPTERS.findIndex((a) => a.institution === 'amex');
    const tdIdx = ADAPTERS.findIndex((a) => a.institution === 'td');
    expect(amexIdx).toBeLessThan(tdIdx);
  });
});

// ---------------------------------------------------------------------------
// detectAdapter — correct adapter returned for each format
// ---------------------------------------------------------------------------
describe('detectAdapter', () => {
  it('routes a Questrade header row to the Questrade adapter', () => {
    expect(detectAdapter(QUESTRADE_HEADER)?.institution).toBe('questrade');
  });

  it('routes an Amex header row to the Amex adapter', () => {
    expect(detectAdapter(AMEX_HEADER)?.institution).toBe('amex');
  });

  it('routes a CIBC data row to the CIBC adapter', () => {
    expect(detectAdapter(CIBC_DATA_ROW)?.institution).toBe('cibc');
  });

  it('routes a TD data row to the TD adapter', () => {
    expect(detectAdapter(TD_DATA_ROW)?.institution).toBe('td');
  });

  it('returns null when no adapter recognises the row', () => {
    expect(detectAdapter(['garbage', 'row', 'data'])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getAdapterByInstitution
// ---------------------------------------------------------------------------
describe('getAdapterByInstitution', () => {
  it.each(['questrade', 'amex', 'cibc', 'td'])(
    'returns the correct adapter for "%s"',
    (institution) => {
      const adapter = getAdapterByInstitution(institution);
      expect(adapter).not.toBeNull();
      expect(adapter?.institution).toBe(institution);
    }
  );

  it('returns null for an unknown institution', () => {
    expect(getAdapterByInstitution('rbc')).toBeNull();
  });
});
