import { beforeEach, describe, expect, it } from 'vitest';
import {
  cleanDatabase,
  createAccount,
  registerUser,
} from '@/testing/test-helpers';
import { createApp } from '@/app';
import { categoryFixture } from '@/testing/fixtures/category.fixture';
import { transactionFixture } from '@/testing/fixtures/transaction.fixture';
import request from 'supertest';
import { db } from '@/db';
import { rebalancingGroupTransactions, rebalancingGroups } from '@/db/schema';

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

interface ExpenseMonth {
  month: number;
  need: number;
  want: number;
  other: number;
  total: number;
}

interface ExpensesBody {
  year: number;
  months: ExpenseMonth[];
  annualTotal: number;
}

interface CategoryRow {
  month: number;
  category: string | null;
  subcategory: string | null;
  total: number;
}

interface CategoriesBody {
  year: number;
  rows: CategoryRow[];
}

// ─── GET /api/v1/dashboard/expenses ──────────────────────────────────────────

describe('GET /api/v1/dashboard/expenses', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/dashboard/expenses?year=2025');
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing year param', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .get('/api/v1/dashboard/expenses')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 400 for out-of-range year', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .get('/api/v1/dashboard/expenses?year=1999')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 12 months all zero when no transactions', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .get('/api/v1/dashboard/expenses?year=2025')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const body = res.body as ExpensesBody;
    expect(body.year).toBe(2025);
    expect(body.months).toHaveLength(12);
    expect(
      body.months.every(
        (m) => m.need === 0 && m.want === 0 && m.other === 0 && m.total === 0
      )
    ).toBe(true);
    expect(body.annualTotal).toBe(0);
  });

  it('returns correct need bucket for a single transaction', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await createAccount(app, accessToken, {
      name: 'Chequing',
      type: 'chequing',
      institution: 'td',
      isCredit: false,
      currency: 'CAD',
    });

    await transactionFixture(accountId, {
      date: '2025-03-10',
      amount: '-120.00',
      needWant: 'Need',
    });

    const res = await request(app)
      .get('/api/v1/dashboard/expenses?year=2025')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const body = res.body as ExpensesBody;
    const mar = body.months.find((m) => m.month === 3);
    expect(mar?.need).toBe(120);
    expect(mar?.want).toBe(0);
    expect(mar?.other).toBe(0);
    expect(mar?.total).toBe(120);
  });

  it('returns correct want bucket for a single transaction', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await createAccount(app, accessToken, {
      ...DEFAULT_ACCOUNT_DATA,
    });

    await transactionFixture(accountId, {
      date: '2025-04-05',
      amount: '-80.00',
      needWant: 'Want',
    });

    const res = await request(app)
      .get('/api/v1/dashboard/expenses?year=2025')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const body = res.body as ExpensesBody;
    const apr = body.months.find((m) => m.month === 4);
    expect(apr?.want).toBe(80);
    expect(apr?.total).toBe(80);
  });

  it('puts null needWant into other bucket', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await createAccount(app, accessToken, {
      ...DEFAULT_ACCOUNT_DATA,
    });

    await transactionFixture(accountId, {
      date: '2025-05-15',
      amount: '-50.00',
      needWant: null,
    });

    const res = await request(app)
      .get('/api/v1/dashboard/expenses?year=2025')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const body = res.body as ExpensesBody;
    const may = body.months.find((m) => m.month === 5);
    expect(may?.other).toBe(50);
    expect(may?.total).toBe(50);
  });

  it('puts NA needWant into other bucket', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await createAccount(app, accessToken, {
      ...DEFAULT_ACCOUNT_DATA,
    });

    await transactionFixture(accountId, {
      date: '2025-06-20',
      amount: '-35.00',
      needWant: 'NA',
    });

    const res = await request(app)
      .get('/api/v1/dashboard/expenses?year=2025')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const body = res.body as ExpensesBody;
    const june = body.months.find((m) => m.month === 6);
    expect(june?.other).toBe(35);
    expect(june?.total).toBe(35);
  });

  it('sums multiple transactions in the same month', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await createAccount(app, accessToken, {
      ...DEFAULT_ACCOUNT_DATA,
    });

    await transactionFixture(accountId, {
      date: '2025-02-01',
      amount: '-200.00',
      needWant: 'Need',
    });
    await transactionFixture(accountId, {
      date: '2025-02-15',
      amount: '-150.00',
      needWant: 'Need',
    });

    const res = await request(app)
      .get('/api/v1/dashboard/expenses?year=2025')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const body = res.body as ExpensesBody;
    const feb = body.months.find((m) => m.month === 2);
    expect(feb?.need).toBe(350);
    expect(feb?.total).toBe(350);
    expect(body.annualTotal).toBe(350);
  });

  it('excludes income transactions', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await createAccount(app, accessToken, {
      ...DEFAULT_ACCOUNT_DATA,
    });

    await transactionFixture(accountId, {
      date: '2025-07-01',
      amount: '3000.00',
      isIncome: true,
    });

    const res = await request(app)
      .get('/api/v1/dashboard/expenses?year=2025')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const body = res.body as ExpensesBody;
    const july = body.months.find((m) => m.month === 7);
    expect(july?.total).toBe(0);
  });

  it('excludes transfer transactions', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await createAccount(app, accessToken, {
      ...DEFAULT_ACCOUNT_DATA,
    });

    await transactionFixture(accountId, {
      date: '2025-08-01',
      amount: '500.00',
      isTransfer: true,
    });

    const res = await request(app)
      .get('/api/v1/dashboard/expenses?year=2025')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const body = res.body as ExpensesBody;
    const aug = body.months.find((m) => m.month === 8);
    expect(aug?.total).toBe(0);
  });

  it('excludes investment contribution transactions', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await createAccount(app, accessToken, {
      ...DEFAULT_ACCOUNT_DATA,
    });

    await transactionFixture(accountId, {
      date: '2025-09-01',
      amount: '-400.00',
      needWant: 'Need',
      isInvestmentContribution: true,
    });
    await transactionFixture(accountId, {
      date: '2025-09-15',
      amount: '-100.00',
      needWant: 'Need',
      isInvestmentContribution: false,
    });

    const res = await request(app)
      .get('/api/v1/dashboard/expenses?year=2025')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const body = res.body as ExpensesBody;
    const sep = body.months.find((m) => m.month === 9);
    expect(sep?.need).toBe(100);
    expect(sep?.total).toBe(100);
    expect(body.annualTotal).toBe(100);
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
      date: '2025-09-01',
      amount: '-1000.00',
      needWant: 'Need',
    });

    const { accessToken: accessTokenB } = await registerUser(
      app,
      'b@example.com'
    );
    const res = await request(app)
      .get('/api/v1/dashboard/expenses?year=2025')
      .set('Authorization', `Bearer ${accessTokenB}`);

    expect(res.status).toBe(200);
    const body = res.body as ExpensesBody;
    expect(body.months.every((m) => m.total === 0)).toBe(true);
  });
});

