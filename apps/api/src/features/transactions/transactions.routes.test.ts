import { beforeEach, describe, expect, it } from 'vitest';
import {
  cleanDatabase,
  createAccount,
  createCategory,
  createTag,
  uploadAmex,
  registerUser,
  getCategoryId,
  getFirstTransaction,
  getTransaction,
} from '@/testing/test-helpers';
import { createApp } from '@/app';
import request from 'supertest';
import { UNKNOWN_ID, MALFORMED_ID } from '@/testing/constants';
import type { RuleResponse, PaginatedResponse } from '@/testing/types';
import { accountFixture } from '@/testing/fixtures/account.fixture';
import { transactionFixture } from '@/testing/fixtures/transaction.fixture';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { transactions } from '@/db/schema';

const app = createApp();

beforeEach(() => cleanDatabase());

// ── Shared setup helpers ──────────────────────────────────────────────────────

async function setupWithImport() {
  const { accessToken } = await registerUser(app);
  const accountId = await createAccount(app, accessToken, {
    name: 'My AMEX',
    type: 'credit',
    institution: 'amex',
    currency: 'CAD',
    isCredit: true,
  });
  await uploadAmex(app, accessToken, accountId);
  return { accessToken, accountId };
}

// ── GET /api/v1/transactions ──────────────────────────────────────────────────

