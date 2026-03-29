import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import * as path from 'path';
import { createApp } from '../app';
import { db } from '../db';
import { users, refreshTokens, accounts, imports, transactions, investmentTransactions } from '../db/schema';

const app = createApp();

const AMEX_FIXTURE = path.join(
  __dirname,
  '../services/imports/adapters/__fixtures__/amex.csv'
);

async function registerAndLogin() {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email: 'test@example.com', password: 'password123' });
  return res.body.accessToken as string;
}

async function createAccount(token: string, institution = 'amex') {
  const res = await request(app)
    .post('/api/v1/accounts')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Test Account', type: 'credit', institution, isCredit: true });
  return res.body.id as string;
}

async function uploadAmex(token: string, accountId: string) {
  return request(app)
    .post('/api/v1/imports/upload')
    .set('Authorization', `Bearer ${token}`)
    .field('accountId', accountId)
    .attach('file', AMEX_FIXTURE, 'amex.csv');
}

beforeEach(async () => {
  await db.delete(transactions);
  await db.delete(investmentTransactions);
  await db.delete(imports);
  await db.delete(accounts);
  await db.delete(refreshTokens);
  await db.delete(users);
});

describe('GET /api/v1/transactions', () => {
  it('returns paginated transactions after import', async () => {
    const token = await registerAndLogin();
    const accountId = await createAccount(token);
    await uploadAmex(token, accountId);

    const res = await request(app)
      .get('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.pagination.total).toBe(3);
    expect(res.body.pagination.page).toBe(1);
  });

  it('amounts are negative for charges', async () => {
    const token = await registerAndLogin();
    const accountId = await createAccount(token);
    await uploadAmex(token, accountId);

    const res = await request(app)
      .get('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`);

    for (const tx of res.body.data) {
      expect(Number(tx.amount)).toBeLessThan(0);
    }
  });

  it('filters by account_id', async () => {
    const token = await registerAndLogin();
    const acc1 = await createAccount(token, 'amex');
    const acc2 = await createAccount(token, 'cibc');
    await uploadAmex(token, acc1);

    const res = await request(app)
      .get(`/api/v1/transactions?account_id=${acc2}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.data).toHaveLength(0);
  });

  it('filters flagged transactions', async () => {
    const token = await registerAndLogin();
    const accountId = await createAccount(token);
    await uploadAmex(token, accountId);

    const res = await request(app)
      .get(`/api/v1/transactions?flagged=true`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    for (const tx of res.body.data) {
      expect(tx.flaggedForReview).toBe(true);
    }
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/v1/transactions');
    expect(res.status).toBe(401);
  });

  it('respects pagination limit', async () => {
    const token = await registerAndLogin();
    const accountId = await createAccount(token);
    await uploadAmex(token, accountId);

    const res = await request(app)
      .get('/api/v1/transactions?limit=2&page=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.totalPages).toBe(2);
  });
});

describe('GET /api/v1/transactions — date and category filters', () => {
  // Amex fixture dates: 2025-06-13, 2025-06-14, 2025-06-15

  it('filters by start_date and end_date', async () => {
    const token = await registerAndLogin();
    const accountId = await createAccount(token);
    await uploadAmex(token, accountId);

    const res = await request(app)
      .get('/api/v1/transactions?start_date=2025-06-14&end_date=2025-06-14')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].date).toBe('2025-06-14');
  });

  it('returns empty array for date range with no transactions', async () => {
    const token = await registerAndLogin();
    const accountId = await createAccount(token);
    await uploadAmex(token, accountId);

    const res = await request(app)
      .get('/api/v1/transactions?start_date=2020-01-01&end_date=2020-01-31')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.pagination.total).toBe(0);
  });

  it('filters by category_id', async () => {
    const token = await registerAndLogin();
    const accountId = await createAccount(token);
    await uploadAmex(token, accountId);

    const catRes = await request(app)
      .get('/api/v1/categories')
      .set('Authorization', `Bearer ${token}`);

    expect(catRes.status).toBe(200);
    const uncategorized = catRes.body.find((c: { name: string }) => c.name === 'Uncategorized');
    expect(uncategorized).toBeDefined();

    const res = await request(app)
      .get(`/api/v1/transactions?category_id=${uncategorized.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBeGreaterThan(0);
  });
});
