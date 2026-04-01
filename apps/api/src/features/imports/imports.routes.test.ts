import * as path from 'path';
import {
  accounts,
  categorizationRules,
  imports,
  investmentTransactions,
  refreshTokens,
  transactions,
  users,
} from '@/db/schema';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createAccount,
  type ImportSummaryResponse,
  type PaginatedResponse,
  registerAndLogin,
} from '../../testing/test-helpers';
import { createApp } from '@/app';
import { db } from '@/db';
import request from 'supertest';

const app = createApp();

const AMEX_FIXTURE = path.join(
  __dirname,
  '../services/imports/adapters/__fixtures__/amex.csv'
);

const AMEX_ACCOUNT = {
  name: 'Amex Gold',
  type: 'credit',
  institution: 'amex',
  isCredit: true,
} as const;

beforeEach(async () => {
  await db.delete(transactions);
  await db.delete(investmentTransactions);
  await db.delete(imports);
  await db.delete(accounts);
  await db.delete(refreshTokens);
  await db.delete(categorizationRules);
  await db.delete(users);
});

describe('POST /api/v1/imports/upload', () => {
  it('parses Amex CSV and returns import summary', async () => {
    const token = await registerAndLogin(app);
    const accountId = await createAccount(app, token, AMEX_ACCOUNT);

    const res = await request(app)
      .post('/api/v1/imports/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('accountId', accountId)
      .attach('file', AMEX_FIXTURE, 'amex.csv');

    const body = res.body as ImportSummaryResponse;
    expect(res.status).toBe(201);
    expect(body.importedCount).toBe(3);
    expect(body.duplicateCount).toBe(0);
    expect(body.errorCount).toBe(0);
  });

  it('counts duplicates on re-upload of same file', async () => {
    const token = await registerAndLogin(app);
    const accountId = await createAccount(app, token, AMEX_ACCOUNT);

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

    const body = res.body as ImportSummaryResponse;
    expect(res.status).toBe(201);
    expect(body.importedCount).toBe(0);
    expect(body.duplicateCount).toBe(3);
  });

  it('returns 400 when no file is provided', async () => {
    const token = await registerAndLogin(app);
    const accountId = await createAccount(app, token, AMEX_ACCOUNT);

    const res = await request(app)
      .post('/api/v1/imports/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('accountId', accountId);

    expect(res.status).toBe(400);
  });

  it('returns 400 when accountId is missing', async () => {
    const token = await registerAndLogin(app);

    const res = await request(app)
      .post('/api/v1/imports/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', AMEX_FIXTURE, 'amex.csv');

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    // Don't attach file — auth middleware fires before multer reads body
    const res = await request(app).post('/api/v1/imports/upload');

    expect(res.status).toBe(401);
  });

  it('assigns Uncategorized to non-matching transactions', async () => {
    const token = await registerAndLogin(app);
    const accountId = await createAccount(app, token, AMEX_ACCOUNT);

    await request(app)
      .post('/api/v1/imports/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('accountId', accountId)
      .attach('file', AMEX_FIXTURE, 'amex.csv');

    const txRes = await request(app)
      .get(`/api/v1/transactions?account_id=${accountId}&flagged=true`)
      .set('Authorization', `Bearer ${token}`);

    const txBody = txRes.body as PaginatedResponse<{ categoryName: string }>;
    expect(txBody.data.length).toBeGreaterThan(0);
    expect(txBody.data[0].categoryName).toBe('Uncategorized');
  });
});
