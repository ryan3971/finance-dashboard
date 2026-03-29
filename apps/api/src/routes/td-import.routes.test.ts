import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import * as path from 'path';
import { createApp } from '../app';
import { db } from '../db';
import { users, refreshTokens, accounts, imports, transactions, investmentTransactions } from '../db/schema';
import { eq } from 'drizzle-orm';

const app = createApp();

const FIXTURE = path.join(
  __dirname,
  '../services/imports/adapters/__fixtures__/td.csv'
);

async function registerAndLogin() {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email: 'td-test@example.com', password: 'password123' });
  return res.body.accessToken as string;
}

async function createAccount(token: string) {
  const res = await request(app)
    .post('/api/v1/accounts')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'TD Chequing', type: 'chequing', institution: 'td' });
  return res.body.id as string;
}

async function uploadTd(token: string, accountId: string) {
  return request(app)
    .post('/api/v1/imports/upload')
    .set('Authorization', `Bearer ${token}`)
    .field('accountId', accountId)
    .attach('file', FIXTURE, { contentType: 'text/csv', filename: 'td.csv' });
}

beforeEach(async () => {
  await db.delete(transactions);
  await db.delete(investmentTransactions);
  await db.delete(imports);
  await db.delete(accounts);
  await db.delete(refreshTokens);
  await db.delete(users);
});

describe('TD import end-to-end', () => {
  it('imports all rows correctly', async () => {
    const token = await registerAndLogin();
    const accountId = await createAccount(token);

    const res = await uploadTd(token, accountId);

    expect(res.status).toBe(201);
    expect(res.body.importedCount).toBe(5);
    expect(res.body.duplicateCount).toBe(0);
  });

  it('correctly identifies income (PRODIGY) as positive', async () => {
    const token = await registerAndLogin();
    const accountId = await createAccount(token);

    await uploadTd(token, accountId);

    const rows = await db
      .select({ amount: transactions.amount, rawDescription: transactions.rawDescription })
      .from(transactions)
      .where(eq(transactions.accountId, accountId));

    const prodigy = rows.find(r => r.rawDescription.includes('PRODIGY'));
    expect(prodigy).toBeDefined();
    expect(parseFloat(prodigy!.amount)).toBeCloseTo(2549.81);
  });

  it('correctly identifies fees as negative', async () => {
    const token = await registerAndLogin();
    const accountId = await createAccount(token);

    await uploadTd(token, accountId);

    const rows = await db
      .select({ amount: transactions.amount, rawDescription: transactions.rawDescription })
      .from(transactions)
      .where(eq(transactions.accountId, accountId));

    const fee = rows.find(r => r.rawDescription.includes('ACCOUNT FEE'));
    expect(fee).toBeDefined();
    expect(parseFloat(fee!.amount)).toBeCloseTo(-11.95);
  });
});