// ─── GET /api/v1/dashboard/expenses/categories ───────────────────────────────

describe('GET /api/v1/dashboard/expenses/categories', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get(
      '/api/v1/dashboard/expenses/categories?year=2025'
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing year param', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .get('/api/v1/dashboard/expenses/categories')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(400);
  });

  it('returns empty rows when no transactions', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .get('/api/v1/dashboard/expenses/categories?year=2025')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const body = res.body as CategoriesBody;
    expect(body.year).toBe(2025);
    expect(body.rows).toEqual([]);
  });

  it('returns a row with null category and subcategory for uncategorized transactions', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await createAccount(app, accessToken, {
      ...DEFAULT_ACCOUNT_DATA,
    });

    await transactionFixture(accountId, {
      date: '2025-03-01',
      amount: '-100.00',
      categoryId: null,
      subcategoryId: null,
    });

    const res = await request(app)
      .get('/api/v1/dashboard/expenses/categories?year=2025')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const body = res.body as CategoriesBody;
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0]?.category).toBeNull();
    expect(body.rows[0]?.subcategory).toBeNull();
    expect(body.rows[0]?.month).toBe(3);
    expect(body.rows[0]?.total).toBe(100);
  });

  it('returns correct category and subcategory names', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await createAccount(app, accessToken, {
      ...DEFAULT_ACCOUNT_DATA,
    });

    const parentCat = await categoryFixture({ name: 'Food', isIncome: false });
    const childCat = await categoryFixture({
      name: 'Groceries',
      isIncome: false,
      parentId: parentCat.id,
    });

    await transactionFixture(accountId, {
      date: '2025-05-10',
      amount: '-75.00',
      categoryId: parentCat.id,
      subcategoryId: childCat.id,
    });

    const res = await request(app)
      .get('/api/v1/dashboard/expenses/categories?year=2025')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const body = res.body as CategoriesBody;
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0]?.category).toBe('Food');
    expect(body.rows[0]?.subcategory).toBe('Groceries');
    expect(body.rows[0]?.month).toBe(5);
    expect(body.rows[0]?.total).toBe(75);
  });

  it('groups by month producing separate rows', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await createAccount(app, accessToken, {
      ...DEFAULT_ACCOUNT_DATA,
    });

    await transactionFixture(accountId, {
      date: '2025-01-15',
      amount: '-50.00',
    });
    await transactionFixture(accountId, {
      date: '2025-02-20',
      amount: '-60.00',
    });

    const res = await request(app)
      .get('/api/v1/dashboard/expenses/categories?year=2025')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const body = res.body as CategoriesBody;
    expect(body.rows).toHaveLength(2);
  });

  it('sums multiple transactions with same category in the same month into one row', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await createAccount(app, accessToken, {
      ...DEFAULT_ACCOUNT_DATA,
    });

    const parentCat = await categoryFixture({
      name: 'Transport',
      isIncome: false,
    });
    const childCat = await categoryFixture({
      name: 'Gas',
      isIncome: false,
      parentId: parentCat.id,
    });

    await transactionFixture(accountId, {
      date: '2025-06-01',
      amount: '-40.00',
      categoryId: parentCat.id,
      subcategoryId: childCat.id,
    });
    await transactionFixture(accountId, {
      date: '2025-06-15',
      amount: '-35.00',
      categoryId: parentCat.id,
      subcategoryId: childCat.id,
    });

    const res = await request(app)
      .get('/api/v1/dashboard/expenses/categories?year=2025')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const body = res.body as CategoriesBody;
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0]?.total).toBe(75);
  });

  it('excludes income and transfer transactions', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await createAccount(app, accessToken, {
      ...DEFAULT_ACCOUNT_DATA,
    });

    await transactionFixture(accountId, {
      date: '2025-07-01',
      amount: '1000.00',
      isIncome: true,
    });
    await transactionFixture(accountId, {
      date: '2025-07-05',
      amount: '500.00',
      isTransfer: true,
    });

    const res = await request(app)
      .get('/api/v1/dashboard/expenses/categories?year=2025')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const body = res.body as CategoriesBody;
    expect(body.rows).toEqual([]);
  });

  it('excludes investment contribution transactions', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await createAccount(app, accessToken, {
      ...DEFAULT_ACCOUNT_DATA,
    });

    await transactionFixture(accountId, {
      date: '2025-07-10',
      amount: '-300.00',
      isInvestmentContribution: true,
    });
    await transactionFixture(accountId, {
      date: '2025-07-20',
      amount: '-50.00',
      isInvestmentContribution: false,
    });

    const res = await request(app)
      .get('/api/v1/dashboard/expenses/categories?year=2025')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const body = res.body as CategoriesBody;
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0]?.total).toBe(50);
  });

  it('isolates data between users', async () => {
    const { accessToken: accessTokenA } = await registerUser(app, 'a@example.com');
    const accountA = await createAccount(app, accessTokenA, {
      ...DEFAULT_ACCOUNT_DATA,
    });
    await transactionFixture(accountA, {
      date: '2025-08-01',
      amount: '-200.00',
    });

    const { accessToken: accessTokenB } = await registerUser(
      app,
      'b@example.com'
    );
    const res = await request(app)
      .get('/api/v1/dashboard/expenses/categories?year=2025')
      .set('Authorization', `Bearer ${accessTokenB}`);

    expect(res.status).toBe(200);
    const body = res.body as CategoriesBody;
    expect(body.rows).toEqual([]);
  });
});

