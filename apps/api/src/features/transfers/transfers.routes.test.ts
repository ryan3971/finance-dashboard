import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createApp } from '@/app';
import request from 'supertest';
import {
  cleanDatabase,
  registerUser,
  getTransaction,
} from '@/testing/test-helpers';
import { db } from '@/db';
import { transactions } from '@/db/schema';
import { accountFixture } from '@/testing/fixtures/account.fixture';
import { transactionFixture } from '@/testing/fixtures/transaction.fixture';
import { UNKNOWN_ID, MALFORMED_ID } from '@/testing/constants';

const app = createApp();

beforeEach(() => cleanDatabase());

// ─── Shared setup ─────────────────────────────────────────────────────────────

async function setupWithFlaggedPair() {
  const auth = await registerUser(app);
  const { accessToken } = auth;
  const userId = auth.user.id;
  const accountA = await accountFixture(userId, { name: 'Chequing' });
  const accountB = await accountFixture(userId, { name: 'Savings' });
  const txnA = await transactionFixture(accountA.id, {
    amount: '-100.00',
    flaggedForReview: true,
  });
  const txnB = await transactionFixture(accountB.id, {
    amount: '100.00',
    flaggedForReview: true,
  });
  return { accessToken, txnA, txnB };
}

// ── POST /api/v1/transfers/confirm ────────────────────────────────────────────

describe('POST /api/v1/transfers/confirm', () => {
  it('returns 401 without an auth token', async () => {
    const res = await request(app)
      .post('/api/v1/transfers/confirm')
      .send({ transactionId: UNKNOWN_ID });
    expect(res.status).toBe(401);
  });

  it('returns 400 for a malformed transactionId', async () => {
    const { accessToken } = await setupWithFlaggedPair();
    const res = await request(app)
      .post('/api/v1/transfers/confirm')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ transactionId: MALFORMED_ID });
    expect(res.status).toBe(400);
  });

  it('returns 400 for a malformed pairedTransactionId', async () => {
    const { accessToken, txnA } = await setupWithFlaggedPair();
    const res = await request(app)
      .post('/api/v1/transfers/confirm')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ transactionId: txnA.id, pairedTransactionId: MALFORMED_ID });
    expect(res.status).toBe(400);
  });

  it('returns 400 when transactionId is missing from the body', async () => {
    const { accessToken } = await setupWithFlaggedPair();
    const res = await request(app)
      .post('/api/v1/transfers/confirm')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when transactionId and pairedTransactionId are the same', async () => {
    const { accessToken, txnA } = await setupWithFlaggedPair();
    const res = await request(app)
      .post('/api/v1/transfers/confirm')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ transactionId: txnA.id, pairedTransactionId: txnA.id });
    expect(res.status).toBe(400);
  });

  it('returns 404 when transactionId does not exist', async () => {
    const { accessToken } = await setupWithFlaggedPair();
    const res = await request(app)
      .post('/api/v1/transfers/confirm')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ transactionId: UNKNOWN_ID });
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'Transaction not found' });
  });

  it('returns 404 when pairedTransactionId does not exist', async () => {
    const { accessToken, txnA } = await setupWithFlaggedPair();
    const res = await request(app)
      .post('/api/v1/transfers/confirm')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ transactionId: txnA.id, pairedTransactionId: UNKNOWN_ID });
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'Paired transaction not found' });
  });

  it('returns 409 when the transaction is already a confirmed transfer', async () => {
    const auth = await registerUser(app);
    const account = await accountFixture(auth.user.id);
    const txn = await transactionFixture(account.id, { isTransfer: true });
    const res = await request(app)
      .post('/api/v1/transfers/confirm')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ transactionId: txn.id });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      error: 'Transaction is already confirmed as a transfer',
    });
  });

  it('returns 409 when the paired transaction is already a confirmed transfer', async () => {
    const auth = await registerUser(app);
    const accountA = await accountFixture(auth.user.id);
    const accountB = await accountFixture(auth.user.id);
    const freshA = await transactionFixture(accountA.id, {
      flaggedForReview: true,
    });
    const freshB = await transactionFixture(accountB.id, { isTransfer: true });

    const res = await request(app)
      .post('/api/v1/transfers/confirm')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ transactionId: freshA.id, pairedTransactionId: freshB.id });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      error: 'Transaction is already confirmed as a transfer',
    });
  });

  it('returns 204 and marks the transaction as a transfer when no pair is provided', async () => {
    const { accessToken, txnA } = await setupWithFlaggedPair();
    const res = await request(app)
      .post('/api/v1/transfers/confirm')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ transactionId: txnA.id });

    expect(res.status).toBe(204);

    const updated = await getTransaction(app, accessToken, txnA.id);
    expect(updated?.isTransfer).toBe(true);
    expect(updated?.flaggedForReview).toBe(false);
  });

  it('returns 204 and marks both transactions as transfers when a pair is provided', async () => {
    const { accessToken, txnA, txnB } = await setupWithFlaggedPair();
    const res = await request(app)
      .post('/api/v1/transfers/confirm')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ transactionId: txnA.id, pairedTransactionId: txnB.id });

    expect(res.status).toBe(204);

    const [updatedA, updatedB] = await Promise.all([
      getTransaction(app, accessToken, txnA.id),
      getTransaction(app, accessToken, txnB.id),
    ]);
    expect(updatedA?.isTransfer).toBe(true);
    expect(updatedA?.flaggedForReview).toBe(false);
    expect(updatedB?.isTransfer).toBe(true);
    expect(updatedB?.flaggedForReview).toBe(false);

    const [[rowA], [rowB]] = await Promise.all([
      db
        .select({ transferPairId: transactions.transferPairId })
        .from(transactions)
        .where(eq(transactions.id, txnA.id)),
      db
        .select({ transferPairId: transactions.transferPairId })
        .from(transactions)
        .where(eq(transactions.id, txnB.id)),
    ]);
    expect(rowA?.transferPairId).toBe(txnB.id);
    expect(rowB?.transferPairId).toBe(txnA.id);
  });

  it('returns 404 when the transaction belongs to a different user', async () => {
    const { txnA } = await setupWithFlaggedPair();
    const otherAuth = await registerUser(app, 'other@example.com');
    const res = await request(app)
      .post('/api/v1/transfers/confirm')
      .set('Authorization', `Bearer ${otherAuth.accessToken}`)
      .send({ transactionId: txnA.id });
    expect(res.status).toBe(404);
  });

  it('returns 404 when pairedTransactionId belongs to a different user', async () => {
    const { accessToken, txnA } = await setupWithFlaggedPair();
    const otherAuth = await registerUser(app, 'other@example.com');
    const otherAccount = await accountFixture(otherAuth.user.id);
    const otherTxn = await transactionFixture(otherAccount.id, {
      amount: '100.00',
      flaggedForReview: true,
    });

    const res = await request(app)
      .post('/api/v1/transfers/confirm')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ transactionId: txnA.id, pairedTransactionId: otherTxn.id });

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'Paired transaction not found' });
  });
});

