import { beforeEach, describe, expect, it } from 'vitest';
import {
  cleanDatabase,
  createAccount,
  registerAndLogin,
  registerUser,
} from '@/testing/test-helpers';
import { createApp } from '@/app';
import { db } from '@/db';
import { categories, transactions } from '@/db/schema';
import request from 'supertest';

const app = createApp();

beforeEach(async () => {
  await cleanDatabase();
});

let counter = 0;

async function insertExpenseTransaction(
  accountId: string,
  opts: {
    date: string;
    amount: string;
    needWant?: string | null;
    categoryId?: string | null;
    subcategoryId?: string | null;
    isTransfer?: boolean;
    isIncome?: boolean;
  }
) {
  counter += 1;
  await db.insert(transactions).values({
    accountId,
    date: opts.date,
    description: `expense-tx-${counter}`,
    rawDescription: `expense-tx-${counter}`,
    amount: opts.amount,
    currency: 'CAD',
    isIncome: opts.isIncome ?? false,
    needWant: opts.needWant ?? null,
    isTransfer: opts.isTransfer ?? false,
    categoryId: opts.categoryId ?? null,
    subcategoryId: opts.subcategoryId ?? null,
    flaggedForReview: false,
    compositeKey: `test-expense-${counter}-${opts.date}-${opts.amount}`,
    source: 'manual',
  });
}

// ─── GET /api/v1/dashboard/expenses ──────────────────────────────────────────

