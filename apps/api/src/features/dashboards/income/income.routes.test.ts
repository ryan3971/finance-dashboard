import { beforeEach, describe, expect, it } from 'vitest';
import {
  cleanDatabase,
  createAccount,
  registerUser,
} from '@/testing/test-helpers';
import { createApp } from '@/app';
import { transactionFixture } from '@/testing/fixtures/transaction.fixture';
import request from 'supertest';

const DEFAULT_ACCOUNT_DATA = {
  name: 'Chequing',
  type: 'chequing',
  institution: 'td',
  isCredit: false,
  currency: 'CAD',
};
const app = createApp();

beforeEach(async () => {
  await cleanDatabase();
});

describe('GET /api/v1/dashboard/income', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/dashboard/income?year=2025');
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing year param', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .get('/api/v1/dashboard/income')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 400 for out-of-range year', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .get('/api/v1/dashboard/income?year=1999')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 12 months all 0.00 with null allocation when no transactions and no config', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .get('/api/v1/dashboard/income?year=2025')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.year).toBe(2025);
    expect(res.body.months).toHaveLength(12);
    expect(
      (res.body.months as { total: number }[]).every((m) => m.total === 0)
    ).toBe(true);
    expect(
      (res.body.months as { allocation: null }[]).every(
        (m) => m.allocation === null
      )
    ).toBe(true);
  });

  it('returns correct total for a month with income', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await createAccount(app, accessToken, {
      ...DEFAULT_ACCOUNT_DATA,
    });

    await transactionFixture(accountId, {
      date: '2025-03-15',
      amount: '4500.00',
      isIncome: true,
    });

    const res = await request(app)
      .get('/api/v1/dashboard/income?year=2025')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const mar = (res.body.months as { month: number; total: number }[]).find(
      (m) => m.month === 3
    );
    expect(mar?.total).toBe(4500);

    const others = (
      res.body.months as { month: number; total: number }[]
    ).filter((m) => m.month !== 3);
    expect(others.every((m) => m.total === 0)).toBe(true);
  });

  it('returns null allocation when percentages not configured', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await createAccount(app, accessToken, {
      ...DEFAULT_ACCOUNT_DATA,
    });
    await transactionFixture(accountId, {
      date: '2025-03-15',
      amount: '4500.00',
      isIncome: true,
    });

    const res = await request(app)
      .get('/api/v1/dashboard/income?year=2025')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(
      (res.body.months as { allocation: null }[]).every(
        (m) => m.allocation === null
      )
    ).toBe(true);
  });

  it('returns populated allocation after percentages configured', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await createAccount(app, accessToken, {
      ...DEFAULT_ACCOUNT_DATA,
    });
    await transactionFixture(accountId, {
      date: '2025-03-15',
      amount: '4500.00',
      isIncome: true,
    });

    await request(app)
      .patch('/api/v1/user-config')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        allocations: {
          needsPercentage: 50,
          wantsPercentage: 30,
          investmentsPercentage: 20,
        },
      });

    const res = await request(app)
      .get('/api/v1/dashboard/income?year=2025')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const mar = (
      res.body.months as {
        month: number;
        allocation: { needs: number; wants: number; investments: number };
      }[]
    ).find((m) => m.month === 3);
    expect(mar?.allocation).toEqual({
      needs: 2250,
      wants: 1350,
      investments: 900,
    });
  });

  it('sums multiple transactions in the same month', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await createAccount(app, accessToken, {
      ...DEFAULT_ACCOUNT_DATA,
    });

    await transactionFixture(accountId, {
      date: '2025-02-01',
      amount: '2000.00',
      isIncome: true,
    });
    await transactionFixture(accountId, {
      date: '2025-02-15',
      amount: '1500.00',
      isIncome: true,
    });

    const res = await request(app)
      .get('/api/v1/dashboard/income?year=2025')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const feb = (res.body.months as { month: number; total: number }[]).find(
      (m) => m.month === 2
    );
    expect(feb?.total).toBe(3500);
  });

  it('excludes transactions where needWant is not null', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await createAccount(app, accessToken, {
      ...DEFAULT_ACCOUNT_DATA,
    });

    await transactionFixture(accountId, {
      date: '2025-04-10',
      amount: '3000.00',
      isIncome: true,
      needWant: 'Need',
    });

    const res = await request(app)
      .get('/api/v1/dashboard/income?year=2025')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const apr = (res.body.months as { month: number; total: number }[]).find(
      (m) => m.month === 4
    );
    expect(apr?.total).toBe(0);
  });

  it('excludes non-income transactions', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await createAccount(app, accessToken, {
      ...DEFAULT_ACCOUNT_DATA,
    });

    await transactionFixture(accountId, {
      date: '2025-05-01',
      amount: '500.00',
      isIncome: false,
    });

    const res = await request(app)
      .get('/api/v1/dashboard/income?year=2025')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const may = (res.body.months as { month: number; total: number }[]).find(
      (m) => m.month === 5
    );
    expect(may?.total).toBe(0);
  });

  it('isolates data between users', async () => {
    const { accessToken: accessTokenA } = await registerUser(
      app,
      'a@example.com'
    );
    const accountA = await createAccount(app, accessTokenA, {
      ...DEFAULT_ACCOUNT_DATA,
    });
    await transactionFixture(accountA, {
      date: '2025-06-01',
      amount: '5000.00',
      isIncome: true,
    });

    const { accessToken: accessTokenB } = await registerUser(
      app,
      'b@example.com'
    );
    const res = await request(app)
      .get('/api/v1/dashboard/income?year=2025')
      .set('Authorization', `Bearer ${accessTokenB}`);

    expect(res.status).toBe(200);
    expect(
      (res.body.months as { total: number }[]).every((m) => m.total === 0)
    ).toBe(true);
  });
});
