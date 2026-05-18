/**
 * Normalise a transaction description for storage and compositeKey generation.
 */
export function normaliseDescription(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Build the compositeKey used for investment transaction deduplication.
 * Format: {accountId}-{YYYY-MM-DD}-{normalised-description}-{amount}
 *
 * This function is the single source of truth for the compositeKey algorithm.
 * It is used by both the CSV import pipeline and the manual-entry service.
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