// ── POST /api/v1/transfers/dismiss ────────────────────────────────────────────

describe('POST /api/v1/transfers/dismiss', () => {
  it('returns 401 without an auth token', async () => {
    const res = await request(app)
      .post('/api/v1/transfers/dismiss')
      .send({ transactionId: UNKNOWN_ID });
    expect(res.status).toBe(401);
  });

  it('returns 400 for a malformed transactionId', async () => {
    const { accessToken } = await setupWithFlaggedPair();
    const res = await request(app)
      .post('/api/v1/transfers/dismiss')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ transactionId: MALFORMED_ID });
    expect(res.status).toBe(400);
  });

  it('returns 400 when transactionId is missing from the body', async () => {
    const { accessToken } = await setupWithFlaggedPair();
    const res = await request(app)
      .post('/api/v1/transfers/dismiss')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 when transactionId does not exist', async () => {
    const { accessToken } = await setupWithFlaggedPair();
    const res = await request(app)
      .post('/api/v1/transfers/dismiss')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ transactionId: UNKNOWN_ID });
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'Transaction not found' });
  });

  it('returns 204 and clears flaggedForReview without marking the transaction as a transfer', async () => {
    const { accessToken, txnA } = await setupWithFlaggedPair();
    const res = await request(app)
      .post('/api/v1/transfers/dismiss')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ transactionId: txnA.id });

    expect(res.status).toBe(204);

    const updated = await getTransaction(app, accessToken, txnA.id);
    expect(updated?.flaggedForReview).toBe(false);
    expect(updated?.isTransfer).toBe(false);
  });

  it('returns 204 and also clears flaggedForReview on the paired transaction', async () => {
    const auth = await registerUser(app);
    const accountA = await accountFixture(auth.user.id, { name: 'Chequing' });
    const accountB = await accountFixture(auth.user.id, { name: 'Savings' });
    const txnA = await transactionFixture(accountA.id, {
      amount: '-100.00',
      flaggedForReview: true,
    });
    const txnB = await transactionFixture(accountB.id, {
      amount: '100.00',
      flaggedForReview: true,
    });
    // Link the pair bidirectionally as detectTransfers would
    await db
      .update(transactions)
      .set({ transferMatchId: txnB.id })
      .where(eq(transactions.id, txnA.id));
    await db
      .update(transactions)
      .set({ transferMatchId: txnA.id })
      .where(eq(transactions.id, txnB.id));

    const res = await request(app)
      .post('/api/v1/transfers/dismiss')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ transactionId: txnA.id });

    expect(res.status).toBe(204);

    const [updatedA, updatedB] = await Promise.all([
      getTransaction(app, auth.accessToken, txnA.id),
      getTransaction(app, auth.accessToken, txnB.id),
    ]);
    expect(updatedA?.flaggedForReview).toBe(false);
    expect(updatedB?.flaggedForReview).toBe(false);
  });

  it('returns 204 and leaves isTransfer unchanged when dismissing an already-confirmed transfer', async () => {
    const auth = await registerUser(app);
    const account = await accountFixture(auth.user.id);
    const txn = await transactionFixture(account.id, {
      isTransfer: true,
      flaggedForReview: false,
    });

    const res = await request(app)
      .post('/api/v1/transfers/dismiss')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ transactionId: txn.id });

    expect(res.status).toBe(204);
    const updated = await getTransaction(app, auth.accessToken, txn.id);
    expect(updated?.isTransfer).toBe(true);
  });

  it('returns 404 when the transaction belongs to a different user', async () => {
    const { txnA } = await setupWithFlaggedPair();
    const otherAuth = await registerUser(app, 'other@example.com');
    const res = await request(app)
      .post('/api/v1/transfers/dismiss')
      .set('Authorization', `Bearer ${otherAuth.accessToken}`)
      .send({ transactionId: txnA.id });
    expect(res.status).toBe(404);
  });
});

