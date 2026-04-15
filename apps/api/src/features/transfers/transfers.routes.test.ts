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