describe('GET /api/v1/transactions', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/v1/transactions');
    expect(res.status).toBe(401);
  });

  it('returns paginated transactions after import', async () => {
    // amex.csv has 6 rows (5 charges + 1 payment), dates 2026-03-14 to 2026-03-26
    const { accessToken } = await setupWithImport();

    const res = await request(app)
      .get('/api/v1/transactions')
      .set('Authorization', `Bearer ${accessToken}`);

    const body = res.body as PaginatedResponse<Record<string, unknown>>;
    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(6);
    expect(body.pagination.total).toBe(6);
    expect(body.pagination.page).toBe(1);
  });

  it('respects pagination limit', async () => {
    // amex.csv: 6 rows total → ceil(6/2) = 3 pages at limit=2
    const { accessToken } = await setupWithImport();

    const res = await request(app)
      .get('/api/v1/transactions?limit=2&page=1')
      .set('Authorization', `Bearer ${accessToken}`);

    const body = res.body as PaginatedResponse<Record<string, unknown>>;
    expect(body.data).toHaveLength(2);
    expect(body.pagination.totalPages).toBe(3);
  });

  it('filters by accountId', async () => {
    const { accessToken } = await setupWithImport();
    const acc2 = await createAccount(app, accessToken, {
      name: 'Other Account',
      type: 'credit',
      institution: 'cibc',
      currency: 'CAD',
      isCredit: true,
    });

    const res = await request(app)
      .get(`/api/v1/transactions?accountId=${acc2}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(
      (res.body as PaginatedResponse<Record<string, unknown>>).data
    ).toHaveLength(0);
  });

  it('filters by startDate and endDate', async () => {
    // 2026-03-14 has exactly one transaction: TIM HORTONS #412
    const { accessToken } = await setupWithImport();

    const res = await request(app)
      .get('/api/v1/transactions?startDate=2026-03-14&endDate=2026-03-14')
      .set('Authorization', `Bearer ${accessToken}`);

    const body = res.body as PaginatedResponse<{ date: string }>;
    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.date).toBe('2026-03-14');
  });

  it('returns empty array for date range with no transactions', async () => {
    const { accessToken } = await setupWithImport();

    const res = await request(app)
      .get('/api/v1/transactions?startDate=2020-01-01&endDate=2020-01-31')
      .set('Authorization', `Bearer ${accessToken}`);

    const body = res.body as PaginatedResponse<Record<string, unknown>>;
    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(0);
    expect(body.pagination.total).toBe(0);
  });

  it('filters flagged transactions', async () => {
    // With the test rule set active, only unmatched payees (e.g. SUNRISE BOUTIQUE)
    // fall through to Uncategorized and are flagged for review.
    const { accessToken } = await setupWithImport();

    const res = await request(app)
      .get('/api/v1/transactions?flagged=true')
      .set('Authorization', `Bearer ${accessToken}`);

    const body = res.body as PaginatedResponse<{ flaggedForReview: boolean }>;
    expect(res.status).toBe(200);
    expect(body.data.length).toBeGreaterThan(0); // guard against vacuous pass
    for (const tx of body.data) {
      expect(tx.flaggedForReview).toBe(true);
    }
  });

  it('filters by categoryId and verifies all returned rows match', async () => {
    const { accessToken } = await setupWithImport();

    const uncategorizedId = await getCategoryId(
      app,
      accessToken,
      'Uncategorized'
    );

    const res = await request(app)
      .get(`/api/v1/transactions?categoryId=${uncategorizedId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const body = res.body as PaginatedResponse<{ categoryId: string }>;
    expect(body.pagination.total).toBeGreaterThan(0);
    for (const tx of body.data) {
      expect(tx.categoryId).toBe(uncategorizedId);
    }
  });

  it('filters by subcategoryId and verifies all returned rows match', async () => {
    const { accessToken } = await setupWithImport();

    const parentId = await createCategory(app, accessToken, {
      name: 'Food',
      isIncome: false,
    });
    const subcategoryId = await createCategory(app, accessToken, {
      name: 'Groceries',
      parentId,
    });

    const txn = await getFirstTransaction(app, accessToken);
    await request(app)
      .patch(`/api/v1/transactions/${txn.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ categoryId: parentId, subcategoryId });

    const res = await request(app)
      .get(`/api/v1/transactions?subcategoryId=${subcategoryId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const body = res.body as PaginatedResponse<{ subcategoryId: string }>;
    expect(body.pagination.total).toBe(1);
    for (const tx of body.data) {
      expect(tx.subcategoryId).toBe(subcategoryId);
    }
  });



  it('filters by isIncome', async () => {
    // amex.csv: 1 payment (isIncome=true) + 5 charges (isIncome=false)
    // not 100% accurate since the "income" is a transfer but it will suffice for this test
    const { accessToken } = await setupWithImport();

    const incomeRes = await request(app)
      .get('/api/v1/transactions?isIncome=true')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(incomeRes.status).toBe(200);
    const incomeBody = incomeRes.body as PaginatedResponse<{ isIncome: boolean }>;
    expect(incomeBody.pagination.total).toBe(1);
    for (const tx of incomeBody.data) {
      expect(tx.isIncome).toBe(true);
    }

    const expenseRes = await request(app)
      .get('/api/v1/transactions?isIncome=false')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(expenseRes.status).toBe(200);
    const expenseBody = expenseRes.body as PaginatedResponse<{ isIncome: boolean }>;
    expect(expenseBody.pagination.total).toBe(5);
    for (const tx of expenseBody.data) {
      expect(tx.isIncome).toBe(false);
    }
  });

  it('filters by month', async () => {
    // amex.csv: all 6 transactions fall within 2026-03
    const { accessToken } = await setupWithImport();

    const marchRes = await request(app)
      .get('/api/v1/transactions?month=2026-03')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(marchRes.status).toBe(200);
    const marchBody = marchRes.body as PaginatedResponse<{ date: string }>;
    expect(marchBody.pagination.total).toBe(6);
    for (const tx of marchBody.data) {
      expect(tx.date).toMatch(/^2026-03-/);
    }

    const aprilRes = await request(app)
      .get('/api/v1/transactions?month=2026-04')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(aprilRes.status).toBe(200);
    expect(
      (aprilRes.body as PaginatedResponse<Record<string, unknown>>).pagination
        .total
    ).toBe(0);
  });

  it('filters by needWant', async () => {
    const { accessToken } = await setupWithImport();
    const txn = await getFirstTransaction(app, accessToken);
    const categoryId = await getCategoryId(app, accessToken, 'Food');

    // Assign a category and needWant so the filter has something to match
    await request(app)
      .patch(`/api/v1/transactions/${txn.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ categoryId, needWant: 'Need' });

    const needRes = await request(app)
      .get('/api/v1/transactions?needWant=Need')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(needRes.status).toBe(200);
    const needBody = needRes.body as PaginatedResponse<{ needWant: string }>;
    expect(needBody.pagination.total).toBe(1);
    expect(needBody.data[0]?.needWant).toBe('Need');

    const wantRes = await request(app)
      .get('/api/v1/transactions?needWant=Want')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(wantRes.status).toBe(200);
    expect(
      (wantRes.body as PaginatedResponse<Record<string, unknown>>).pagination
        .total
    ).toBe(0);
  });

  it('filters by isTransfer', async () => {
    const { accessToken } = await setupWithImport();
    const txn = await getFirstTransaction(app, accessToken);

    // Mark one transaction as a transfer directly — isTransfer is set by the
    // import pipeline and has no dedicated patch endpoint.
    await db
      .update(transactions)
      .set({ isTransfer: true })
      .where(eq(transactions.id, txn.id));

    const transferRes = await request(app)
      .get('/api/v1/transactions?isTransfer=true')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(transferRes.status).toBe(200);
    const transferBody = transferRes.body as PaginatedResponse<{
      isTransfer: boolean;
    }>;
    expect(transferBody.pagination.total).toBe(1);
    expect(transferBody.data[0]?.isTransfer).toBe(true);

    const nonTransferRes = await request(app)
      .get('/api/v1/transactions?isTransfer=false')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(nonTransferRes.status).toBe(200);
    expect(
      (nonTransferRes.body as PaginatedResponse<Record<string, unknown>>)
        .pagination.total
    ).toBe(5);
  });

  it('filters by tagIds', async () => {
    const { accessToken } = await setupWithImport();
    const tagId = await createTag(app, accessToken, 'Business');
    const txn = await getFirstTransaction(app, accessToken);

    await request(app)
      .post(`/api/v1/transactions/${txn.id}/tags`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ tagId });

    const taggedRes = await request(app)
      .get('/api/v1/transactions')
      .query({ tagIds: tagId })
      .set('Authorization', `Bearer ${accessToken}`);

    expect(taggedRes.status).toBe(200);
    const taggedBody = taggedRes.body as PaginatedResponse<{
      id: string;
      tags: { id: string }[];
    }>;
    expect(taggedBody.pagination.total).toBe(1);
    expect(taggedBody.data[0]?.id).toBe(txn.id);
    expect(taggedBody.data[0]?.tags.some((t) => t.id === tagId)).toBe(true);

    const unknownTagRes = await request(app)
      .get('/api/v1/transactions')
      .query({ tagIds: UNKNOWN_ID })
      .set('Authorization', `Bearer ${accessToken}`);

    expect(unknownTagRes.status).toBe(200);
    expect(
      (unknownTagRes.body as PaginatedResponse<Record<string, unknown>>)
        .pagination.total
    ).toBe(0);
  });

  it('returns 400 for a malformed subcategoryId', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .get(`/api/v1/transactions?subcategoryId=${MALFORMED_ID}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(400);
  });

  it('amounts are negative for charges', async () => {
    // 2026-03-14 has exactly one charge: TIM HORTONS #412 (CSV: 12.00 → DB: -12.00)
    const { accessToken } = await setupWithImport();

    const res = await request(app)
      .get('/api/v1/transactions?startDate=2026-03-14&endDate=2026-03-14')
      .set('Authorization', `Bearer ${accessToken}`);

    const body = res.body as PaginatedResponse<{ amount: string }>;
    expect(body.data).toHaveLength(1);
    for (const tx of body.data) {
      expect(Number(tx.amount)).toBeLessThan(0);
    }
  });

  it("does not return another user's transactions", async () => {
    const [{ accessToken: tokenA }, { accessToken: tokenB }] =
      await Promise.all([
        registerUser(app, 'a@example.com'),
        registerUser(app, 'b@example.com'),
      ]);
    const accountId = await createAccount(app, tokenA, {
      name: 'My AMEX',
      type: 'credit',
      institution: 'amex',
      currency: 'CAD',
      isCredit: true,
    });
    await uploadAmex(app, tokenA, accountId);

    const res = await request(app)
      .get('/api/v1/transactions')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(
      (res.body as PaginatedResponse<Record<string, unknown>>).data
    ).toHaveLength(0);
  });

  it('returns 400 for a malformed accountId', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .get(`/api/v1/transactions?accountId=${MALFORMED_ID}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid startDate format', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .get('/api/v1/transactions?startDate=not-a-date')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(400);
  });

  it('returns 400 for a malformed categoryId', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .get(`/api/v1/transactions?categoryId=${MALFORMED_ID}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(400);
  });
});

// ── PATCH /api/v1/transactions/:id ───────────────────────────────────────────

describe('PATCH /api/v1/transactions/:id', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .patch(`/api/v1/transactions/${UNKNOWN_ID}`)
      .send({ note: 'test' });
    expect(res.status).toBe(401);
  });

  it('categorizes a transaction and clears flaggedForReview', async () => {
    const { accessToken } = await setupWithImport();
    const txn = await getFirstTransaction(app, accessToken);
    const categoryId = await getCategoryId(app, accessToken, 'Food');

    const res = await request(app)
      .patch(`/api/v1/transactions/${txn.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ categoryId });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: txn.id,
      categoryId,
      flaggedForReview: false,
    });
  });

  it('sets a note on a transaction', async () => {
    const { accessToken } = await setupWithImport();
    const txn = await getFirstTransaction(app, accessToken);

    const res = await request(app)
      .patch(`/api/v1/transactions/${txn.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ note: 'business expense' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: txn.id, note: 'business expense' });
  });

  it('creates a categorization rule when createRule is true', async () => {
    const { accessToken } = await setupWithImport();
    const txn = await getFirstTransaction(app, accessToken);
    const categoryId = await getCategoryId(app, accessToken, 'Food');

    await request(app)
      .patch(`/api/v1/transactions/${txn.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ categoryId, createRule: true });

    const rulesRes = await request(app)
      .get('/api/v1/categorization-rules')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(rulesRes.status).toBe(200);
    const rules = rulesRes.body as RuleResponse[];
    expect(rules.some((r) => r.categoryId === categoryId)).toBe(true);
  });

  it('returns 404 for unknown id', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .patch(`/api/v1/transactions/${UNKNOWN_ID}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ note: 'test' });

    expect(res.status).toBe(404);
  });

  it("returns 404 when patching another user's transaction", async () => {
    const [{ accessToken: tokenA }, { accessToken: tokenB }] =
      await Promise.all([
        registerUser(app, 'a@example.com'),
        registerUser(app, 'b@example.com'),
      ]);
    const accountId = await createAccount(app, tokenA, {
      name: 'My AMEX',
      type: 'credit',
      institution: 'amex',
      currency: 'CAD',
      isCredit: true,
    });
    await uploadAmex(app, tokenA, accountId);
    const txn = await getFirstTransaction(app, tokenA);

    const res = await request(app)
      .patch(`/api/v1/transactions/${txn.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ note: 'hijacked' });

    expect(res.status).toBe(404);
  });

  it('returns 400 for a malformed (non-UUID) id', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .patch(`/api/v1/transactions/${MALFORMED_ID}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ note: 'test' });

    expect(res.status).toBe(400);
  });
});

