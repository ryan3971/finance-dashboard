import { beforeEach, describe, expect, it } from 'vitest';
import {
  cleanDatabase,
  registerAndLogin,
  registerUser,
} from '@/testing/test-helpers';
import { createApp } from '@/app';
import { db } from '@/db';
import { accounts, investmentTransactions, transactions } from '@/db/schema';
import request from 'supertest';

const app = createApp();

beforeEach(async () => {
  await cleanDatabase();
});

let txCounter = 0;
let invCounter = 0;

async function createTestAccount(userId: string): Promise<string> {
  const [row] = await db
    .insert(accounts)
    .values({
      userId,
      name: 'Chequing',
      type: 'chequing',
      institution: 'td',
      currency: 'CAD',
      isCredit: false,
      isActive: true,
    })
    .returning({ id: accounts.id });
  return row.id;
}

async function insertTransaction(
  accountId: string,
  opts: {
    date: string;
    amount: string;
    isIncome: boolean;
    needWant?: string | null;
    isTransfer?: boolean;
  }
) {
  txCounter += 1;
  await db.insert(transactions).values({
    accountId,
    date: opts.date,
    description: `tx-${txCounter}`,
    rawDescription: `tx-${txCounter}`,
    amount: opts.amount,
    currency: 'CAD',
    isIncome: opts.isIncome,
    needWant: opts.needWant ?? null,
    isTransfer: opts.isTransfer ?? false,
    flaggedForReview: false,
    compositeKey: `test-tx-${txCounter}-${opts.date}-${opts.amount}`,
    source: 'manual',
  });
}

async function insertInvestmentContribution(
  accountId: string,
  opts: { date: string; amount: string }
) {
  invCounter += 1;
  await db.insert(investmentTransactions).values({
    accountId,
    date: opts.date,
    action: 'deposit',
    rawAction: 'CON',
    description: `contrib-${invCounter}`,
    amount: opts.amount,
    currency: 'CAD',
    compositeKey: `test-inv-${invCounter}-${opts.date}-${opts.amount}`,
  });
}

