import { beforeEach, describe, expect, it } from 'vitest';
import {
  cleanDatabase,
  createAccount,
  registerAndLogin,
  registerUser,
} from '@/testing/test-helpers';
import { createApp } from '@/app';
import { db } from '@/db';
import { transactions } from '@/db/schema';
import request from 'supertest';

const app = createApp();

beforeEach(async () => {
  await cleanDatabase();
});

let counter = 0;

async function insertIncomeTransaction(
  accountId: string,
  opts: { date: string; amount: string; needWant?: string | null; isIncome?: boolean }
) {
  counter += 1;
  await db.insert(transactions).values({
    accountId,
    date: opts.date,
    description: `income-tx-${counter}`,
    rawDescription: `income-tx-${counter}`,
    amount: opts.amount,
    currency: 'CAD',
    isIncome: opts.isIncome ?? true,
    needWant: opts.needWant ?? null,
    isTransfer: false,
    flaggedForReview: false,
    compositeKey: `test-income-${counter}-${opts.date}-${opts.amount}`,
    source: 'manual',
  });
}

describe('GET /api/v1/dashboard/income', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/dashboard/income?year=2025');
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing year param', async () => {
    const token = await registerAndLogin(app);
    const res = await request(app)
      .get('/api/v1/dashboard/income')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('returns 400 for out-of-range year', async () => {
    const token = await registerAndLogin(app);
    const res = await request(app)
      .get('/api/v1/dashboard/income?year=1999')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('returns 12 months all 0.00 with null allocation when no transactions and no config', async () => {
    const token = await registerAndLogin(app);
    const res = await request(app)
      .get('/api/v1/dashboard/income?year=2025')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.year).toBe(2025);
    expect(res.body.months).toHaveLength(12);
    expect(
      (res.body.months as { total: string }[]).every((m) => m.total === '0.00')
    ).toBe(true);
    expect(
      (res.body.months as { allocation: null }[]).every(
        (m) => m.allocation === null
      )
    ).toBe(true);
  });

  it('returns correct total for a month with income', async () => {
    const token = await registerAndLogin(app);
    const accountId = await createAccount(app, token, {
      name: 'Chequing',
      type: 'chequing',
      institution: 'td',
    });

    await insertIncomeTransaction(accountId, {
      date: '2025-03-15',
      amount: '4500.00',
    });

    const res = await request(app)
      .get('/api/v1/dashboard/income?year=2025')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const mar = (res.body.months as { month: number; total: string }[]).find(
      (m) => m.month === 3
    );
    expect(mar?.total).toBe('4500.00');

    const others = (
      res.body.months as { month: number; total: string }[]
    ).filter((m) => m.month !== 3);
    expect(others.every((m) => m.total === '0.00')).toBe(true);
  });

  it('returns null allocation when percentages not configured', async () => {
    const token = await registerAndLogin(app);
    const accountId = await createAccount(app, token, {
      name: 'Chequing',
      type: 'chequing',
      institution: 'td',
    });
    await insertIncomeTransaction(accountId, {
      date: '2025-03-15',
      amount: '4500.00',
    });

    const res = await request(app)
      .get('/api/v1/dashboard/income?year=2025')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(
      (res.body.months as { allocation: null }[]).every(
        (m) => m.allocation === null
      )
    ).toBe(true);
  });

  it('returns populated allocation after percentages configured', async () => {
    const token = await registerAndLogin(app);
    const accountId = await createAccount(app, token, {
      name: 'Chequing',
      type: 'chequing',
      institution: 'td',
    });
    await insertIncomeTransaction(accountId, {
      date: '2025-03-15',
      amount: '4500.00',
    });

    await request(app)
      .patch('/api/v1/user-config')
      .set('Authorization', `Bearer ${token}`)
      .send({
        allocations: {
          needsPercentage: 50,
          wantsPercentage: 30,
          investmentsPercentage: 20,
        },
      });

    const res = await request(app)
      .get('/api/v1/dashboard/income?year=2025')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const mar = (
      res.body.months as {
        month: number;
        allocation: { needs: string; wants: string; investments: string };
      }[]
    ).find((m) => m.month === 3);
    expect(mar?.allocation).toEqual({
      needs: '2250.00',
      wants: '1350.00',
      investments: '900.00',
    });
  });

  it('sums multiple transactions in the same month', async () => {
    const token = await registerAndLogin(app);
    const accountId = await createAccount(app, token, {
      name: 'Chequing',
      type: 'chequing',
      institution: 'td',
    });

    await insertIncomeTransaction(accountId, {
      date: '2025-02-01',
      amount: '2000.00',
    });
    await insertIncomeTransaction(accountId, {
      date: '2025-02-15',
      amount: '1500.00',
    });

    const res = await request(app)
      .get('/api/v1/dashboard/income?year=2025')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const feb = (res.body.months as { month: number; total: string }[]).find(
      (m) => m.month === 2
    );
    expect(feb?.total).toBe('3500.00');
  });

  it('excludes transactions where needWant is not null', async () => {
    const token = await registerAndLogin(app);
    const accountId = await createAccount(app, token, {
      name: 'Chequing',
      type: 'chequing',
      institution: 'td',
    });

    await insertIncomeTransaction(accountId, {
      date: '2025-04-10',
      amount: '3000.00',
      needWant: 'Need',
    });

    const res = await request(app)
      .get('/api/v1/dashboard/income?year=2025')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const apr = (res.body.months as { month: number; total: string }[]).find(
      (m) => m.month === 4
    );
    expect(apr?.total).toBe('0.00');
  });

  it('excludes non-income transactions', async () => {
    const token = await registerAndLogin(app);
    const accountId = await createAccount(app, token, {
      name: 'Chequing',
      type: 'chequing',
      institution: 'td',
    });

    await insertIncomeTransaction(accountId, {
      date: '2025-05-01',
      amount: '500.00',
      isIncome: false,
    });

    const res = await request(app)
      .get('/api/v1/dashboard/income?year=2025')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const may = (res.body.months as { month: number; total: string }[]).find(
      (m) => m.month === 5
    );
    expect(may?.total).toBe('0.00');
  });

  it('isolates data between users', async () => {
    const tokenA = await registerAndLogin(app, 'a@example.com');
    const accountA = await createAccount(app, tokenA, {
      name: 'Chequing',
      type: 'chequing',
      institution: 'td',
    });
    await insertIncomeTransaction(accountA, {
      date: '2025-06-01',
      amount: '5000.00',
    });

    const { accessToken: tokenB } = await registerUser(app, 'b@example.com');
    const res = await request(app)
      .get('/api/v1/dashboard/income?year=2025')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(
      (res.body.months as { total: string }[]).every((m) => m.total === '0.00')
    ).toBe(true);
  });
});
