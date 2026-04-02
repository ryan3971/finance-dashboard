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

beforeEach(async () => {
  await db.delete(transactions);
  await db.delete(investmentTransactions);
  await db.delete(imports);
  await db.delete(accounts);
  await db.delete(refreshTokens);
  await db.delete(categorizationRules);
  await db.delete(users);
});

describe('TD import end-to-end', () => {
  it('imports all rows correctly', async () => {
    const token = await registerAndLogin(app, 'td-test@example.com');
    const accountId = await createAccount(app, token, TD_ACCOUNT);

    const res = await uploadTd(token, accountId);

    const body = res.body as ImportSummaryResponse;
    expect(res.status).toBe(201);
    expect(body.importedCount).toBe(5);
    expect(body.duplicateCount).toBe(0);
  });

  it('correctly identifies income (PRODIGY) as positive', async () => {
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

    const prodigy = rows.find((r) => r.rawDescription.includes('PRODIGY'));
    expect(prodigy).toBeDefined();
    expect(parseFloat(prodigy!.amount)).toBeCloseTo(2549.81);
  });

  it('correctly identifies fees as negative', async () => {
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

    const fee = rows.find((r) => r.rawDescription.includes('ACCOUNT FEE'));
    expect(fee).toBeDefined();
    expect(parseFloat(fee!.amount)).toBeCloseTo(-11.95);
  });
});
