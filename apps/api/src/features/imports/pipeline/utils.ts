/**
 * Normalise a transaction description for storage and CompositeKey generation.
 */
export function normaliseDescription(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Build the CompositeKey used for deduplication.
 * Format: {accountId}-{YYYY-MM-DD}-{normalised-description}-{amount}
 */
export function buildCompositeKey(
  accountId: string,
  date: string,
  description: string,
  amount: number
): string {
  const normDesc = normaliseDescription(description)
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
  return `${accountId}-${date}-${normDesc}-${amount.toFixed(2)}`;
}

/**
 * Parse a date string to ISO 8601 YYYY-MM-DD.
 * Handles:
 *   - YYYY-MM-DD (passthrough)
 *   - YYYY-MM-DD 12:00:00 AM (Questrade)
 *   - DD-Mon-YY  (Amex legacy: "15-Jun-25")
 *   - DD Mon YYYY (Amex: "15 Feb 2026")
 */
export function parseDate(raw: string): string {
  const trimmed = raw.trim();

  const months: Record<string, string> = {
    Jan: '01',
    Feb: '02',
    Mar: '03',
    Apr: '04',
    May: '05',
    Jun: '06',
    Jul: '07',
    Aug: '08',
    Sep: '09',
    Oct: '10',
    Nov: '11',
    Dec: '12',
  };

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  if (/^\d{4}-\d{2}-\d{2}\s/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }

  // DD Mon YYYY  (Amex: "15 Feb 2026")
  const amexSpaceMatch = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/.exec(trimmed);
  if (amexSpaceMatch) {
    const [, day, mon, year] = amexSpaceMatch;
    const month = months[mon];
    if (!month) throw new Error(`Unrecognised month abbreviation: "${mon}"`);
    return `${year}-${month}-${day.padStart(2, '0')}`;
  }

  // DD-Mon-YY  (Amex legacy: "15-Jun-25")
  const amexDashMatch = /^(\d{2})-([A-Za-z]{3})-(\d{2})$/.exec(trimmed);
  if (amexDashMatch) {
    const [, day, mon, yr] = amexDashMatch;
    const month = months[mon];
    if (!month) throw new Error(`Unrecognised month abbreviation: "${mon}"`);
    const year = parseInt(yr, 10) >= 50 ? `19${yr}` : `20${yr}`;
    return `${year}-${month}-${day.padStart(2, '0')}`;
  }

  throw new Error(`Unrecognised date format: "${raw}"`);
}

/**
 * Parse a numeric string that may be empty (as in CIBC/TD debit/credit columns).
 * Returns 0 for empty or whitespace-only strings.
 */
export function parseAmount(raw: string | undefined): number {
  if (!raw || raw.trim() === '') return 0;
  const result = parseFloat(raw.replace(/,/g, '').trim());
  if (isNaN(result)) throw new Error(`Unrecognised amount value: "${raw}"`);
  return result;
}