// ── POST /api/v1/transfers/detect-all ────────────────────────────────────────

describe('POST /api/v1/transfers/detect-all', () => {
  it('returns 401 without an auth token', async () => {
    const res = await request(app).post('/api/v1/transfers/detect-all');
    expect(res.status).toBe(401);
  });

  it('returns { matched: 0 } when the user has no transactions', async () => {
    const auth = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/transfers/detect-all')
      .set('Authorization', `Bearer ${auth.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ matched: 0 });
  });

  it('returns { matched: 0 } when no transfer pairs can be found', async () => {
    const auth = await registerUser(app);
    const account = await accountFixture(auth.user.id);
    await transactionFixture(account.id, { amount: '-50.00' });
    await transactionFixture(account.id, { amount: '-75.00' });

    const res = await request(app)
      .post('/api/v1/transfers/detect-all')
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ matched: 0 });
  });

  it('returns { matched: 1 } and flags both transactions when a pair is detected', async () => {
    const auth = await registerUser(app);
    const accountA = await accountFixture(auth.user.id, { name: 'Chequing' });
    const accountB = await accountFixture(auth.user.id, { name: 'Savings' });
    const txnA = await transactionFixture(accountA.id, {
      description: 'e-transfer to savings',
      amount: '-200.00',
      date: '2024-03-01',
    });
    const txnB = await transactionFixture(accountB.id, {
      description: 'e-transfer from chequing',
      amount: '200.00',
      date: '2024-03-01',
    });

    const res = await request(app)
      .post('/api/v1/transfers/detect-all')
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ matched: 1 });

    interface TxnWithMatch { flaggedForReview: boolean; transferMatchId: string | null }
    const [rawA, rawB] = await Promise.all([
      getTransaction(app, auth.accessToken, txnA.id),
      getTransaction(app, auth.accessToken, txnB.id),
    ]);
    const updatedA = rawA as unknown as TxnWithMatch;
    const updatedB = rawB as unknown as TxnWithMatch;
    expect(updatedA?.flaggedForReview).toBe(true);
    expect(updatedA?.transferMatchId).toBe(txnB.id);
    expect(updatedB?.flaggedForReview).toBe(true);
    expect(updatedB?.transferMatchId).toBe(txnA.id);
  });

  it('does not match transactions belonging to a different user', async () => {
    const authA = await registerUser(app);
    const authB = await registerUser(app, 'other@example.com');
    const acctA = await accountFixture(authA.user.id);
    const acctB = await accountFixture(authB.user.id);
    await transactionFixture(acctA.id, { description: 'e-transfer', amount: '-100.00', date: '2024-03-01' });
    await transactionFixture(acctB.id, { description: 'e-transfer', amount: '100.00', date: '2024-03-01' });

    const res = await request(app)
      .post('/api/v1/transfers/detect-all')
      .set('Authorization', `Bearer ${authA.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ matched: 0 });
  });

  it('returns { matched: 0 } on a second run when all pairs are already flagged', async () => {
    const auth = await registerUser(app);
    const accountA = await accountFixture(auth.user.id, { name: 'Chequing' });
    const accountB = await accountFixture(auth.user.id, { name: 'Savings' });
    await transactionFixture(accountA.id, {
      description: 'e-transfer to savings',
      amount: '-400.00',
      date: '2024-03-01',
    });
    await transactionFixture(accountB.id, {
      description: 'e-transfer from chequing',
      amount: '400.00',
      date: '2024-03-01',
    });

    // First run — should detect one pair
    const first = await request(app)
      .post('/api/v1/transfers/detect-all')
      .set('Authorization', `Bearer ${auth.accessToken}`);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ matched: 1 });

    // Second run — both transactions are now flaggedForReview, so they are excluded
    const second = await request(app)
      .post('/api/v1/transfers/detect-all')
      .set('Authorization', `Bearer ${auth.accessToken}`);
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({ matched: 0 });
  });

  it('skips transactions already confirmed as transfers', async () => {
    const auth = await registerUser(app);
    const accountA = await accountFixture(auth.user.id, { name: 'Chequing' });
    const accountB = await accountFixture(auth.user.id, { name: 'Savings' });
    await transactionFixture(accountA.id, {
      description: 'e-transfer',
      amount: '-300.00',
      date: '2024-03-01',
      isTransfer: true,
    });
    await transactionFixture(accountB.id, {
      description: 'e-transfer',
      amount: '300.00',
      date: '2024-03-01',
      isTransfer: true,
    });

    const res = await request(app)
      .post('/api/v1/transfers/detect-all')
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ matched: 0 });
  });
});

