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
  './adapters/__fixtures__/td.csv'
);

const TD_ACCOUNT = {
  name: 'TD Chequing',
  type: 'chequing',
  institution: 'td',
} as const;

async function uploadTd(token: string, accountId: string) {
  return request(app)
    .post('/api/v1/imports/upload')
    .set('Authorization', `Bearer ${token}`)
    .field('accountId', accountId)
    .attach('file', FIXTURE, {
      contentType: 'text/csv',
      filename: 'td.csv',
    });
}

beforeEach(() => cleanDatabase());

describe('TD import end-to-end', () => {
  it('imports all rows correctly', async () => {
    const token = await registerAndLogin(app, 'td-test@example.com');
    const accountId = await createAccount(app, token, TD_ACCOUNT);

    const res = await uploadTd(token, accountId);

    const body = res.body as ImportSummaryResponse;
    expect(res.status).toBe(201);
    expect(body.importedCount).toBe(15);
    expect(body.duplicateCount).toBe(0);
  });

  it('correctly identifies employment insurance deposit as positive', async () => {
    const token = await registerAndLogin(app, 'td-test@example.com');
    const accountId = await createAccount(app, token, TD_ACCOUNT);

    await uploadTd(token, accountId);

    const rows = await db
      .select({
        amount: transactions.amount,
        rawDescription: transactions.rawDescription,
      })
      .from(transactions)
      .where(eq(transactions.accountId, accountId));

    const income = rows.find((r) =>
      r.rawDescription.includes('EMPLOYMENT INS DEP')
    );
    expect(income).toBeDefined();
    expect(parseFloat(income!.amount)).toBeCloseTo(2616);
  });

  it('correctly identifies bill payments as negative', async () => {
    const token = await registerAndLogin(app, 'td-test@example.com');
    const accountId = await createAccount(app, token, TD_ACCOUNT);

    await uploadTd(token, accountId);

    const rows = await db
      .select({
        amount: transactions.amount,
        rawDescription: transactions.rawDescription,
      })
      .from(transactions)
      .where(eq(transactions.accountId, accountId));

    const payment = rows.find((r) =>
      r.rawDescription.includes('CREDIT CARD PYMT')
    );
    expect(payment).toBeDefined();
    expect(parseFloat(payment!.amount)).toBeLessThan(0);
  });
});
