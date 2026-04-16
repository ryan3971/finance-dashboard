import { beforeEach, describe, expect, it } from 'vitest';
import { cleanDatabase, registerUser } from '@/testing/test-helpers';
import { createApp } from '@/app';
import { db } from '@/db';
import { userConfig } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { accountFixture } from '@/testing/fixtures/account.fixture';
import { transactionFixture } from '@/testing/fixtures/transaction.fixture';
import { assertDefined } from '@/lib/assert';
import request from 'supertest';

const app = createApp();

interface SnapshotBody {
  year: number;
  month: number;
  accounts: { name: string; balance: number }[];
  emergencyFund: {
    target: number | null;
    balance: number;
    percentage: number | null;
  };
  monthlyIncome: { income: number };
  monthlyExpenses: { needs: number; wants: number; total: number };
  anticipated: {
    hasEntries: boolean;
    expectedIncome: number;
    expectedExpenses: { needs: number; total: number };
    expectedSpendingIncome: { total: number };
  };
}

beforeEach(async () => {
  await cleanDatabase();
});

function currentYearMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function currentMonthDateStr(day: number) {
  const { year, month } = currentYearMonth();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function priorMonthDateStr(day: number) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, day);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

async function setAllocations(accessToken: string) {
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
}

describe('GET /api/v1/dashboard/snapshot', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/dashboard/snapshot');
    expect(res.status).toBe(401);
  });

  it('returns current month and year', async () => {
    const { accessToken } = await registerUser(app);
    const { year, month } = currentYearMonth();

    const res = await request(app)
      .get('/api/v1/dashboard/snapshot')
      .set('Authorization', `Bearer ${accessToken}`);

    const body = res.body as SnapshotBody;
    expect(res.status).toBe(200);
    expect(body.year).toBe(year);
    expect(body.month).toBe(month);
  });

  it('returns empty accounts array when no accounts exist', async () => {
    const { accessToken } = await registerUser(app);

    const res = await request(app)
      .get('/api/v1/dashboard/snapshot')
      .set('Authorization', `Bearer ${accessToken}`);

    const body = res.body as SnapshotBody;
    expect(res.status).toBe(200);
    expect(body.accounts).toEqual([]);
  });

  it('returns account with correct running balance', async () => {
    const { accessToken, user } = await registerUser(app);
    const accountId = (
      await accountFixture(user.id, {
        name: 'Chequing',
        type: 'chequing',
        institution: 'td',
      })
    ).id;

    const res1 = await request(app)
      .get('/api/v1/dashboard/snapshot')
      .set('Authorization', `Bearer ${accessToken}`);

    const body1 = res1.body as SnapshotBody;
    expect(res1.status).toBe(200);
    const account = body1.accounts[0];
    assertDefined(
      account,
      'Expected at least one account in snapshot response'
    );
    expect(account.name).toBe('Chequing');
    expect(account.balance).toBe(0);

    await transactionFixture(accountId, {
      date: currentMonthDateStr(5),
      amount: '4500.00',
      isIncome: true,
    });
    await transactionFixture(accountId, {
      date: currentMonthDateStr(10),
      amount: '-1200.00',
      isIncome: false,
    });

    const res2 = await request(app)
      .get('/api/v1/dashboard/snapshot')
      .set('Authorization', `Bearer ${accessToken}`);

    const body2 = res2.body as SnapshotBody;
    const updated = body2.accounts[0];
    assertDefined(
      updated,
      'Expected at least one account in updated snapshot response'
    );
    expect(updated.balance).toBe(3300);
  });

  it('returns credit account balance as charge minus payment (debt owed)', async () => {
    const { accessToken, user } = await registerUser(app);
    const accountId = (
      await accountFixture(user.id, {
        name: 'VISA',
        type: 'credit',
        institution: 'td',
        isCredit: true,
      })
    ).id;

    // Charge: stored as negative amount, isIncome=false
    await transactionFixture(accountId, {
      date: currentMonthDateStr(5),
      amount: '-500.00',
      isIncome: false,
    });
    // Payment: stored as positive amount, isIncome=true
    await transactionFixture(accountId, {
      date: currentMonthDateStr(10),
      amount: '200.00',
      isIncome: true,
    });

    const res = await request(app)
      .get('/api/v1/dashboard/snapshot')
      .set('Authorization', `Bearer ${accessToken}`);

    const body = res.body as SnapshotBody;
    expect(res.status).toBe(200);
    const account = body.accounts[0];
    assertDefined(account, 'Expected at least one account in snapshot response');
    expect(account.name).toBe('VISA');
    // Debt owed = charge (500) − payment (200) = 300
    expect(account.balance).toBe(300);
  });

  it('returns emergency fund percentage when target configured', async () => {
    const { accessToken, user } = await registerUser(app);
    const accountId = (
      await accountFixture(user.id, {
        name: 'Chequing',
        type: 'chequing',
        institution: 'td',
      })
    ).id;

    await transactionFixture(accountId, {
      date: currentMonthDateStr(5),
      amount: '10000.00',
      isIncome: true,
    });

    // Ensure user_config row exists then set emergency fund target directly
    await request(app)
      .get('/api/v1/user-config')
      .set('Authorization', `Bearer ${accessToken}`);
    await db
      .update(userConfig)
      .set({ emergencyFundTarget: '20000' })
      .where(eq(userConfig.userId, user.id));

    const res = await request(app)
      .get('/api/v1/dashboard/snapshot')
      .set('Authorization', `Bearer ${accessToken}`);

    const body = res.body as SnapshotBody;
    expect(res.status).toBe(200);
    expect(body.emergencyFund.target).toBe(20000);
    expect(body.emergencyFund.balance).toBe(10000);
    expect(body.emergencyFund.percentage).toBe(50);
  });

  it('returns null emergency fund percentage when target not configured', async () => {
    const { accessToken } = await registerUser(app);

    const res = await request(app)
      .get('/api/v1/dashboard/snapshot')
      .set('Authorization', `Bearer ${accessToken}`);

    const body = res.body as SnapshotBody;
    expect(res.status).toBe(200);
    expect(body.emergencyFund.target).toBeNull();
    expect(body.emergencyFund.percentage).toBeNull();
  });

  it('includes only current-month income transactions', async () => {
    const { accessToken, user } = await registerUser(app);
    const accountId = (
      await accountFixture(user.id, {
        name: 'Chequing',
        type: 'chequing',
        institution: 'td',
      })
    ).id;

    // Current month income
    await transactionFixture(accountId, {
      date: currentMonthDateStr(15),
      amount: '5000.00',
      isIncome: true,
    });
    // Prior month income — should be excluded from monthly totals
    await transactionFixture(accountId, {
      date: priorMonthDateStr(15),
      amount: '9999.00',
      isIncome: true,
    });

    const res = await request(app)
      .get('/api/v1/dashboard/snapshot')
      .set('Authorization', `Bearer ${accessToken}`);

    const body = res.body as SnapshotBody;
    expect(res.status).toBe(200);
    expect(body.monthlyIncome.income).toBe(5000);
  });

  it('buckets current-month expenses by Need and Want', async () => {
    const { accessToken, user } = await registerUser(app);
    const accountId = (
      await accountFixture(user.id, {
        name: 'Chequing',
        type: 'chequing',
        institution: 'td',
      })
    ).id;

    await transactionFixture(accountId, {
      date: currentMonthDateStr(5),
      amount: '-800.00',
      isIncome: false,
      needWant: 'Need',
    });
    await transactionFixture(accountId, {
      date: currentMonthDateStr(10),
      amount: '-300.00',
      isIncome: false,
      needWant: 'Want',
    });
    await transactionFixture(accountId, {
      date: currentMonthDateStr(12),
      amount: '-50.00',
      isIncome: false,
      needWant: null,
    });

    const res = await request(app)
      .get('/api/v1/dashboard/snapshot')
      .set('Authorization', `Bearer ${accessToken}`);

    const body = res.body as SnapshotBody;
    expect(res.status).toBe(200);
    expect(body.monthlyExpenses.needs).toBe(800);
    expect(body.monthlyExpenses.wants).toBe(300);
    expect(body.monthlyExpenses.total).toBe(1150);
  });

  it('returns hasEntries: false when no anticipated budget entries exist', async () => {
    const { accessToken } = await registerUser(app);

    const res = await request(app)
      .get('/api/v1/dashboard/snapshot')
      .set('Authorization', `Bearer ${accessToken}`);

    const body = res.body as SnapshotBody;
    expect(res.status).toBe(200);
    expect(body.anticipated.hasEntries).toBe(false);
  });

  it('computes expectedIncome and expectedExpenses from monthly_amount', async () => {
    const { accessToken } = await registerUser(app);
    const { year } = currentYearMonth();

    const incomeEntry = await request(app)
      .post('/api/v1/anticipated-budget')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Salary',
        isIncome: true,
        categoryId: null,
        needWant: null,
        notes: null,
        monthlyAmount: '5000',
        effectiveYear: year,
      });
    expect(incomeEntry.status).toBe(201);

    const expenseEntry = await request(app)
      .post('/api/v1/anticipated-budget')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Rent',
        isIncome: false,
        categoryId: null,
        needWant: 'Need',
        notes: null,
        monthlyAmount: '1500',
        effectiveYear: year,
      });
    expect(expenseEntry.status).toBe(201);

    await setAllocations(accessToken);

    const res = await request(app)
      .get('/api/v1/dashboard/snapshot')
      .set('Authorization', `Bearer ${accessToken}`);

    const body = res.body as SnapshotBody;
    expect(res.status).toBe(200);
    expect(body.anticipated.hasEntries).toBe(true);
    expect(body.anticipated.expectedIncome).toBe(5000);
    expect(body.anticipated.expectedExpenses.needs).toBe(1500);
    expect(body.anticipated.expectedExpenses.total).toBe(1500);
    // expectedSpendingIncome.total = 5000 * (1 - 0.20) = 4000
    expect(body.anticipated.expectedSpendingIncome.total).toBe(4000);
  });

  it('uses month override amount when present', async () => {
    const { accessToken } = await registerUser(app);
    const { year, month } = currentYearMonth();

    const entryRes = await request(app)
      .post('/api/v1/anticipated-budget')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Insurance',
        isIncome: false,
        categoryId: null,
        needWant: 'Need',
        notes: null,
        monthlyAmount: '100',
        effectiveYear: year,
      });
    expect(entryRes.status).toBe(201);
    const entryId = (entryRes.body as { id: string }).id;

    // Override the current month with a different amount
    const overrideRes = await request(app)
      .put(`/api/v1/anticipated-budget/${entryId}/months/${month}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: '350' });
    expect(overrideRes.status).toBe(204);

    const res = await request(app)
      .get('/api/v1/dashboard/snapshot')
      .set('Authorization', `Bearer ${accessToken}`);

    const body = res.body as SnapshotBody;
    expect(res.status).toBe(200);
    // Override amount (350) should take precedence over monthly_amount (100)
    expect(body.anticipated.expectedExpenses.needs).toBe(350);
  });

  it('isolates data between users', async () => {
    const { accessToken: accessTokenA, user: userA } = await registerUser(
      app,
      'snap-a@example.com'
    );
    const accountId = (
      await accountFixture(userA.id, {
        name: 'Chequing',
        type: 'chequing',
        institution: 'td',
      })
    ).id;
    await transactionFixture(accountId, {
      date: currentMonthDateStr(10),
      amount: '8000.00',
      isIncome: true,
    });

    const { accessToken: accessTokenB } = await registerUser(app, 'snap-b@example.com');
    const res = await request(app)
      .get('/api/v1/dashboard/snapshot')
      .set('Authorization', `Bearer ${accessTokenB}`);

    const body = res.body as SnapshotBody;
    expect(res.status).toBe(200);
    expect(body.accounts).toEqual([]);
    expect(body.monthlyIncome.income).toBe(0);
    expect(body.anticipated.hasEntries).toBe(false);

    // Ensure user A's data is still present
    const resA = await request(app)
      .get('/api/v1/dashboard/snapshot')
      .set('Authorization', `Bearer ${accessTokenA}`);
    const bodyA = resA.body as SnapshotBody;
    expect(bodyA.accounts).toHaveLength(1);
    expect(bodyA.monthlyIncome.income).toBe(8000);
  });
});