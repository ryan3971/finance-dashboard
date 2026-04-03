import * as path from 'path';
import { transactions } from '@/db/schema';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  cleanDatabase,
  createAccount,
  type ImportSummaryResponse,
  registerAndLogin,
} from '../../testing/test-helpers';
import { createApp } from '@/app';
import { db } from '@/db';
import { eq } from 'drizzle-orm';
import request from 'supertest';

const app = createApp();

const FIXTURE = path.join(
  __dirname,
  './adapters/__fixtures__/cibc.csv'
);

const CIBC_ACCOUNT = {
  name: 'CIBC Chequing',
  type: 'chequing',
  institution: 'cibc',
} as const;

async function uploadCibc(token: string, accountId: string) {
  return request(app)
    .post('/api/v1/imports/upload')
    .set('Authorization', `Bearer ${token}`)
    .field('accountId', accountId)
    .attach('file', FIXTURE, {
      contentType: 'text/csv',
      filename: 'cibc.csv',
    });
}

beforeEach(() => cleanDatabase());

describe('CIBC import end-to-end', () => {
  it('imports all rows correctly', async () => {
    const token = await registerAndLogin(app, 'cibc-test@example.com');
    const accountId = await createAccount(app, token, CIBC_ACCOUNT);

    const res = await uploadCibc(token, accountId);

    const body = res.body as ImportSummaryResponse;
    expect(res.status).toBe(201);
    expect(body.importedCount).toBe(15);
    expect(body.duplicateCount).toBe(0);
    expect(body.errorCount).toBe(0);
  });

  it('correctly signs debit amounts as negative and credits as positive', async () => {
    const token = await registerAndLogin(app, 'cibc-test@example.com');
    const accountId = await createAccount(app, token, CIBC_ACCOUNT);

    await uploadCibc(token, accountId);

    const rows = await db
      .select({
        amount: transactions.amount,
        rawDescription: transactions.rawDescription,
      })
      .from(transactions)
      .where(eq(transactions.accountId, accountId));

    const debits = rows.filter(
      (r) => !r.rawDescription.toUpperCase().includes('PAYMENT')
    );
    const credits = rows.filter((r) =>
      r.rawDescription.toUpperCase().includes('PAYMENT')
    );

    expect(debits.length).toBeGreaterThan(0);
    expect(credits.length).toBeGreaterThan(0);
    debits.forEach((r) => expect(parseFloat(r.amount)).toBeLessThan(0));
    credits.forEach((r) => expect(parseFloat(r.amount)).toBeGreaterThan(0));
  });

  it('deduplicates on re-upload', async () => {
    const token = await registerAndLogin(app, 'cibc-test@example.com');
    const accountId = await createAccount(app, token, CIBC_ACCOUNT);

    await uploadCibc(token, accountId);

    const res = await uploadCibc(token, accountId);

    const body = res.body as ImportSummaryResponse;
    expect(body.importedCount).toBe(0);
    expect(body.duplicateCount).toBe(15);
  });
});
