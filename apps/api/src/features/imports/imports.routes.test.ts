import * as path from 'path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  cleanDatabase,
  createAccount,
  type ImportSummaryResponse,
  type PaginatedResponse,
  registerAndLogin,
} from '../../testing/test-helpers';
import { createApp } from '@/app';
import request from 'supertest';
import { assertDefined } from '@/lib/assert';

const app = createApp();

const AMEX_FIXTURE = path.join(
  __dirname,
  './adapters/__fixtures__/amex.csv'
);

const AMEX_ACCOUNT = {
  name: 'Amex Gold',
  type: 'credit',
  institution: 'amex',
  isCredit: true,
} as const;

beforeEach(() => cleanDatabase());

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
    expect(body.importedCount).toBe(16);
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
    expect(body.duplicateCount).toBe(16);
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
    const firstTx = txBody.data[0];
    assertDefined(firstTx, 'Expected at least one transaction in response');
    expect(firstTx.categoryName).toBe('Uncategorized');
  });
});
