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

async function createAccount(token: string) {
  const res = await request(app)
    .post('/api/v1/accounts')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Amex Gold', type: 'credit', institution: 'amex', isCredit: true });
  return res.body.id as string;
}

beforeEach(async () => {
  await db.delete(transactions);
  await db.delete(investmentTransactions);
  await db.delete(imports);
  await db.delete(accounts);
  await db.delete(refreshTokens);
  await db.delete(users);
});

describe('POST /api/v1/imports/upload', () => {
  it('parses Amex CSV and returns import summary', async () => {
    const token = await registerAndLogin();
    const accountId = await createAccount(token);

    const res = await request(app)
      .post('/api/v1/imports/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('accountId', accountId)
      .attach('file', AMEX_FIXTURE, 'amex.csv');

    expect(res.status).toBe(201);
    expect(res.body.importedCount).toBe(3);
    expect(res.body.duplicateCount).toBe(0);
    expect(res.body.errorCount).toBe(0);
  });

  it('counts duplicates on re-upload of same file', async () => {
    const token = await registerAndLogin();
    const accountId = await createAccount(token);

    await request(app)
      .post('/api/v1/imports/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('accountId', accountId)
      .attach('file', AMEX_FIXTURE, 'amex.csv');

    const res = await request(app)
      .post('/api/v1/imports/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('accountId', accountId)
      .attach('file', AMEX_FIXTURE, 'amex.csv');

    expect(res.status).toBe(201);
    expect(res.body.importedCount).toBe(0);
    expect(res.body.duplicateCount).toBe(3);
  });

  it('returns 400 when no file is provided', async () => {
    const token = await registerAndLogin();
    const accountId = await createAccount(token);

    const res = await request(app)
      .post('/api/v1/imports/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('accountId', accountId);

    expect(res.status).toBe(400);
  });

  it('returns 400 when accountId is missing', async () => {
    const token = await registerAndLogin();

    const res = await request(app)
      .post('/api/v1/imports/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', AMEX_FIXTURE, 'amex.csv');

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    // Don't attach file — auth middleware fires before multer reads body
    const res = await request(app)
      .post('/api/v1/imports/upload');

    expect(res.status).toBe(401);
  });

  it('assigns Uncategorized to non-matching transactions', async () => {
    const token = await registerAndLogin();
    const accountId = await createAccount(token);

    await request(app)
      .post('/api/v1/imports/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('accountId', accountId)
      .attach('file', AMEX_FIXTURE, 'amex.csv');

    const txRes = await request(app)
      .get(`/api/v1/transactions?account_id=${accountId}&flagged=true`)
      .set('Authorization', `Bearer ${token}`);

    expect(txRes.body.data.length).toBeGreaterThan(0);
    expect(txRes.body.data[0].categoryName).toBe('Uncategorized');
  });
});
