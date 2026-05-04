import { beforeEach, describe, expect, it } from 'vitest';
import {
  cleanDatabase,
  registerUser,
  setAllocations,
  setEmergencyFundTarget,
} from '@/testing/test-helpers';
import { createApp } from '@/app';
import { accountFixture } from '@/testing/fixtures/account.fixture';
import { transactionFixture } from '@/testing/fixtures/transaction.fixture';
import request from 'supertest';
import { type SnapshotBody } from '@/testing/types';

const app = createApp();

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
    expect(Array.isArray(body.accounts)).toBe(true);
    expect(body.emergencyFund.target).toBeNull();
    expect(typeof body.monthlyIncome.income).toBe('number');
    expect(typeof body.monthlyExpenses.total).toBe('number');
    expect(body.anticipated.hasEntries).toBe(false);
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

  it('returns zero balance for an account with no transactions', async () => {
    const { accessToken, user } = await registerUser(app);
    await accountFixture(user.id, {
      name: 'Chequing',
      type: 'chequing',
      institution: 'td',
    });

    const res = await request(app)
      .get('/api/v1/dashboard/snapshot')
      .set('Authorization', `Bearer ${accessToken}`);

    const body = res.body as SnapshotBody;
    expect(res.status).toBe(200);
    const account = body.accounts[0];
    if (!account)
      throw new Error('Expected at least one account in snapshot response');
    expect(account.name).toBe('Chequing');
    expect(account.balance).toBe(0);
  });

  it('adds income and subtracts expense from running balance', async () => {
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
      amount: '4500.00',
      isIncome: true,
    });
    await transactionFixture(accountId, {
      date: currentMonthDateStr(10),
      amount: '-1200.00',
      isIncome: false,
    });

    const res = await request(app)
      .get('/api/v1/dashboard/snapshot')
      .set('Authorization', `Bearer ${accessToken}`);

    const body = res.body as SnapshotBody;
    expect(res.status).toBe(200);
    const account = body.accounts[0];
    if (!account)
      throw new Error('Expected at least one account in snapshot response');
    expect(account.balance).toBe(3300);
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
    if (!account)
      throw new Error('Expected at least one account in snapshot response');
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

    await setEmergencyFundTarget(app, accessToken, user.id, '20000');

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

    const [incomeEntry, expenseEntry] = await Promise.all([
      request(app)
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
        }),
      request(app)
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
        }),
    ]);
    expect(incomeEntry.status).toBe(201);
    expect(expenseEntry.status).toBe(201);

    await setAllocations(app, accessToken, {
      needsPercentage: 50,
      wantsPercentage: 30,
      investmentsPercentage: 20,
    });

    const res = await request(app)
      .get('/api/v1/dashboard/snapshot')
      .set('Authorization', `Bearer ${accessToken}`);

    const body = res.body as SnapshotBody;
    expect(res.status).toBe(200);
    expect(body.anticipated.hasEntries).toBe(true);
    expect(body.anticipated.expectedIncome).toBe(5000);
    expect(body.anticipated.expectedExpenses.needs).toBe(1500);
    expect(body.anticipated.expectedExpenses.total).toBe(1500);
    // expectedSpendingIncome: 5000 * (1 − 0.20) = 4000; needs = 4000 * 0.50 = 2000; wants = 4000 * 0.30 = 1200
    expect(body.anticipated.expectedSpendingIncome).toMatchObject({
      total: 4000,
      needs: 2000,
      wants: 1200,
    });
    // income = 0 this month, so all income fields return zero regardless of config
    expect(body.monthlyIncome.actualInvestments).toBe(0);
    expect(body.monthlyIncome.spendingIncome).toBe(0);
    expect(body.monthlyIncome.needs).toBe(0);
    expect(body.monthlyIncome.wants).toBe(0);
    // allocation IS configured even though income is zero this month
    expect(body.monthlyIncome.allocationConfigured).toBe(true);
    // remainingBudget = expectedSpendingIncome − monthlyExpenses = 4000 − 0 = 4000
    expect(body.anticipated.remainingBudget).toMatchObject({
      total: 4000,
      needs: 2000,
      wants: 1200,
    });
    // expectedAvailable = expectedSpendingIncome − expectedExpenses = 4000 − 1500 = 2500
    expect(body.anticipated.expectedAvailable).toMatchObject({
      total: 2500,
      needs: 500,
      wants: 1200,
    });
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

  it('excludes prior-month expenses from monthlyExpenses', async () => {
    const { accessToken, user } = await registerUser(app);
    const accountId = (
      await accountFixture(user.id, {
        name: 'Chequing',
        type: 'chequing',
        institution: 'td',
      })
    ).id;

    // Current month expense — should appear in totals
    await transactionFixture(accountId, {
      date: currentMonthDateStr(5),
      amount: '-400.00',
      isIncome: false,
      needWant: 'Need',
    });
    // Prior month expense — should be excluded
    await transactionFixture(accountId, {
      date: priorMonthDateStr(15),
      amount: '-9999.00',
      isIncome: false,
      needWant: 'Need',
    });

    const res = await request(app)
      .get('/api/v1/dashboard/snapshot')
      .set('Authorization', `Bearer ${accessToken}`);

    const body = res.body as SnapshotBody;
    expect(res.status).toBe(200);
    expect(body.monthlyExpenses.total).toBe(400);
  });

  it('excludes transfer transactions from monthlyIncome and monthlyExpenses', async () => {
    const { accessToken, user } = await registerUser(app);
    const accountId = (
      await accountFixture(user.id, {
        name: 'Chequing',
        type: 'chequing',
        institution: 'td',
      })
    ).id;

    // Regular income — should be included
    await transactionFixture(accountId, {
      date: currentMonthDateStr(5),
      amount: '3000.00',
      isIncome: true,
      isTransfer: false,
    });
    // Income transfer — should be excluded
    await transactionFixture(accountId, {
      date: currentMonthDateStr(6),
      amount: '1000.00',
      isIncome: true,
      isTransfer: true,
    });
    // Regular expense — should be included
    await transactionFixture(accountId, {
      date: currentMonthDateStr(10),
      amount: '-500.00',
      isIncome: false,
      isTransfer: false,
      needWant: 'Want',
    });
    // Expense transfer — should be excluded
    await transactionFixture(accountId, {
      date: currentMonthDateStr(11),
      amount: '-800.00',
      isIncome: false,
      isTransfer: true,
    });

    const res = await request(app)
      .get('/api/v1/dashboard/snapshot')
      .set('Authorization', `Bearer ${accessToken}`);

    const body = res.body as SnapshotBody;
    expect(res.status).toBe(200);
    expect(body.monthlyIncome.income).toBe(3000);
    expect(body.monthlyExpenses.total).toBe(500);
  });

  it('excludes inactive accounts from the accounts list', async () => {
    const { accessToken, user } = await registerUser(app);

    await accountFixture(user.id, {
      name: 'Active Chequing',
      type: 'chequing',
      institution: 'td',
      isActive: true,
    });
    await accountFixture(user.id, {
      name: 'Inactive Savings',
      type: 'savings',
      institution: 'td',
      isActive: false,
    });

    const res = await request(app)
      .get('/api/v1/dashboard/snapshot')
      .set('Authorization', `Bearer ${accessToken}`);

    const body = res.body as SnapshotBody;
    expect(res.status).toBe(200);
    expect(body.accounts).toHaveLength(1);
    expect(body.accounts[0]?.name).toBe('Active Chequing');
  });

  it('returns emergency fund percentage above 100 when balance exceeds target', async () => {
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

    await setEmergencyFundTarget(app, accessToken, user.id, '5000');

    const res = await request(app)
      .get('/api/v1/dashboard/snapshot')
      .set('Authorization', `Bearer ${accessToken}`);

    const body = res.body as SnapshotBody;
    expect(res.status).toBe(200);
    expect(body.emergencyFund.balance).toBe(10000);
    expect(body.emergencyFund.target).toBe(5000);
    // 10000 / 5000 * 100 = 200
    expect(body.emergencyFund.percentage).toBe(200);
  });

  it('returns 0 emergency fund percentage when target is set but balance is zero', async () => {
    const { accessToken, user } = await registerUser(app);

    // Create a chequing account with no transactions (balance = 0)
    await accountFixture(user.id, {
      name: 'Chequing',
      type: 'chequing',
      institution: 'td',
    });

    await setEmergencyFundTarget(app, accessToken, user.id, '10000');

    const res = await request(app)
      .get('/api/v1/dashboard/snapshot')
      .set('Authorization', `Bearer ${accessToken}`);

    const body = res.body as SnapshotBody;
    expect(res.status).toBe(200);
    expect(body.emergencyFund.balance).toBe(0);
    expect(body.emergencyFund.target).toBe(10000);
    // 0 / 10000 * 100 = 0, not null
    expect(body.emergencyFund.percentage).toBe(0);
  });

  it('sums all chequing account balances for emergency fund when multiple exist', async () => {
    const { accessToken, user } = await registerUser(app);

    // Two chequing accounts each with the same balance so the assertion
    // holds regardless of which one the service picks first.
    const accountId1 = (
      await accountFixture(user.id, {
        name: 'Chequing A',
        type: 'chequing',
        institution: 'td',
      })
    ).id;
    const accountId2 = (
      await accountFixture(user.id, {
        name: 'Chequing B',
        type: 'chequing',
        institution: 'rbc',
      })
    ).id;

    await transactionFixture(accountId1, {
      date: currentMonthDateStr(5),
      amount: '1000.00',
      isIncome: true,
    });
    await transactionFixture(accountId2, {
      date: currentMonthDateStr(5),
      amount: '1000.00',
      isIncome: true,
    });

    await setEmergencyFundTarget(app, accessToken, user.id, '4000');

    const res = await request(app)
      .get('/api/v1/dashboard/snapshot')
      .set('Authorization', `Bearer ${accessToken}`);

    const body = res.body as SnapshotBody;
    expect(res.status).toBe(200);
    // Sum of both chequing account balances: 1000 + 1000 = 2000; 2000/4000*100 = 50
    expect(body.emergencyFund.balance).toBe(2000);
    expect(body.emergencyFund.percentage).toBe(50);
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

    const { accessToken: accessTokenB } = await registerUser(
      app,
      'snap-b@example.com'
    );

    const [resB, resA] = await Promise.all([
      request(app)
        .get('/api/v1/dashboard/snapshot')
        .set('Authorization', `Bearer ${accessTokenB}`),
      request(app)
        .get('/api/v1/dashboard/snapshot')
        .set('Authorization', `Bearer ${accessTokenA}`),
    ]);

    const bodyB = resB.body as SnapshotBody;
    expect(resB.status).toBe(200);
    expect(bodyB.accounts).toEqual([]);
    expect(bodyB.monthlyIncome.income).toBe(0);
    expect(bodyB.anticipated.hasEntries).toBe(false);

    // Ensure user A's data is still present
    const bodyA = resA.body as SnapshotBody;
    expect(bodyA.accounts).toHaveLength(1);
    expect(bodyA.monthlyIncome.income).toBe(8000);
  });

  // ── Monthly income shape ────────────────────────────────────────────────────

  it('returns actualInvestments as zero and spendingIncome matching income', async () => {
    const { accessToken, user } = await registerUser(app);
    const accountId = (
      await accountFixture(user.id, {
        name: 'Chequing',
        type: 'chequing',
        institution: 'td',
      })
    ).id;

    await transactionFixture(accountId, {
      date: currentMonthDateStr(15),
      amount: '5000.00',
      isIncome: true,
    });

    const res = await request(app)
      .get('/api/v1/dashboard/snapshot')
      .set('Authorization', `Bearer ${accessToken}`);

    const body = res.body as SnapshotBody;
    expect(res.status).toBe(200);
    expect(body.monthlyIncome.income).toBe(5000);
    // Investment tracking is deferred — actualInvestments is always zero for now.
    expect(body.monthlyIncome.actualInvestments).toBe(0);
    // spendingIncome = income − actualInvestments = 5000 − 0 = 5000
    expect(body.monthlyIncome.spendingIncome).toBe(5000);
    expect(body.monthlyIncome.allocationConfigured).toBe(false);
  });

  it('applies allocation percentages to spendingIncome for needs and wants', async () => {
    const { accessToken, user } = await registerUser(app);
    const accountId = (
      await accountFixture(user.id, {
        name: 'Chequing',
        type: 'chequing',
        institution: 'td',
      })
    ).id;

    await transactionFixture(accountId, {
      date: currentMonthDateStr(15),
      amount: '5000.00',
      isIncome: true,
    });

    await setAllocations(app, accessToken, {
      needsPercentage: 50,
      wantsPercentage: 30,
      investmentsPercentage: 20,
    });

    const res = await request(app)
      .get('/api/v1/dashboard/snapshot')
      .set('Authorization', `Bearer ${accessToken}`);

    const body = res.body as SnapshotBody;
    expect(res.status).toBe(200);
    // actualInvestments is zero (deferred), so spendingIncome equals full income.
    expect(body.monthlyIncome.spendingIncome).toBe(5000);
    // needs = 5000 * 50% = 2500; wants = 5000 * 30% = 1500
    expect(body.monthlyIncome.needs).toBe(2500);
    expect(body.monthlyIncome.wants).toBe(1500);
    expect(body.monthlyIncome.allocationConfigured).toBe(true);
  });

  it('returns zero needs and wants when allocation percentages are not configured', async () => {
    const { accessToken, user } = await registerUser(app);
    const accountId = (
      await accountFixture(user.id, {
        name: 'Chequing',
        type: 'chequing',
        institution: 'td',
      })
    ).id;

    await transactionFixture(accountId, {
      date: currentMonthDateStr(15),
      amount: '5000.00',
      isIncome: true,
    });

    // No setAllocations call — percentages remain null in user_config.
    const res = await request(app)
      .get('/api/v1/dashboard/snapshot')
      .set('Authorization', `Bearer ${accessToken}`);

    const body = res.body as SnapshotBody;
    expect(res.status).toBe(200);
    expect(body.monthlyIncome.income).toBe(5000);
    expect(body.monthlyIncome.spendingIncome).toBe(5000);
    expect(body.monthlyIncome.needs).toBe(0);
    expect(body.monthlyIncome.wants).toBe(0);
    expect(body.monthlyIncome.allocationConfigured).toBe(false);
  });

  // ── Month navigation ────────────────────────────────────────────────────────

  it('returns data for a specified prior month', async () => {
    const { accessToken, user } = await registerUser(app);
    const accountId = (
      await accountFixture(user.id, {
        name: 'Chequing',
        type: 'chequing',
        institution: 'td',
      })
    ).id;

    // Income in the prior month — should appear in that month's snapshot.
    await transactionFixture(accountId, {
      date: priorMonthDateStr(15),
      amount: '3000.00',
      isIncome: true,
    });
    // Income in the current month — should not appear in prior month query.
    await transactionFixture(accountId, {
      date: currentMonthDateStr(15),
      amount: '9999.00',
      isIncome: true,
    });

    const now = new Date();
    const priorDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const priorYear = priorDate.getFullYear();
    const priorMonth = priorDate.getMonth() + 1;

    const res = await request(app)
      .get('/api/v1/dashboard/snapshot')
      .query({ year: priorYear, month: priorMonth })
      .set('Authorization', `Bearer ${accessToken}`);

    const body = res.body as SnapshotBody;
    expect(res.status).toBe(200);
    expect(body.year).toBe(priorYear);
    expect(body.month).toBe(priorMonth);
    expect(body.monthlyIncome.income).toBe(3000);
  });

  it('returns 400 for an out-of-range month param', async () => {
    const { accessToken } = await registerUser(app);

    const [resAbove, resBelow] = await Promise.all([
      request(app)
        .get('/api/v1/dashboard/snapshot')
        .query({ month: 13 })
        .set('Authorization', `Bearer ${accessToken}`),
      request(app)
        .get('/api/v1/dashboard/snapshot')
        .query({ month: 0 })
        .set('Authorization', `Bearer ${accessToken}`),
    ]);

    expect(resAbove.status).toBe(400);
    expect(resBelow.status).toBe(400);
  });

  it('returns 400 for an out-of-range year param', async () => {
    const { accessToken } = await registerUser(app);

    const res = await request(app)
      .get('/api/v1/dashboard/snapshot')
      .query({ year: 999 })
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(400);
  });
});