// ── POST /api/v1/transfers/unmark ─────────────────────────────────────────────

describe('POST /api/v1/transfers/unmark', () => {
  it('returns 401 without an auth token', async () => {
    const res = await request(app)
      .post('/api/v1/transfers/unmark')
      .send({ transactionId: UNKNOWN_ID });
    expect(res.status).toBe(401);
  });

  it('returns 400 for a malformed transactionId', async () => {
    const { accessToken } = await setupWithFlaggedPair();
    const res = await request(app)
      .post('/api/v1/transfers/unmark')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ transactionId: MALFORMED_ID });
    expect(res.status).toBe(400);
  });

  it('returns 400 when transactionId is missing from the body', async () => {
    const { accessToken } = await setupWithFlaggedPair();
    const res = await request(app)
      .post('/api/v1/transfers/unmark')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 when the transaction does not exist', async () => {
    const { accessToken } = await setupWithFlaggedPair();
    const res = await request(app)
      .post('/api/v1/transfers/unmark')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ transactionId: UNKNOWN_ID });
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'Transaction not found' });
  });

  it('returns 404 when the transaction belongs to a different user', async () => {
    const auth = await registerUser(app);
    const account = await accountFixture(auth.user.id);
    const txn = await transactionFixture(account.id, { isTransfer: true });

    const otherAuth = await registerUser(app, 'other@example.com');
    const res = await request(app)
      .post('/api/v1/transfers/unmark')
      .set('Authorization', `Bearer ${otherAuth.accessToken}`)
      .send({ transactionId: txn.id });
    expect(res.status).toBe(404);
  });

  it('returns 204 and clears isTransfer on a solo transfer', async () => {
    const auth = await registerUser(app);
    const account = await accountFixture(auth.user.id);
    const txn = await transactionFixture(account.id, { isTransfer: true });

    const res = await request(app)
      .post('/api/v1/transfers/unmark')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ transactionId: txn.id });

    expect(res.status).toBe(204);
    const updated = await getTransaction(app, auth.accessToken, txn.id);
    expect(updated?.isTransfer).toBe(false);
  });

  it('returns 204 and clears isTransfer and transferPairId on both sides of a pair', async () => {
    const auth = await registerUser(app);
    const accountA = await accountFixture(auth.user.id, { name: 'Chequing' });
    const accountB = await accountFixture(auth.user.id, { name: 'Savings' });
    const txnA = await transactionFixture(accountA.id, {
      amount: '-100.00',
      isTransfer: true,
    });
    const txnB = await transactionFixture(accountB.id, {
      amount: '100.00',
      isTransfer: true,
      transferPairId: txnA.id,
    });
    await db
      .update(transactions)
      .set({ transferPairId: txnB.id })
      .where(eq(transactions.id, txnA.id));

    const res = await request(app)
      .post('/api/v1/transfers/unmark')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ transactionId: txnA.id });

    expect(res.status).toBe(204);

    const [[rowA], [rowB]] = await Promise.all([
      db
        .select({ isTransfer: transactions.isTransfer, transferPairId: transactions.transferPairId })
        .from(transactions)
        .where(eq(transactions.id, txnA.id)),
      db
        .select({ isTransfer: transactions.isTransfer, transferPairId: transactions.transferPairId })
        .from(transactions)
        .where(eq(transactions.id, txnB.id)),
    ]);
    expect(rowA?.isTransfer).toBe(false);
    expect(rowA?.transferPairId).toBeNull();
    expect(rowB?.isTransfer).toBe(false);
    expect(rowB?.transferPairId).toBeNull();
  });
});