describe('GET /api/v1/dashboard/expenses', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/dashboard/expenses?year=2025');
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing year param', async () => {
    const token = await registerAndLogin(app);
    const res = await request(app)
      .get('/api/v1/dashboard/expenses')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('returns 400 for out-of-range year', async () => {
    const token = await registerAndLogin(app);
    const res = await request(app)
      .get('/api/v1/dashboard/expenses?year=1999')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('returns 12 months all zero when no transactions', async () => {
    const token = await registerAndLogin(app);
    const res = await request(app)
      .get('/api/v1/dashboard/expenses?year=2025')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.year).toBe(2025);
    expect(res.body.months).toHaveLength(12);
    expect(
      (res.body.months as { need: number; want: number; other: number; total: number }[]).every(
        (m) => m.need === 0 && m.want === 0 && m.other === 0 && m.total === 0
      )
    ).toBe(true);
    expect(res.body.annualTotal).toBe(0);
  });

  it('returns correct need bucket for a single transaction', async () => {
    const token = await registerAndLogin(app);
    const accountId = await createAccount(app, token, {
      name: 'Chequing',
      type: 'chequing',
      institution: 'td',
    });

    await insertExpenseTransaction(accountId, {
      date: '2025-03-10',
      amount: '120.00',
      needWant: 'Need',
    });

    const res = await request(app)
      .get('/api/v1/dashboard/expenses?year=2025')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const mar = (res.body.months as { month: number; need: number; want: number; other: number; total: number }[]).find(
      (m) => m.month === 3
    );
    expect(mar?.need).toBe(120);
    expect(mar?.want).toBe(0);
    expect(mar?.other).toBe(0);
    expect(mar?.total).toBe(120);
  });

  it('returns correct want bucket for a single transaction', async () => {
    const token = await registerAndLogin(app);
    const accountId = await createAccount(app, token, {
      name: 'Chequing',
      type: 'chequing',
      institution: 'td',
    });

    await insertExpenseTransaction(accountId, {
      date: '2025-04-05',
      amount: '80.00',
      needWant: 'Want',
    });

    const res = await request(app)
      .get('/api/v1/dashboard/expenses?year=2025')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const apr = (res.body.months as { month: number; want: number; total: number }[]).find(
      (m) => m.month === 4
    );
    expect(apr?.want).toBe(80);
    expect(apr?.total).toBe(80);
  });

  it('puts null needWant into other bucket', async () => {
    const token = await registerAndLogin(app);
    const accountId = await createAccount(app, token, {
      name: 'Chequing',
      type: 'chequing',
      institution: 'td',
    });

    await insertExpenseTransaction(accountId, {
      date: '2025-05-15',
      amount: '50.00',
      needWant: null,
    });

    const res = await request(app)
      .get('/api/v1/dashboard/expenses?year=2025')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const may = (res.body.months as { month: number; other: number; total: number }[]).find(
      (m) => m.month === 5
    );
    expect(may?.other).toBe(50);
    expect(may?.total).toBe(50);
  });

  it('puts NA needWant into other bucket', async () => {
    const token = await registerAndLogin(app);
    const accountId = await createAccount(app, token, {
      name: 'Chequing',
      type: 'chequing',
      institution: 'td',
    });

    await insertExpenseTransaction(accountId, {
      date: '2025-06-20',
      amount: '35.00',
      needWant: 'NA',
    });

    const res = await request(app)
      .get('/api/v1/dashboard/expenses?year=2025')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const june = (res.body.months as { month: number; other: number; total: number }[]).find(
      (m) => m.month === 6
    );
    expect(june?.other).toBe(35);
    expect(june?.total).toBe(35);
  });

  it('sums multiple transactions in the same month', async () => {
    const token = await registerAndLogin(app);
    const accountId = await createAccount(app, token, {
      name: 'Chequing',
      type: 'chequing',
      institution: 'td',
    });

    await insertExpenseTransaction(accountId, {
      date: '2025-02-01',
      amount: '200.00',
      needWant: 'Need',
    });
    await insertExpenseTransaction(accountId, {
      date: '2025-02-15',
      amount: '150.00',
      needWant: 'Need',
    });

    const res = await request(app)
      .get('/api/v1/dashboard/expenses?year=2025')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const feb = (res.body.months as { month: number; need: number; total: number }[]).find(
      (m) => m.month === 2
    );
    expect(feb?.need).toBe(350);
    expect(feb?.total).toBe(350);
    expect(res.body.annualTotal).toBe(350);
  });

  it('excludes income transactions', async () => {
    const token = await registerAndLogin(app);
    const accountId = await createAccount(app, token, {
      name: 'Chequing',
      type: 'chequing',
      institution: 'td',
    });

    await insertExpenseTransaction(accountId, {
      date: '2025-07-01',
      amount: '3000.00',
      isIncome: true,
    });

    const res = await request(app)
      .get('/api/v1/dashboard/expenses?year=2025')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const july = (res.body.months as { month: number; total: number }[]).find(
      (m) => m.month === 7
    );
    expect(july?.total).toBe(0);
  });

  it('excludes transfer transactions', async () => {
    const token = await registerAndLogin(app);
    const accountId = await createAccount(app, token, {
      name: 'Chequing',
      type: 'chequing',
      institution: 'td',
    });

    await insertExpenseTransaction(accountId, {
      date: '2025-08-01',
      amount: '500.00',
      isTransfer: true,
    });

    const res = await request(app)
      .get('/api/v1/dashboard/expenses?year=2025')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const aug = (res.body.months as { month: number; total: number }[]).find(
      (m) => m.month === 8
    );
    expect(aug?.total).toBe(0);
  });

  it('isolates data between users', async () => {
    const tokenA = await registerAndLogin(app, 'a@example.com');
    const accountA = await createAccount(app, tokenA, {
      name: 'Chequing',
      type: 'chequing',
      institution: 'td',
    });
    await insertExpenseTransaction(accountA, {
      date: '2025-09-01',
      amount: '1000.00',
      needWant: 'Need',
    });

    const { accessToken: tokenB } = await registerUser(app, 'b@example.com');
    const res = await request(app)
      .get('/api/v1/dashboard/expenses?year=2025')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(
      (res.body.months as { total: number }[]).every((m) => m.total === 0)
    ).toBe(true);
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
    const token = await registerAndLogin(app);
    const res = await request(app)
      .get('/api/v1/dashboard/expenses/categories')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('returns empty rows when no transactions', async () => {
    const token = await registerAndLogin(app);
    const res = await request(app)
      .get('/api/v1/dashboard/expenses/categories?year=2025')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.year).toBe(2025);
    expect(res.body.rows).toEqual([]);
  });

  it('returns a row with null category and subcategory for uncategorized transactions', async () => {
    const token = await registerAndLogin(app);
    const accountId = await createAccount(app, token, {
      name: 'Chequing',
      type: 'chequing',
      institution: 'td',
    });

    await insertExpenseTransaction(accountId, {
      date: '2025-03-01',
      amount: '100.00',
      categoryId: null,
      subcategoryId: null,
    });

    const res = await request(app)
      .get('/api/v1/dashboard/expenses/categories?year=2025')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.rows).toHaveLength(1);
    expect(res.body.rows[0].category).toBeNull();
    expect(res.body.rows[0].subcategory).toBeNull();
    expect(res.body.rows[0].month).toBe(3);
    expect(res.body.rows[0].total).toBe(100);
  });

  it('returns correct category and subcategory names', async () => {
    const token = await registerAndLogin(app);
    const accountId = await createAccount(app, token, {
      name: 'Chequing',
      type: 'chequing',
      institution: 'td',
    });

    const [parentCat] = await db
      .insert(categories)
      .values({ name: 'Food', isIncome: false })
      .returning({ id: categories.id });
    const [childCat] = await db
      .insert(categories)
      .values({ name: 'Groceries', isIncome: false, parentId: parentCat.id })
      .returning({ id: categories.id });

    await insertExpenseTransaction(accountId, {
      date: '2025-05-10',
      amount: '75.00',
      categoryId: parentCat.id,
      subcategoryId: childCat.id,
    });

    const res = await request(app)
      .get('/api/v1/dashboard/expenses/categories?year=2025')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.rows).toHaveLength(1);
    expect(res.body.rows[0].category).toBe('Food');
    expect(res.body.rows[0].subcategory).toBe('Groceries');
    expect(res.body.rows[0].month).toBe(5);
    expect(res.body.rows[0].total).toBe(75);
  });

  it('groups by month producing separate rows', async () => {
    const token = await registerAndLogin(app);
    const accountId = await createAccount(app, token, {
      name: 'Chequing',
      type: 'chequing',
      institution: 'td',
    });

    await insertExpenseTransaction(accountId, {
      date: '2025-01-15',
      amount: '50.00',
    });
    await insertExpenseTransaction(accountId, {
      date: '2025-02-20',
      amount: '60.00',
    });

    const res = await request(app)
      .get('/api/v1/dashboard/expenses/categories?year=2025')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.rows).toHaveLength(2);
  });

  it('sums multiple transactions with same category in the same month into one row', async () => {
    const token = await registerAndLogin(app);
    const accountId = await createAccount(app, token, {
      name: 'Chequing',
      type: 'chequing',
      institution: 'td',
    });

    const [parentCat] = await db
      .insert(categories)
      .values({ name: 'Transport', isIncome: false })
      .returning({ id: categories.id });
    const [childCat] = await db
      .insert(categories)
      .values({ name: 'Gas', isIncome: false, parentId: parentCat.id })
      .returning({ id: categories.id });

    await insertExpenseTransaction(accountId, {
      date: '2025-06-01',
      amount: '40.00',
      categoryId: parentCat.id,
      subcategoryId: childCat.id,
    });
    await insertExpenseTransaction(accountId, {
      date: '2025-06-15',
      amount: '35.00',
      categoryId: parentCat.id,
      subcategoryId: childCat.id,
    });

    const res = await request(app)
      .get('/api/v1/dashboard/expenses/categories?year=2025')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.rows).toHaveLength(1);
    expect(res.body.rows[0].total).toBe(75);
  });

  it('excludes income and transfer transactions', async () => {
    const token = await registerAndLogin(app);
    const accountId = await createAccount(app, token, {
      name: 'Chequing',
      type: 'chequing',
      institution: 'td',
    });

    await insertExpenseTransaction(accountId, {
      date: '2025-07-01',
      amount: '1000.00',
      isIncome: true,
    });
    await insertExpenseTransaction(accountId, {
      date: '2025-07-05',
      amount: '500.00',
      isTransfer: true,
    });

    const res = await request(app)
      .get('/api/v1/dashboard/expenses/categories?year=2025')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.rows).toEqual([]);
  });

  it('isolates data between users', async () => {
    const tokenA = await registerAndLogin(app, 'a@example.com');
    const accountA = await createAccount(app, tokenA, {
      name: 'Chequing',
      type: 'chequing',
      institution: 'td',
    });
    await insertExpenseTransaction(accountA, {
      date: '2025-08-01',
      amount: '200.00',
    });

    const { accessToken: tokenB } = await registerUser(app, 'b@example.com');
    const res = await request(app)
      .get('/api/v1/dashboard/expenses/categories?year=2025')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(res.body.rows).toEqual([]);
  });
});