// ── POST /api/v1/transactions ─────────────────────────────────────────────────

describe('POST /api/v1/transactions', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).post('/api/v1/transactions').send({
      accountId: UNKNOWN_ID,
      date: '2024-01-01',
      description: 'test',
      amount: -10,
    });
    expect(res.status).toBe(401);
  });

  it('creates a manual transaction and returns all fields', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await createAccount(app, accessToken, {
      name: 'TD Chequing',
      type: 'chequing',
      institution: 'td',
      currency: 'CAD',
      isCredit: false,
    });

    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        accountId,
        date: '2024-03-15',
        description: 'Coffee Shop',
        amount: -10,
        currency: 'CAD',
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      accountId,
      date: '2024-03-15',
      currency: 'CAD',
      isIncome: false, // derived from negative amount
      flaggedForReview: true, // no category assigned at creation
    });
  });

  it('derives isIncome from amount sign when omitted', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await createAccount(app, accessToken, {
      name: 'TD Chequing',
      type: 'chequing',
      institution: 'td',
      currency: 'CAD',
      isCredit: false,
    });

    const positiveRes = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        accountId,
        date: '2024-03-15',
        description: 'Payroll',
        amount: 3000,
      });

    const negativeRes = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        accountId,
        date: '2024-03-16',
        description: 'Groceries',
        amount: -50,
      });

    expect(positiveRes.status).toBe(201);
    expect((positiveRes.body as { isIncome: boolean }).isIncome).toBe(true);
    expect(negativeRes.status).toBe(201);
    expect((negativeRes.body as { isIncome: boolean }).isIncome).toBe(false);
  });

  it('returns 400 when required fields are missing', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ description: 'Missing accountId, date, and amount' });

    expect(res.status).toBe(400);
  });

  it('returns 400 for a malformed accountId', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        accountId: MALFORMED_ID,
        date: '2024-03-15',
        description: 'test',
        amount: -10,
      });

    expect(res.status).toBe(400);
  });

  it('returns 422 when accountId does not belong to the user', async () => {
    const [{ accessToken: tokenA }, { accessToken: tokenB }] =
      await Promise.all([
        registerUser(app, 'a@example.com'),
        registerUser(app, 'b@example.com'),
      ]);
    const accountId = await createAccount(app, tokenA, {
      name: 'TD Chequing',
      type: 'chequing',
      institution: 'td',
      currency: 'CAD',
      isCredit: false,
    });

    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        accountId,
        date: '2024-03-15',
        description: 'Unauthorized',
        amount: -10,
      });

    expect(res.status).toBe(422);
  });
});

