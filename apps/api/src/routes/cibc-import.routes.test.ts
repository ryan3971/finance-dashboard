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
import { createApp } from '@/app';
import { db } from '@/db';
import { eq } from 'drizzle-orm';
import request from 'supertest';

const app = createApp();

const FIXTURE = path.join(
  __dirname,
  '../services/imports/adapters/__fixtures__/cibc.csv'
);

async function registerAndLogin() {
  const res = await request(app).post('/api/v1/auth/register').send({
    email: 'cibc-test@example.com',
    password: 'password123',
  });
  return res.body.accessToken as string;
}

async function createAccount(token: string) {
  const res = await request(app)
    .post('/api/v1/accounts')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'CIBC Chequing',
      type: 'chequing',
      institution: 'cibc',
    });
  return res.body.id as string;
}

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

beforeEach(async () => {
  await db.delete(transactions);
  await db.delete(investmentTransactions);
  await db.delete(imports);
  await db.delete(accounts);
  await db.delete(refreshTokens);
  await db.delete(categorizationRules);
  await db.delete(users);
});

describe('CIBC import end-to-end', () => {
  it('imports all rows correctly', async () => {
    const token = await registerAndLogin();
    const accountId = await createAccount(token);

    const res = await uploadCibc(token, accountId);

    expect(res.status).toBe(201);
    expect(res.body.importedCount).toBe(4);
    expect(res.body.duplicateCount).toBe(0);
    expect(res.body.errorCount).toBe(0);
  });

  it('correctly signs debit amounts as negative and credits as positive', async () => {
    const token = await registerAndLogin();
    const accountId = await createAccount(token);

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
    const token = await registerAndLogin();
    const accountId = await createAccount(token);

    await uploadCibc(token, accountId);

    const res = await uploadCibc(token, accountId);

    expect(res.body.importedCount).toBe(0);
    expect(res.body.duplicateCount).toBe(4);
  });
});