describe('GET /api/v1/dashboard/ytd', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/dashboard/ytd?year=2024');
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing year param', async () => {
    const token = await registerAndLogin(app);
    const res = await request(app)
      .get('/api/v1/dashboard/ytd')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('returns 400 for out-of-range year', async () => {
    const token = await registerAndLogin(app);
    const res = await request(app)
      .get('/api/v1/dashboard/ytd?year=1999')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('returns 12 months for a past year with no data, all zero (not null)', async () => {
    const token = await registerAndLogin(app);
    const res = await request(app)
      .get('/api/v1/dashboard/ytd?year=2020')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.year).toBe(2020);
    expect(res.body.months).toHaveLength(12);

    type YtdMonthBody = {
      month: number;
      spendingIncome: number | null;
      expenses: number | null;
      netSpendingIncome: number | null;
      wants: number | null;
      needs: number | null;
    };

    const months = res.body.months as YtdMonthBody[];
    for (const m of months) {
      expect(m.spendingIncome).toBe(0);
      expect(m.expenses).toBe(0);
      expect(m.netSpendingIncome).toBe(0);
      expect(m.wants).toBe(0);
      expect(m.needs).toBe(0);
    }
  });

  it('returns null for future months in the current year', async () => {
    const token = await registerAndLogin(app);
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const res = await request(app)
      .get(`/api/v1/dashboard/ytd?year=${currentYear}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    type YtdMonthBody = { month: number; spendingIncome: number | null };
    const months = res.body.months as YtdMonthBody[];

    for (const m of months) {
      if (m.month > currentMonth) {
        expect(m.spendingIncome).toBeNull();
      } else {
        expect(m.spendingIncome).not.toBeNull();
      }
    }
  });

  it('computes spending income as income minus investment contributions', async () => {
    const { accessToken: token, user } = await registerUser(app);
    const accountId = await createTestAccount(user.id);

    // Jan 2024: income $5000, contributions $1000 → spendingIncome $4000
    await insertTransaction(accountId, { date: '2024-01-15', amount: '5000.00', isIncome: true });
    await insertInvestmentContribution(accountId, { date: '2024-01-20', amount: '1000.00' });

    const res = await request(app)
      .get('/api/v1/dashboard/ytd?year=2024')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    type YtdMonthBody = { month: number; spendingIncome: number };
    const jan = (res.body.months as YtdMonthBody[]).find((m) => m.month === 1);
    expect(jan?.spendingIncome).toBe(4000);
  });

  it('computes expenses, needs, wants correctly', async () => {
    const { accessToken: token, user } = await registerUser(app);
    const accountId = await createTestAccount(user.id);

    // Feb 2024: $800 Need, $400 Want, $200 uncategorized
    await insertTransaction(accountId, {
      date: '2024-02-05',
      amount: '800.00',
      isIncome: false,
      needWant: 'Need',
    });
    await insertTransaction(accountId, {
      date: '2024-02-10',
      amount: '400.00',
      isIncome: false,
      needWant: 'Want',
    });
    await insertTransaction(accountId, {
      date: '2024-02-15',
      amount: '200.00',
      isIncome: false,
      needWant: null,
    });

    const res = await request(app)
      .get('/api/v1/dashboard/ytd?year=2024')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    type YtdMonthBody = {
      month: number;
      expenses: number;
      needs: number;
      wants: number;
    };
    const feb = (res.body.months as YtdMonthBody[]).find((m) => m.month === 2);
    expect(feb?.expenses).toBe(1400);
    expect(feb?.needs).toBe(800);
    expect(feb?.wants).toBe(400);
  });

  it('computes net spending income as spending income minus expenses', async () => {
    const { accessToken: token, user } = await registerUser(app);
    const accountId = await createTestAccount(user.id);

    // Mar 2024: income $3000, contributions $500 → spendingIncome $2500
    // expenses $1800 → net $700
    await insertTransaction(accountId, { date: '2024-03-01', amount: '3000.00', isIncome: true });
    await insertInvestmentContribution(accountId, { date: '2024-03-05', amount: '500.00' });
    await insertTransaction(accountId, {
      date: '2024-03-15',
      amount: '1800.00',
      isIncome: false,
      needWant: 'Need',
    });

    const res = await request(app)
      .get('/api/v1/dashboard/ytd?year=2024')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    type YtdMonthBody = {
      month: number;
      spendingIncome: number;
      expenses: number;
      netSpendingIncome: number;
    };
    const mar = (res.body.months as YtdMonthBody[]).find((m) => m.month === 3);
    expect(mar?.spendingIncome).toBe(2500);
    expect(mar?.expenses).toBe(1800);
    expect(mar?.netSpendingIncome).toBe(700);
  });

  it('excludes transfer transactions from income and expenses', async () => {
    const { accessToken: token, user } = await registerUser(app);
    const accountId = await createTestAccount(user.id);

    // Apr 2024: $2000 income, $500 transfer (excluded), $300 expense
    await insertTransaction(accountId, { date: '2024-04-01', amount: '2000.00', isIncome: true });
    await insertTransaction(accountId, {
      date: '2024-04-05',
      amount: '500.00',
      isIncome: false,
      isTransfer: true,
    });
    await insertTransaction(accountId, {
      date: '2024-04-10',
      amount: '300.00',
      isIncome: false,
      needWant: 'Want',
    });

    const res = await request(app)
      .get('/api/v1/dashboard/ytd?year=2024')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    type YtdMonthBody = { month: number; spendingIncome: number; expenses: number };
    const apr = (res.body.months as YtdMonthBody[]).find((m) => m.month === 4);
    expect(apr?.spendingIncome).toBe(2000);
    expect(apr?.expenses).toBe(300);
  });

  it('does not include another user\'s data', async () => {
    const token = await registerAndLogin(app);
    const { user: user2 } = await registerUser(app, 'other@example.com');
    const accountId2 = await createTestAccount(user2.id);

    await insertTransaction(accountId2, { date: '2024-05-01', amount: '9999.00', isIncome: true });

    const res = await request(app)
      .get('/api/v1/dashboard/ytd?year=2024')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    type YtdMonthBody = { month: number; spendingIncome: number };
    const may = (res.body.months as YtdMonthBody[]).find((m) => m.month === 5);
    expect(may?.spendingIncome).toBe(0);
  });
});