// ── POST /api/v1/transactions/:id/tags ───────────────────────────────────────

describe('POST /api/v1/transactions/:id/tags', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post(`/api/v1/transactions/${UNKNOWN_ID}/tags`)
      .send({ tagId: UNKNOWN_ID });
    expect(res.status).toBe(401);
  });

  it('adds a tag to a transaction', async () => {
    const { accessToken } = await setupWithImport();
    const txn = await getFirstTransaction(app, accessToken);
    const tagId = await createTag(app, accessToken, 'Reimbursable');

    const res = await request(app)
      .post(`/api/v1/transactions/${txn.id}/tags`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ tagId });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ transactionId: txn.id, tagId });
  });

  it('returns 404 for unknown transaction', async () => {
    const { accessToken } = await registerUser(app);
    const tagId = await createTag(app, accessToken, 'Test');

    const res = await request(app)
      .post(`/api/v1/transactions/${UNKNOWN_ID}/tags`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ tagId });

    expect(res.status).toBe(404);
  });

  it("returns 404 when tagging another user's transaction", async () => {
    const [{ accessToken: tokenA }, { accessToken: tokenB }] =
      await Promise.all([
        registerUser(app, 'a@example.com'),
        registerUser(app, 'b@example.com'),
      ]);
    const accountId = await createAccount(app, tokenA, {
      name: 'My AMEX',
      type: 'credit',
      institution: 'amex',
      currency: 'CAD',
      isCredit: true,
    });
    await uploadAmex(app, tokenA, accountId);
    const txn = await getFirstTransaction(app, tokenA);
    const tagId = await createTag(app, tokenB, 'My Tag');

    const res = await request(app)
      .post(`/api/v1/transactions/${txn.id}/tags`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ tagId });

    expect(res.status).toBe(404);
  });

  it('returns 404 when tag does not exist', async () => {
    const { accessToken } = await setupWithImport();
    const txn = await getFirstTransaction(app, accessToken);

    const res = await request(app)
      .post(`/api/v1/transactions/${txn.id}/tags`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ tagId: UNKNOWN_ID });

    expect(res.status).toBe(404);
  });

  it('returns 400 for a malformed transaction id', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .post(`/api/v1/transactions/${MALFORMED_ID}/tags`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ tagId: UNKNOWN_ID });

    expect(res.status).toBe(400);
  });
});