// ─── Refund group exclusion ───────────────────────────────────────────────────

describe('Refund group exclusion from expenses', () => {
  it('excludes both sides of a resolved refund group from expense totals', async () => {
    const { accessToken, user } = await registerUser(app);
    const accountId = await createAccount(app, accessToken, {
      name: 'Credit',
      type: 'credit',
      institution: 'amex',
      isCredit: true,
      currency: 'CAD',
    });

    // An unrelated expense that should still appear
    await transactionFixture(accountId, { date: '2025-05-15', amount: '-100.00', needWant: 'Need' });

    // The refund pair: charge + credit
    const charge = await transactionFixture(accountId, { date: '2025-05-01', amount: '-50.00', needWant: 'Want' });
    const credit = await transactionFixture(accountId, { date: '2025-05-10', amount: '50.00' });

    // Create a resolved refund group
    const [resolvedGroup] = await db
      .insert(rebalancingGroups)
      .values({ userId: user.id, label: 'Refund', type: 'refund', status: 'resolved' })
      .returning();
    const resolvedGroupId = resolvedGroup?.id;
    expect(resolvedGroupId).toBeDefined();
    await db.insert(rebalancingGroupTransactions).values([
      { groupId: resolvedGroupId as string, transactionId: charge.id, role: 'source' },
      { groupId: resolvedGroupId as string, transactionId: credit.id, role: 'offset' },
    ]);

    const res = await request(app)
      .get('/api/v1/dashboard/expenses?year=2025')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const body = res.body as { months: { month: number; total: number }[] };
    const may = body.months.find((m) => m.month === 5);
    // Only the unrelated $100 expense should be counted; refund pair nets to zero and is excluded
    expect(may?.total).toBe(100);
  });

  it('does not exclude transactions in an open (unconfirmed) refund group', async () => {
    const { accessToken, user } = await registerUser(app);
    const accountId = await createAccount(app, accessToken, {
      name: 'Credit',
      type: 'credit',
      institution: 'amex',
      isCredit: true,
      currency: 'CAD',
    });

    const charge = await transactionFixture(accountId, { date: '2025-06-01', amount: '-60.00', needWant: 'Need' });
    const credit = await transactionFixture(accountId, { date: '2025-06-05', amount: '60.00' });

    // Open refund group — not yet confirmed
    const [openGroup] = await db
      .insert(rebalancingGroups)
      .values({ userId: user.id, label: 'Pending Refund', type: 'refund', status: 'open' })
      .returning();
    const openGroupId = openGroup?.id;
    expect(openGroupId).toBeDefined();
    await db.insert(rebalancingGroupTransactions).values([
      { groupId: openGroupId as string, transactionId: charge.id, role: 'source' },
      { groupId: openGroupId as string, transactionId: credit.id, role: 'offset' },
    ]);

    const res = await request(app)
      .get('/api/v1/dashboard/expenses?year=2025')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const body = res.body as { months: { month: number; total: number }[] };
    const june = body.months.find((m) => m.month === 6);
    // Open group not excluded — charge and credit both counted, net = 0
    expect(june?.total).toBe(0);
  });
});
