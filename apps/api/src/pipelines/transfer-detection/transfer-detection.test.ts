import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createApp } from '@/app';
import { db } from '@/db';
import { transactions } from '@/db/schema';
import { cleanDatabase, registerUser } from '@/testing/test-helpers';
import { accountFixture } from '@/testing/fixtures/account.fixture';
import { transactionFixture } from '@/testing/fixtures/transaction.fixture';
import { detectTransfers, negateAmount } from './transfer-detection.service';

const app = createApp();

beforeEach(() => cleanDatabase());

// ─── Shared setup ─────────────────────────────────────────────────────────────

async function setupUser() {
  const auth = await registerUser(app);
  const chequing = await accountFixture(auth.user.id, { name: 'Chequing' });
  const savings = await accountFixture(auth.user.id, { name: 'Savings' });
  return { userId: auth.user.id, chequing, savings };
}

// ── negateAmount ──────────────────────────────────────────────────────────────

describe('negateAmount', () => {
  it.each([
    ['100.00', '-100.00'],
    ['-100.00', '100.00'],
    ['1234.56', '-1234.56'],
    ['-1234.56', '1234.56'],
    // Large values that lose precision under parseFloat + toFixed:
    ['123456789.99', '-123456789.99'],
    ['-123456789.99', '123456789.99'],
    // Zero — prepend/strip the minus prefix without arithmetic:
    ['0.00', '-0.00'],
    ['-0.00', '0.00'],
  ])('negateAmount("%s") → "%s"', (input, expected) => {
    expect(negateAmount(input)).toBe(expected);
  });
});

// ── detectTransfers ───────────────────────────────────────────────────────────