// ── DELETE /api/v1/transactions/:id/tags/:tagId ───────────────────────────────

describe('DELETE /api/v1/transactions/:id/tags/:tagId', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).delete(
      `/api/v1/transactions/${UNKNOWN_ID}/tags/${UNKNOWN_ID}`
    );
    expect(res.status).toBe(401);
  });

  it('removes a tag from a transaction and returns 204', async () => {
    const { accessToken } = await setupWithImport();
    const txn = await getFirstTransaction(app, accessToken);
    const tagId = await createTag(app, accessToken, 'Reimbursable');

    await request(app)
      .post(`/api/v1/transactions/${txn.id}/tags`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ tagId });

    const res = await request(app)
      .delete(`/api/v1/transactions/${txn.id}/tags/${tagId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(204);
  });

  it('returns 404 when transaction does not exist', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .delete(`/api/v1/transactions/${UNKNOWN_ID}/tags/${UNKNOWN_ID}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 400 for a malformed transaction id', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .delete(`/api/v1/transactions/${MALFORMED_ID}/tags/${UNKNOWN_ID}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(400);
  });
});

// ── DELETE /api/v1/transactions/:id ──────────────────────────────────────────

describe('DELETE /api/v1/transactions/:id', () => {
  it('returns 401 without an auth token', async () => {
    const res = await request(app).delete(
      `/api/v1/transactions/${UNKNOWN_ID}`
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 for a malformed id', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .delete(`/api/v1/transactions/${MALFORMED_ID}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown id', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .delete(`/api/v1/transactions/${UNKNOWN_ID}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'Transaction not found' });
  });

  it('returns 404 when the transaction belongs to a different user', async () => {
    const auth = await registerUser(app);
    const account = await accountFixture(auth.user.id);
    const txn = await transactionFixture(account.id);

    const otherAuth = await registerUser(app, 'other@example.com');
    const res = await request(app)
      .delete(`/api/v1/transactions/${txn.id}`)
      .set('Authorization', `Bearer ${otherAuth.accessToken}`);
    expect(res.status).toBe(404);
  });

  it('returns 204 and removes the transaction', async () => {
    const auth = await registerUser(app);
    const account = await accountFixture(auth.user.id);
    const txn = await transactionFixture(account.id);

    const res = await request(app)
      .delete(`/api/v1/transactions/${txn.id}`)
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(res.status).toBe(204);
    const found = await getTransaction(app, auth.accessToken, txn.id);
    expect(found).toBeUndefined();
  });

  it('clears the paired transferPairId when deleting one side of a transfer pair', async () => {
    const auth = await registerUser(app);
    const accountA = await accountFixture(auth.user.id, { name: 'Chequing' });
    const accountB = await accountFixture(auth.user.id, { name: 'Savings' });
    const txnA = await transactionFixture(accountA.id, {
      isTransfer: true,
      amount: '-100.00',
    });
    const txnB = await transactionFixture(accountB.id, {
      isTransfer: true,
      amount: '100.00',
      transferPairId: txnA.id,
    });
    // Link the pair back on txnA
    await db
      .update(transactions)
      .set({ transferPairId: txnB.id })
      .where(eq(transactions.id, txnA.id));

    const res = await request(app)
      .delete(`/api/v1/transactions/${txnA.id}`)
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(res.status).toBe(204);

    const [pairRow] = await db
      .select({ transferPairId: transactions.transferPairId })
      .from(transactions)
      .where(eq(transactions.id, txnB.id));
    expect(pairRow?.transferPairId).toBeNull();
  });
});
