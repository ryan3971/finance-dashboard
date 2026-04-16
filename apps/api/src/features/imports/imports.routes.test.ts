import * as path from 'path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  cleanDatabase,
  createAccount,
  registerUser,
  uploadAmex,
  uploadCsv,
  type ImportSummaryResponse,
} from '../../testing/test-helpers';
import { createApp } from '@/app';
import request from 'supertest';
import { MALFORMED_ID } from '@/testing/constants';
import type { PaginatedResponse } from '@/testing/types';
import { assertDefined } from '@/lib/assert';

const app = createApp();

// ── Fixtures ──────────────────────────────────────────────────────────────────

// amex.csv — 6 data rows (1 header)
const AMEX_FIXTURE = path.join(__dirname, '../../testing/csv/amex.csv');

const AMEX_ACCOUNT = {
  name: 'Amex',
  type: 'credit',
  institution: 'amex',
  isCredit: true,
  currency: 'CAD',
} as const;

// cibc.csv — 6 rows (no header)
const CIBC_FIXTURE = path.join(__dirname, '../../testing/csv/cibc.csv');

const CIBC_ACCOUNT = {
  name: 'CIBC Chequing',
  type: 'chequing',
  institution: 'cibc',
  isCredit: false,
  currency: 'CAD',
} as const;

// td.csv — 9 rows (no header):
//   2 credits (income): PRODIGY EDUCATION INC PAYRL (+4000), GST GST TAX REFUND (+500)
//   7 debits (expenses): WALMART, PRESTO, CREDIT CARD PYMT MSP, 2× E-TRANSFER OUT,
//                        CORNER STORE, TIM HORTONS
const TD_FIXTURE = path.join(__dirname, '../../testing/csv/td.csv');

const TD_ACCOUNT = {
  name: 'TD Chequing',
  type: 'chequing',
  institution: 'td',
  isCredit: false,
  currency: 'CAD',
} as const;

async function uploadTd(
  token: string,
  accountId: string
): Promise<ImportSummaryResponse> {
  return uploadCsv(app, token, accountId, TD_FIXTURE, 'td.csv');
}

beforeEach(() => cleanDatabase());

describe('POST /api/v1/imports/upload', () => {
  // ── Auth & input validation ────────────────────────────────────────────────
  // Middleware runs before adapter detection, so one pass covers all formats.

  it('returns 401 without auth token', async () => {
    const res = await request(app).post('/api/v1/imports/upload');
    expect(res.status).toBe(401);
  });

  it('returns 400 for a malformed accountId', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/imports/upload')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('accountId', MALFORMED_ID)
      .attach('file', TD_FIXTURE, 'td.csv');

    expect(res.status).toBe(400);
  });

  it('returns 400 when no file is provided', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await createAccount(app, accessToken, TD_ACCOUNT);
    const res = await request(app)
      .post('/api/v1/imports/upload')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('accountId', accountId);

    expect(res.status).toBe(400);
  });

  it('returns 400 when accountId is missing', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/imports/upload')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', TD_FIXTURE, 'td.csv');

    expect(res.status).toBe(400);
  });

  // ── Ownership enforcement ─────────────────────────────────────────────────

  it('returns 404 when accountId belongs to another user', async () => {
    const [{ accessToken: tokenA }, { accessToken: tokenB }] =
      await Promise.all([
        registerUser(app, 'a@example.com'),
        registerUser(app, 'b@example.com'),
      ]);
    const accountId = await createAccount(app, tokenA, TD_ACCOUNT);

    const res = await request(app)
      .post('/api/v1/imports/upload')
      .set('Authorization', `Bearer ${tokenB}`)
      .field('accountId', accountId)
      .attach('file', TD_FIXTURE, 'td.csv');

    expect(res.status).toBe(404);
  });

  // ── Happy path: one end-to-end case per adapter format ────────────────────
  // Verifies adapter detection, DB insertion, and ImportResult summary shape.

  it('imports Amex CSV and returns correct summary', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await createAccount(app, accessToken, AMEX_ACCOUNT);

    const res = await request(app)
      .post('/api/v1/imports/upload')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('accountId', accountId)
      .attach('file', AMEX_FIXTURE, 'amex.csv');

    const body = res.body as ImportSummaryResponse;
    expect(res.status).toBe(201);
    expect(body.importedCount).toBe(6);
    expect(body.duplicateCount).toBe(0);
    expect(body.errorCount).toBe(0);
  });

  it('imports CIBC CSV and returns correct summary', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await createAccount(app, accessToken, CIBC_ACCOUNT);

    const res = await request(app)
      .post('/api/v1/imports/upload')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('accountId', accountId)
      .attach('file', CIBC_FIXTURE, 'cibc.csv');

    const body = res.body as ImportSummaryResponse;
    expect(res.status).toBe(201);
    expect(body.importedCount).toBe(6);
    expect(body.duplicateCount).toBe(0);
    expect(body.errorCount).toBe(0);
  });

  it('imports TD CSV and returns correct summary', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await createAccount(app, accessToken, TD_ACCOUNT);

    const res = await request(app)
      .post('/api/v1/imports/upload')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('accountId', accountId)
      .attach('file', TD_FIXTURE, 'td.csv');

    const body = res.body as ImportSummaryResponse;
    expect(res.status).toBe(201);
    expect(body.importedCount).toBe(9);
    expect(body.duplicateCount).toBe(0);
    expect(body.errorCount).toBe(0);
  });

  // ── Deduplication ─────────────────────────────────────────────────────────

  it('deduplicates on re-upload', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await createAccount(app, accessToken, TD_ACCOUNT);
    await uploadTd(accessToken, accountId);

    const summary = await uploadTd(accessToken, accountId);

    expect(summary.importedCount).toBe(0);
    expect(summary.duplicateCount).toBe(9);
  });

  // ── Categorization ────────────────────────────────────────────────────────

  it('assigns Uncategorized and flags for review when no rule matches', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await createAccount(app, accessToken, AMEX_ACCOUNT);
    await uploadAmex(app, accessToken, accountId);

    const txRes = await request(app)
      .get(`/api/v1/transactions?account_id=${accountId}&flagged=true`)
      .set('Authorization', `Bearer ${accessToken}`);

    const txBody = txRes.body as PaginatedResponse<{ categoryName: string }>;
    expect(txBody.data.length).toBeGreaterThan(0);
    const firstTx = txBody.data[0];
    assertDefined(firstTx, 'Expected at least one flagged transaction');
    expect(firstTx.categoryName).toBe('Uncategorized');
  });
});