describe('detectTransfers', () => {
  // ── Early exits ────────────────────────────────────────────────────────────

  it('returns an empty array when no transaction IDs are provided', async () => {
    const { userId } = await setupUser();
    const result = await detectTransfers([], userId);
    expect(result).toEqual([]);
  });

  it('returns an empty array when all provided transactions are already confirmed transfers', async () => {
    const { userId, chequing } = await setupUser();
    const txn = await transactionFixture(chequing.id, { isTransfer: true });
    const result = await detectTransfers([txn.id], userId);
    expect(result).toEqual([]);
  });

  it('returns an empty array when a transaction has no transfer keyword and no inverse amount pair', async () => {
    const { userId, chequing } = await setupUser();
    const txn = await transactionFixture(chequing.id, {
      description: 'Coffee Shop',
      amount: '-5.50',
    });
    const result = await detectTransfers([txn.id], userId);
    expect(result).toEqual([]);
  });

  // ── Description-only detection ─────────────────────────────────────────────

  it('detects a description-only keyword match as medium confidence with null matchedTransactionId', async () => {
    const { userId, chequing } = await setupUser();
    const txn = await transactionFixture(chequing.id, {
      description: 'e-transfer to John',
      amount: '-100.00',
    });

    const result = await detectTransfers([txn.id], userId);

    expect(result).toEqual([
      {
        transactionId: txn.id,
        matchedTransactionId: null,
        detectionMethod: 'description',
        confidence: 'medium',
      },
    ]);
  });

  it('matches transfer keywords case-insensitively in the transaction description', async () => {
    const { userId, chequing } = await setupUser();
    const txn = await transactionFixture(chequing.id, {
      description: 'INTERAC E-TRANSFER',
      amount: '-75.00',
    });

    const result = await detectTransfers([txn.id], userId);

    expect(result[0]?.detectionMethod).toBe('description');
    expect(result[0]?.confidence).toBe('medium');
  });

  // ── Amount-pair-only detection ─────────────────────────────────────────────

  it('detects an inverse amount pair across different accounts as low confidence', async () => {
    const { userId, chequing, savings } = await setupUser();
    const txn = await transactionFixture(chequing.id, {
      description: 'Regular Payment',
      amount: '-100.00',
      date: '2024-01-15',
    });
    const pair = await transactionFixture(savings.id, {
      description: 'Deposit',
      amount: '100.00',
      date: '2024-01-15',
    });

    const result = await detectTransfers([txn.id], userId);

    expect(result).toEqual([
      {
        transactionId: txn.id,
        matchedTransactionId: pair.id,
        detectionMethod: 'amount',
        confidence: 'low',
      },
    ]);
  });

  it('does not match an inverse amount from the same account', async () => {
    const { userId, chequing } = await setupUser();
    const txn = await transactionFixture(chequing.id, {
      description: 'Regular Payment',
      amount: '-100.00',
      date: '2024-01-15',
    });
    // Inverse amount exists but in the same account — must not produce a match
    await transactionFixture(chequing.id, {
      description: 'Deposit',
      amount: '100.00',
      date: '2024-01-15',
    });

    const result = await detectTransfers([txn.id], userId);
    expect(result).toEqual([]);
  });

  it('does not match an inverse amount outside the configured time window', async () => {
    const { userId, chequing, savings } = await setupUser();
    const txn = await transactionFixture(chequing.id, {
      description: 'Regular Payment',
      amount: '-100.00',
      date: '2024-01-15',
    });
    // 4 days later — outside the default 3-day window
    await transactionFixture(savings.id, {
      description: 'Deposit',
      amount: '100.00',
      date: '2024-01-19',
    });

    const result = await detectTransfers([txn.id], userId);
    expect(result).toEqual([]);
  });

  

  it('matches an inverse amount exactly at the time window boundary', async () => {
    const { userId, chequing, savings } = await setupUser();
    const txn = await transactionFixture(chequing.id, {
      description: 'Regular Payment',
      amount: '-100.00',
      date: '2024-01-15',
    });
    // Exactly 3 days later — on the inclusive boundary, must match
    const pair = await transactionFixture(savings.id, {
      description: 'Deposit',
      amount: '100.00',
      date: '2024-01-18',
    });

    const result = await detectTransfers([txn.id], userId);

    expect(result).toEqual([
      {
        transactionId: txn.id,
        matchedTransactionId: pair.id,
        detectionMethod: 'amount',
        confidence: 'low',
      },
    ]);
  });

  it('does not use an already-confirmed transfer as an amount pair candidate', async () => {
    const { userId, chequing, savings } = await setupUser();
    const txn = await transactionFixture(chequing.id, {
      description: 'Regular Payment',
      amount: '-100.00',
      date: '2024-01-15',
    });
    // Pre-existing transaction is already a confirmed transfer — must be excluded from pair lookup
    await transactionFixture(savings.id, {
      description: 'Confirmed Transfer',
      amount: '100.00',
      date: '2024-01-15',
      isTransfer: true,
    });

    const result = await detectTransfers([txn.id], userId);
    expect(result).toEqual([]);
  });

  // ── Combined detection ──────────────────────────────────────────────────────

  it('detects both a keyword and an amount pair match as high confidence', async () => {
    const { userId, chequing, savings } = await setupUser();
    const txn = await transactionFixture(chequing.id, {
      description: 'interac e-transfer to savings',
      amount: '-250.00',
      date: '2024-01-15',
    });
    const pair = await transactionFixture(savings.id, {
      description: 'Incoming funds',
      amount: '250.00',
      date: '2024-01-15',
    });

    const result = await detectTransfers([txn.id], userId);

    expect(result).toEqual([
      {
        transactionId: txn.id,
        matchedTransactionId: pair.id,
        detectionMethod: 'both',
        confidence: 'high',
      },
    ]);
  });

  // ── User scoping ────────────────────────────────────────────────────────────

  it('does not match inverse amounts belonging to a different user', async () => {
    const auth1 = await registerUser(app, 'user1@example.com');
    const auth2 = await registerUser(app, 'user2@example.com');
    const account1 = await accountFixture(auth1.user.id);
    const account2 = await accountFixture(auth2.user.id);

    const txn = await transactionFixture(account1.id, {
      description: 'Regular Payment',
      amount: '-100.00',
      date: '2024-01-15',
    });
    // User 2's transaction has the exact inverse amount on the same date
    await transactionFixture(account2.id, {
      description: 'Deposit',
      amount: '100.00',
      date: '2024-01-15',
    });

    const result = await detectTransfers([txn.id], auth1.user.id);
    expect(result).toEqual([]);
  });

  // ── DB side effects ─────────────────────────────────────────────────────────

  it('sets flaggedForReview to true on all detected candidates', async () => {
    const { userId, chequing } = await setupUser();
    const txn = await transactionFixture(chequing.id, {
      description: 'e-transfer to savings',
      amount: '-500.00',
      flaggedForReview: false,
    });

    await detectTransfers([txn.id], userId);

    const [row] = await db
      .select({ flaggedForReview: transactions.flaggedForReview })
      .from(transactions)
      .where(eq(transactions.id, txn.id));
    expect(row?.flaggedForReview).toBe(true);
  });

  it('does not flag non-candidate transactions included in the same call', async () => {
    const { userId, chequing } = await setupUser();
    const nonCandidate = await transactionFixture(chequing.id, {
      description: 'Grocery Store',
      amount: '-30.00',
      flaggedForReview: false,
    });
    const candidate = await transactionFixture(chequing.id, {
      description: 'e-transfer payment',
      amount: '-100.00',
      flaggedForReview: false,
    });

    await detectTransfers([nonCandidate.id, candidate.id], userId);

    const [row] = await db
      .select({ flaggedForReview: transactions.flaggedForReview })
      .from(transactions)
      .where(eq(transactions.id, nonCandidate.id));
    expect(row?.flaggedForReview).toBe(false);
  });
});
