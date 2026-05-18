import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanDatabase, createAccount, registerUser } from '@/testing/test-helpers';
import { createApp } from '@/app';
import { db } from '@/db';
import { contributionRecords } from '@/db/schema';
import { investmentTransactionFixture } from '@/testing/fixtures/investment-transaction.fixture';
import request from 'supertest';

// ─── Local response shapes (no shared-type imports) ───────────────────────────

interface MonthlyBreakdownRowBody {
  month: number;
  contributed: number;
  deployed: number;
  uninvestedDelta: number;
  target: number | null;
}

interface MonthlyBreakdownBody {
  year: number;
  investmentsPercentage: number | null;
  months: MonthlyBreakdownRowBody[];
  totals: {
    contributed: number;
    deployed: number;
    uninvestedDelta: number;
    target: number | null;
  };
}

const app = createApp();

beforeEach(() => cleanDatabase());
afterAll(() => cleanDatabase());

// ─── Local response shapes (no shared-type imports — spec section 9) ─────────

interface InvestmentTransactionBody {
  id: string;
  accountId: string;
  accountName: string;
  date: string;
  action: string;
  rawAction: string;
  symbol: string | null;
  amount: number;
  currency: string;
  source: string;
}

interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface TransactionAggregatesBody {
  dividends: number;
  fees: number;
  netDeposits: number;
}

interface TransactionsResponse {
  data: InvestmentTransactionBody[];
  pagination: PaginationMeta;
  aggregates: TransactionAggregatesBody;
}

interface AccountContributionSummaryBody {
  accountId: string;
  accountName: string;
  accountType: string;
  annualLimit: number | null;
  roomCarried: number | null;
  roomCarriedIsEstimate: boolean;
  contributions: number;
  withdrawals: number;
  availableRoom: number | null;
}

interface ContributionRoomBody {
  year: number;
  accounts: AccountContributionSummaryBody[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function makeTfsaAccount(app: ReturnType<typeof createApp>, token: string) {
  return createAccount(app, token, {
    name: 'My TFSA',
    type: 'tfsa',
    institution: 'questrade',
    isCredit: false,
    currency: 'CAD',
  });
}

async function makeRrspAccount(app: ReturnType<typeof createApp>, token: string) {
  return createAccount(app, token, {
    name: 'My RRSP',
    type: 'rrsp',
    institution: 'questrade',
    isCredit: false,
    currency: 'CAD',
  });
}

async function makeChequingAccount(app: ReturnType<typeof createApp>, token: string) {
  return createAccount(app, token, {
    name: 'My Chequing',
    type: 'chequing',
    institution: 'td',
    isCredit: false,
    currency: 'CAD',
  });
}

// ─── GET /api/v1/investments/transactions ────────────────────────────────────

describe('GET /api/v1/investments/transactions', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/investments/transactions');
    expect(res.status).toBe(401);
  });

  it('returns all investment transactions for the authenticated user', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await makeTfsaAccount(app, accessToken);
    await investmentTransactionFixture(accountId, { action: 'deposit', amount: '500.00' });
    await investmentTransactionFixture(accountId, { action: 'dividend', amount: '25.00' });

    const res = await request(app)
      .get('/api/v1/investments/transactions')
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    const body = res.body as TransactionsResponse;
    expect(body.data).toHaveLength(2);
    expect(body.pagination.total).toBe(2);
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.pageSize).toBe(50);
    expect(body.pagination.totalPages).toBe(1);
  });

  it('filters by accountId', async () => {
    const { accessToken } = await registerUser(app);
    const tfsaId = await makeTfsaAccount(app, accessToken);
    const rrspId = await makeRrspAccount(app, accessToken);
    await investmentTransactionFixture(tfsaId, { amount: '100.00' });
    await investmentTransactionFixture(rrspId, { amount: '200.00' });

    const res = await request(app)
      .get('/api/v1/investments/transactions')
      .query({ accountId: tfsaId })
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    const body = res.body as TransactionsResponse;
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.accountId).toBe(tfsaId);
  });

  it('filters by action', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await makeTfsaAccount(app, accessToken);
    await investmentTransactionFixture(accountId, { action: 'deposit', amount: '500.00' });
    await investmentTransactionFixture(accountId, { action: 'dividend', amount: '25.00' });
    await investmentTransactionFixture(accountId, {
      action: 'buy',
      rawAction: 'Buy',
      symbol: 'VFV',
      amount: '-600.00',
    });

    const res = await request(app)
      .get('/api/v1/investments/transactions')
      .query({ action: 'dividend' })
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    const body = res.body as TransactionsResponse;
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.action).toBe('dividend');
  });

  it('filters by symbol case-insensitively', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await makeTfsaAccount(app, accessToken);
    await investmentTransactionFixture(accountId, {
      action: 'buy',
      rawAction: 'Buy',
      symbol: 'VFV',
      amount: '-600.00',
    });
    await investmentTransactionFixture(accountId, { action: 'deposit', amount: '500.00' });

    const res = await request(app)
      .get('/api/v1/investments/transactions')
      .query({ symbol: 'vfv' })
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    const body = res.body as TransactionsResponse;
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.symbol).toBe('VFV');
  });

  it('filters by startDate and endDate inclusively', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await makeTfsaAccount(app, accessToken);
    await investmentTransactionFixture(accountId, { date: '2024-01-01', amount: '100.00' });
    await investmentTransactionFixture(accountId, { date: '2024-06-15', amount: '200.00' });
    await investmentTransactionFixture(accountId, { date: '2024-12-31', amount: '300.00' });

    const res = await request(app)
      .get('/api/v1/investments/transactions')
      .query({ startDate: '2024-01-01', endDate: '2024-06-15' })
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    const body = res.body as TransactionsResponse;
    expect(body.data).toHaveLength(2);
    const dates = body.data.map((t) => t.date);
    expect(dates).toContain('2024-01-01');
    expect(dates).toContain('2024-06-15');
  });

  it('respects page and pageSize; returns correct total and totalPages', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await makeTfsaAccount(app, accessToken);
    for (let i = 0; i < 5; i++) {
      await investmentTransactionFixture(accountId, { amount: `${(i + 1) * 10}.00` });
    }

    const res = await request(app)
      .get('/api/v1/investments/transactions')
      .query({ page: 2, pageSize: 2 })
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    const body = res.body as TransactionsResponse;
    expect(body.data).toHaveLength(2);
    expect(body.pagination.total).toBe(5);
    expect(body.pagination.totalPages).toBe(3);
    expect(body.pagination.page).toBe(2);
    expect(body.pagination.pageSize).toBe(2);
  });

  it('does not return transactions belonging to another user', async () => {
    const [{ accessToken: tokenA }, { accessToken: tokenB }] = await Promise.all([
      registerUser(app, 'inv-a@example.com'),
      registerUser(app, 'inv-b@example.com'),
    ]);
    const accountA = await makeTfsaAccount(app, tokenA);
    const accountB = await makeTfsaAccount(app, tokenB);
    await investmentTransactionFixture(accountA, { amount: '100.00' });
    await investmentTransactionFixture(accountB, { amount: '200.00' });

    const res = await request(app)
      .get('/api/v1/investments/transactions')
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    const body = res.body as TransactionsResponse;
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.accountId).toBe(accountA);
  });

  it('returns aggregates with correct values for mixed actions', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await makeTfsaAccount(app, accessToken);
    await investmentTransactionFixture(accountId, { action: 'dividend', amount: '50.00' });
    await investmentTransactionFixture(accountId, { action: 'dividend', amount: '25.00' });
    // Fees are stored as negative amounts; the query negates them, so a normal fee → positive aggregate.
    await investmentTransactionFixture(accountId, { action: 'fee', amount: '-10.00' });
    await investmentTransactionFixture(accountId, { action: 'deposit', amount: '1000.00' });
    await investmentTransactionFixture(accountId, { action: 'withdrawal', amount: '-200.00' });
    await investmentTransactionFixture(accountId, { action: 'buy', amount: '-500.00' });

    const res = await request(app)
      .get('/api/v1/investments/transactions')
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    const body = res.body as TransactionsResponse;
    expect(body.aggregates.dividends).toBe(75);
    expect(body.aggregates.fees).toBe(10);
    expect(body.aggregates.netDeposits).toBe(800);
  });

  it('fee refund (positive stored amount) produces a negative fees aggregate', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await makeTfsaAccount(app, accessToken);
    // A refund is stored as a positive amount; the query negates it → negative aggregate.
    await investmentTransactionFixture(accountId, { action: 'fee', amount: '5.00' });

    const res = await request(app)
      .get('/api/v1/investments/transactions')
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    const body = res.body as TransactionsResponse;
    expect(body.aggregates.fees).toBe(-5);
  });

  it('aggregates reflect the active filters, not the full dataset', async () => {
    const { accessToken } = await registerUser(app);
    const tfsaId = await makeTfsaAccount(app, accessToken);
    const rrspId = await makeRrspAccount(app, accessToken);
    await investmentTransactionFixture(tfsaId, { action: 'dividend', amount: '100.00' });
    await investmentTransactionFixture(rrspId, { action: 'dividend', amount: '40.00' });

    const res = await request(app)
      .get('/api/v1/investments/transactions')
      .query({ accountId: tfsaId })
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    const body = res.body as TransactionsResponse;
    expect(body.aggregates.dividends).toBe(100);
  });

  it('aggregates are zero when the filter matches no relevant actions', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await makeTfsaAccount(app, accessToken);
    await investmentTransactionFixture(accountId, { action: 'buy', amount: '-300.00' });

    const res = await request(app)
      .get('/api/v1/investments/transactions')
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    const body = res.body as TransactionsResponse;
    expect(body.aggregates.dividends).toBe(0);
    expect(body.aggregates.fees).toBe(0);
    expect(body.aggregates.netDeposits).toBe(0);
  });
});

// ─── GET /api/v1/investments/contribution-room ───────────────────────────────

describe('GET /api/v1/investments/contribution-room', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app)
      .get('/api/v1/investments/contribution-room')
      .query({ year: 2024 });
    expect(res.status).toBe(401);
  });

  it('returns 400 when year is missing', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .get('/api/v1/investments/contribution-room')
      .set(authHeader(accessToken));
    expect(res.status).toBe(400);
  });

  it('excludes non-registered account types', async () => {
    const { accessToken } = await registerUser(app);
    const tfsaId = await makeTfsaAccount(app, accessToken);
    await makeChequingAccount(app, accessToken);

    const res = await request(app)
      .get('/api/v1/investments/contribution-room')
      .query({ year: 2024 })
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    const body = res.body as ContributionRoomBody;
    expect(body.accounts).toHaveLength(1);
    expect(body.accounts[0]?.accountId).toBe(tfsaId);
    expect(body.accounts[0]?.accountType).toBe('tfsa');
  });

  it('returns correct contributions and withdrawals derived from transactions', async () => {
    const { accessToken } = await registerUser(app);
    const tfsaId = await makeTfsaAccount(app, accessToken);
    await investmentTransactionFixture(tfsaId, {
      action: 'deposit',
      amount: '7000.00',
      date: '2024-03-01',
    });
    await investmentTransactionFixture(tfsaId, {
      action: 'withdrawal',
      rawAction: 'WDW',
      amount: '-2000.00',
      date: '2024-06-01',
    });
    await investmentTransactionFixture(tfsaId, {
      action: 'dividend',
      amount: '50.00',
      date: '2024-04-01',
    });

    const res = await request(app)
      .get('/api/v1/investments/contribution-room')
      .query({ year: 2024 })
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    const body = res.body as ContributionRoomBody;
    const summary = body.accounts[0];
    expect(summary?.contributions).toBe(7000);
    expect(summary?.withdrawals).toBe(2000);
  });

  it('returns null for annualLimit, roomCarried, availableRoom when no contribution record exists', async () => {
    const { accessToken } = await registerUser(app);
    const tfsaId = await makeTfsaAccount(app, accessToken);
    await investmentTransactionFixture(tfsaId, {
      action: 'deposit',
      amount: '3000.00',
      date: '2024-01-15',
    });

    const res = await request(app)
      .get('/api/v1/investments/contribution-room')
      .query({ year: 2024 })
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    const body = res.body as ContributionRoomBody;
    const summary = body.accounts[0];
    expect(summary?.annualLimit).toBeNull();
    expect(summary?.roomCarried).toBeNull();
    expect(summary?.availableRoom).toBeNull();
    expect(summary?.contributions).toBe(3000);
  });

  it('computes availableRoom correctly when annualLimit is entered', async () => {
    const { accessToken } = await registerUser(app);
    const tfsaId = await makeTfsaAccount(app, accessToken);
    await investmentTransactionFixture(tfsaId, {
      action: 'deposit',
      amount: '3000.00',
      date: '2024-01-15',
    });
    await investmentTransactionFixture(tfsaId, {
      action: 'withdrawal',
      rawAction: 'WDW',
      amount: '-500.00',
      date: '2024-06-01',
    });
    await db.insert(contributionRecords).values({
      accountId: tfsaId,
      taxYear: 2024,
      annualLimit: '7000',
      roomCarried: '5000',
      roomCarriedConfirmed: true,
    });

    const res = await request(app)
      .get('/api/v1/investments/contribution-room')
      .query({ year: 2024 })
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    const body = res.body as ContributionRoomBody;
    const summary = body.accounts[0];
    // availableRoom = annualLimit + roomCarried + withdrawals - contributions
    // = 7000 + 5000 + 500 - 3000 = 9500
    expect(summary?.availableRoom).toBe(9500);
    expect(summary?.annualLimit).toBe(7000);
    expect(summary?.roomCarried).toBe(5000);
    expect(summary?.roomCarriedIsEstimate).toBe(false);
  });

  it('pre-populates TFSA roomCarried estimate from prior-year data when prior annualLimit is known', async () => {
    const { accessToken } = await registerUser(app);
    const tfsaId = await makeTfsaAccount(app, accessToken);

    // Prior-year transactions (2023)
    await investmentTransactionFixture(tfsaId, {
      action: 'deposit',
      amount: '4000.00',
      date: '2023-03-01',
    });
    await investmentTransactionFixture(tfsaId, {
      action: 'withdrawal',
      rawAction: 'WDW',
      amount: '-1000.00',
      date: '2023-09-01',
    });
    // Prior-year contribution record
    await db.insert(contributionRecords).values({
      accountId: tfsaId,
      taxYear: 2023,
      annualLimit: '6500',
      roomCarried: '8000',
      roomCarriedConfirmed: true,
    });

    const res = await request(app)
      .get('/api/v1/investments/contribution-room')
      .query({ year: 2024 })
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    const body = res.body as ContributionRoomBody;
    const summary = body.accounts[0];
    // roomCarried(2024) = annualLimit(2023) + roomCarried(2023) + withdrawals(2023) - contributions(2023)
    // = 6500 + 8000 + 1000 - 4000 = 11500
    expect(summary?.roomCarried).toBe(11500);
    expect(summary?.roomCarriedIsEstimate).toBe(true);
    expect(summary?.annualLimit).toBeNull();
  });

  it('returns null roomCarried estimate when prior-year annualLimit is null', async () => {
    const { accessToken } = await registerUser(app);
    const tfsaId = await makeTfsaAccount(app, accessToken);
    await db.insert(contributionRecords).values({
      accountId: tfsaId,
      taxYear: 2023,
      annualLimit: null,
      roomCarried: '5000',
      roomCarriedConfirmed: true,
    });

    const res = await request(app)
      .get('/api/v1/investments/contribution-room')
      .query({ year: 2024 })
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    const body = res.body as ContributionRoomBody;
    const summary = body.accounts[0];
    expect(summary?.roomCarried).toBeNull();
    expect(summary?.roomCarriedIsEstimate).toBe(false);
  });

  it('returns null roomCarried estimate when no prior-year data exists', async () => {
    const { accessToken } = await registerUser(app);
    await makeTfsaAccount(app, accessToken);

    const res = await request(app)
      .get('/api/v1/investments/contribution-room')
      .query({ year: 2024 })
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    const body = res.body as ContributionRoomBody;
    const summary = body.accounts[0];
    expect(summary?.roomCarried).toBeNull();
    expect(summary?.roomCarriedIsEstimate).toBe(false);
  });

  it('sets roomCarriedIsEstimate to false once roomCarriedConfirmed is true', async () => {
    const { accessToken } = await registerUser(app);
    const tfsaId = await makeTfsaAccount(app, accessToken);
    await db.insert(contributionRecords).values({
      accountId: tfsaId,
      taxYear: 2024,
      annualLimit: '7000',
      roomCarried: '5000',
      roomCarriedConfirmed: false,
    });

    const before = await request(app)
      .get('/api/v1/investments/contribution-room')
      .query({ year: 2024 })
      .set(authHeader(accessToken));

    expect((before.body as ContributionRoomBody).accounts[0]?.roomCarriedIsEstimate).toBe(true);

    await request(app)
      .put(`/api/v1/investments/contribution-room/${tfsaId}/2024`)
      .set(authHeader(accessToken))
      .send({ roomCarriedConfirmed: true });

    const after = await request(app)
      .get('/api/v1/investments/contribution-room')
      .query({ year: 2024 })
      .set(authHeader(accessToken));

    expect((after.body as ContributionRoomBody).accounts[0]?.roomCarriedIsEstimate).toBe(false);
  });
});

// ─── PUT /api/v1/investments/contribution-room/:accountId/:year ──────────────

describe('PUT /api/v1/investments/contribution-room/:accountId/:year', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).put(
      '/api/v1/investments/contribution-room/00000000-0000-0000-0000-000000000000/2024'
    );
    expect(res.status).toBe(401);
  });

  it('upserts correctly on first write (no existing row)', async () => {
    const { accessToken } = await registerUser(app);
    const tfsaId = await makeTfsaAccount(app, accessToken);

    const res = await request(app)
      .put(`/api/v1/investments/contribution-room/${tfsaId}/2024`)
      .set(authHeader(accessToken))
      .send({ annualLimit: 7000, roomCarried: 5000 });

    expect(res.status).toBe(204);

    const roomRes = await request(app)
      .get('/api/v1/investments/contribution-room')
      .query({ year: 2024 })
      .set(authHeader(accessToken));

    const body = roomRes.body as ContributionRoomBody;
    expect(body.accounts[0]?.annualLimit).toBe(7000);
    expect(body.accounts[0]?.roomCarried).toBe(5000);
  });

  it('upserts correctly on second write (existing row update path)', async () => {
    const { accessToken } = await registerUser(app);
    const tfsaId = await makeTfsaAccount(app, accessToken);

    await request(app)
      .put(`/api/v1/investments/contribution-room/${tfsaId}/2024`)
      .set(authHeader(accessToken))
      .send({ annualLimit: 7000 });

    await request(app)
      .put(`/api/v1/investments/contribution-room/${tfsaId}/2024`)
      .set(authHeader(accessToken))
      .send({ annualLimit: 7500, roomCarried: 3000 });

    const roomRes = await request(app)
      .get('/api/v1/investments/contribution-room')
      .query({ year: 2024 })
      .set(authHeader(accessToken));

    const body = roomRes.body as ContributionRoomBody;
    expect(body.accounts[0]?.annualLimit).toBe(7500);
    expect(body.accounts[0]?.roomCarried).toBe(3000);
  });

  it('returns 403 if accountId belongs to another user', async () => {
    const [{ accessToken: tokenA }, { accessToken: tokenB }] = await Promise.all([
      registerUser(app, 'put-a@example.com'),
      registerUser(app, 'put-b@example.com'),
    ]);
    const accountA = await makeTfsaAccount(app, tokenA);

    const res = await request(app)
      .put(`/api/v1/investments/contribution-room/${accountA}/2024`)
      .set(authHeader(tokenB))
      .send({ annualLimit: 7000 });

    expect(res.status).toBe(403);
  });

  it('returns 400 if account type is not a registered account type', async () => {
    const { accessToken } = await registerUser(app);
    const chequingId = await makeChequingAccount(app, accessToken);

    const res = await request(app)
      .put(`/api/v1/investments/contribution-room/${chequingId}/2024`)
      .set(authHeader(accessToken))
      .send({ annualLimit: 7000 });

    expect(res.status).toBe(400);
  });

  it('setting roomCarriedConfirmed: true persists and is reflected in subsequent GET', async () => {
    const { accessToken } = await registerUser(app);
    const tfsaId = await makeTfsaAccount(app, accessToken);
    await db.insert(contributionRecords).values({
      accountId: tfsaId,
      taxYear: 2024,
      annualLimit: '7000',
      roomCarried: '5000',
      roomCarriedConfirmed: false,
    });

    await request(app)
      .put(`/api/v1/investments/contribution-room/${tfsaId}/2024`)
      .set(authHeader(accessToken))
      .send({ roomCarriedConfirmed: true });

    const res = await request(app)
      .get('/api/v1/investments/contribution-room')
      .query({ year: 2024 })
      .set(authHeader(accessToken));

    expect((res.body as ContributionRoomBody).accounts[0]?.roomCarriedIsEstimate).toBe(false);
  });
});

// ─── POST /api/v1/investments/transactions ───────────────────────────────────

describe('POST /api/v1/investments/transactions', () => {
  // accountId is always provided explicitly per-test — no placeholder here.
  const validFields = {
    date:        '2024-03-15',
    action:      'deposit',
    amount:      500,
    currency:    'CAD',
    description: 'Employer RRSP contribution',
  };

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/v1/investments/transactions')
      .send({ accountId: '00000000-0000-0000-0000-000000000001', ...validFields });
    expect(res.status).toBe(401);
  });

  it('creates a manual transaction and returns 201 with the correct shape', async () => {
    const { accessToken } = await registerUser(app);
    const tfsaId = await makeTfsaAccount(app, accessToken);

    const res = await request(app)
      .post('/api/v1/investments/transactions')
      .set(authHeader(accessToken))
      .send({ accountId: tfsaId, ...validFields });

    expect(res.status).toBe(201);
    const body = res.body as InvestmentTransactionBody;
    expect(body.id).toBeDefined();
    expect(body.accountId).toBe(tfsaId);
    expect(body.accountName).toBe('My TFSA');
    expect(body.date).toBe('2024-03-15');
    expect(body.action).toBe('deposit');
    expect(body.rawAction).toBe('deposit');
    expect(body.amount).toBe(500);
    expect(body.currency).toBe('CAD');
    expect(body.source).toBe('manual');
  });

  it('sets rawAction equal to action for manual entries', async () => {
    const { accessToken } = await registerUser(app);
    const tfsaId = await makeTfsaAccount(app, accessToken);

    const res = await request(app)
      .post('/api/v1/investments/transactions')
      .set(authHeader(accessToken))
      .send({ accountId: tfsaId, ...validFields, action: 'buy', amount: -600 });

    expect(res.status).toBe(201);
    const body = res.body as InvestmentTransactionBody;
    expect(body.action).toBe('buy');
    expect(body.rawAction).toBe('buy');
  });

  it('stores optional fields when provided', async () => {
    const { accessToken } = await registerUser(app);
    const tfsaId = await makeTfsaAccount(app, accessToken);

    const res = await request(app)
      .post('/api/v1/investments/transactions')
      .set(authHeader(accessToken))
      .send({
        accountId:    tfsaId,
        date:         '2024-05-01',
        action:       'buy',
        amount:       -1000,
        currency:     'CAD',
        description:  'Buy VFV',
        symbol:       'VFV.TO',
        quantity:     10,
        price:        100,
        activityType: 'Purchase',
        note:         'Scheduled DCA',
      });

    expect(res.status).toBe(201);
    const body = res.body as InvestmentTransactionBody;
    expect(body.symbol).toBe('VFV.TO');
    expect(body.amount).toBe(-1000);
  });

  it('returns 400 when accountId is missing', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/investments/transactions')
      .set(authHeader(accessToken))
      .send(validFields);
    expect(res.status).toBe(400);
  });

  it('returns 400 when accountId is not a valid UUID', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/investments/transactions')
      .set(authHeader(accessToken))
      .send({ accountId: 'not-a-uuid', ...validFields });
    expect(res.status).toBe(400);
  });

  it('returns 400 when date is in wrong format', async () => {
    const { accessToken } = await registerUser(app);
    const tfsaId = await makeTfsaAccount(app, accessToken);
    const res = await request(app)
      .post('/api/v1/investments/transactions')
      .set(authHeader(accessToken))
      .send({ accountId: tfsaId, ...validFields, date: '15/03/2024' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when action is invalid', async () => {
    const { accessToken } = await registerUser(app);
    const tfsaId = await makeTfsaAccount(app, accessToken);
    const res = await request(app)
      .post('/api/v1/investments/transactions')
      .set(authHeader(accessToken))
      .send({ accountId: tfsaId, ...validFields, action: 'unknown' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when amount is missing', async () => {
    const { accessToken } = await registerUser(app);
    const tfsaId = await makeTfsaAccount(app, accessToken);
    const res = await request(app)
      .post('/api/v1/investments/transactions')
      .set(authHeader(accessToken))
      .send({ accountId: tfsaId, date: validFields.date, action: validFields.action, currency: validFields.currency, description: validFields.description });
    expect(res.status).toBe(400);
  });

  it('returns 400 when amount is zero', async () => {
    const { accessToken } = await registerUser(app);
    const tfsaId = await makeTfsaAccount(app, accessToken);
    const res = await request(app)
      .post('/api/v1/investments/transactions')
      .set(authHeader(accessToken))
      .send({ accountId: tfsaId, ...validFields, amount: 0 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when description is missing', async () => {
    const { accessToken } = await registerUser(app);
    const tfsaId = await makeTfsaAccount(app, accessToken);
    const res = await request(app)
      .post('/api/v1/investments/transactions')
      .set(authHeader(accessToken))
      .send({ accountId: tfsaId, date: validFields.date, action: validFields.action, amount: validFields.amount, currency: validFields.currency });
    expect(res.status).toBe(400);
  });

  it('returns 400 when description is empty', async () => {
    const { accessToken } = await registerUser(app);
    const tfsaId = await makeTfsaAccount(app, accessToken);
    const res = await request(app)
      .post('/api/v1/investments/transactions')
      .set(authHeader(accessToken))
      .send({ accountId: tfsaId, ...validFields, description: '' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when currency is not CAD or USD', async () => {
    const { accessToken } = await registerUser(app);
    const tfsaId = await makeTfsaAccount(app, accessToken);
    const res = await request(app)
      .post('/api/v1/investments/transactions')
      .set(authHeader(accessToken))
      .send({ accountId: tfsaId, ...validFields, currency: 'EUR' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when accountId does not exist', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/investments/transactions')
      .set(authHeader(accessToken))
      .send({ accountId: '00000000-0000-0000-0000-000000000099', ...validFields });
    expect(res.status).toBe(404);
  });

  it('returns 403 when accountId belongs to another user', async () => {
    const [{ accessToken: tokenA }, { accessToken: tokenB }] = await Promise.all([
      registerUser(app, 'post-inv-a@example.com'),
      registerUser(app, 'post-inv-b@example.com'),
    ]);
    const accountA = await makeTfsaAccount(app, tokenA);

    const res = await request(app)
      .post('/api/v1/investments/transactions')
      .set(authHeader(tokenB))
      .send({ accountId: accountA, ...validFields });

    expect(res.status).toBe(403);
  });

  it('returns 400 when accountId is a non-investment account type', async () => {
    const { accessToken } = await registerUser(app);
    const chequingId = await makeChequingAccount(app, accessToken);

    const res = await request(app)
      .post('/api/v1/investments/transactions')
      .set(authHeader(accessToken))
      .send({ accountId: chequingId, ...validFields });

    expect(res.status).toBe(400);
  });

  it('returns 409 when the same transaction is submitted twice', async () => {
    const { accessToken } = await registerUser(app);
    const tfsaId = await makeTfsaAccount(app, accessToken);

    const first = await request(app)
      .post('/api/v1/investments/transactions')
      .set(authHeader(accessToken))
      .send({ accountId: tfsaId, ...validFields });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/v1/investments/transactions')
      .set(authHeader(accessToken))
      .send({ accountId: tfsaId, ...validFields });
    expect(second.status).toBe(409);
  });

  it('appears in GET /transactions after creation', async () => {
    const { accessToken } = await registerUser(app);
    const tfsaId = await makeTfsaAccount(app, accessToken);

    await request(app)
      .post('/api/v1/investments/transactions')
      .set(authHeader(accessToken))
      .send({ accountId: tfsaId, ...validFields });

    const listRes = await request(app)
      .get('/api/v1/investments/transactions')
      .set(authHeader(accessToken));

    expect(listRes.status).toBe(200);
    const listBody = listRes.body as { data: InvestmentTransactionBody[] };
    expect(listBody.data).toHaveLength(1);
    expect(listBody.data[0]?.source).toBe('manual');
  });

  it('accepts a non-registered investment account (non-registered type)', async () => {
    const { accessToken } = await registerUser(app);
    const nonRegId = await createAccount(app, accessToken, {
      name: 'TD Non-Reg',
      type: 'non-registered',
      institution: 'td',
      isCredit: false,
      currency: 'CAD',
    });

    const res = await request(app)
      .post('/api/v1/investments/transactions')
      .set(authHeader(accessToken))
      .send({ accountId: nonRegId, ...validFields });

    expect(res.status).toBe(201);
  });
});

// ─── GET /api/v1/investments/monthly-breakdown ────────────────────────────────

describe('GET /api/v1/investments/monthly-breakdown', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app)
      .get('/api/v1/investments/monthly-breakdown')
      .query({ year: 2024 });
    expect(res.status).toBe(401);
  });

  it('returns 400 when year is missing', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .get('/api/v1/investments/monthly-breakdown')
      .set(authHeader(accessToken));
    expect(res.status).toBe(400);
  });

  it('returns 400 when year is not an integer', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .get('/api/v1/investments/monthly-breakdown')
      .query({ year: 'abc' })
      .set(authHeader(accessToken));
    expect(res.status).toBe(400);
  });

  it('returns 400 when year is out of range', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .get('/api/v1/investments/monthly-breakdown')
      .query({ year: 1999 })
      .set(authHeader(accessToken));
    expect(res.status).toBe(400);
  });

  it('returns all 12 months with zeros when user has no investment accounts', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .get('/api/v1/investments/monthly-breakdown')
      .query({ year: 2024 })
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    const body = res.body as MonthlyBreakdownBody;
    expect(body.year).toBe(2024);
    expect(body.months).toHaveLength(12);
    expect(body.months.every((m) => m.contributed === 0)).toBe(true);
    expect(body.months.every((m) => m.deployed === 0)).toBe(true);
    expect(body.months.every((m) => m.uninvestedDelta === 0)).toBe(true);
    expect(body.months.every((m) => m.target === null)).toBe(true);
    expect(body.totals.contributed).toBe(0);
    expect(body.totals.deployed).toBe(0);
    expect(body.totals.uninvestedDelta).toBe(0);
    expect(body.totals.target).toBeNull();
  });

  it('contributed correctly sums deposits and excludes other actions', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await makeTfsaAccount(app, accessToken);
    await investmentTransactionFixture(accountId, {
      date: '2024-03-01',
      action: 'deposit',
      amount: '500.00',
    });
    await investmentTransactionFixture(accountId, {
      date: '2024-03-15',
      action: 'deposit',
      amount: '300.00',
    });
    // dividend and fee should not affect contributed or deployed
    await investmentTransactionFixture(accountId, {
      date: '2024-03-20',
      action: 'dividend',
      amount: '50.00',
    });

    const res = await request(app)
      .get('/api/v1/investments/monthly-breakdown')
      .query({ year: 2024 })
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    const body = res.body as MonthlyBreakdownBody;
    const march = body.months.find((m) => m.month === 3);
    expect(march?.contributed).toBe(800);
    expect(march?.deployed).toBe(0);
  });

  it('deployed correctly nets buys (negative) and sells (positive)', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await makeTfsaAccount(app, accessToken);
    await investmentTransactionFixture(accountId, {
      date: '2024-04-10',
      action: 'buy',
      symbol: 'VFV',
      amount: '-1000.00',
    });
    await investmentTransactionFixture(accountId, {
      date: '2024-04-20',
      action: 'sell',
      symbol: 'VFV',
      amount: '200.00',
    });

    const res = await request(app)
      .get('/api/v1/investments/monthly-breakdown')
      .query({ year: 2024 })
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    const body = res.body as MonthlyBreakdownBody;
    const april = body.months.find((m) => m.month === 4);
    expect(april?.deployed).toBe(-800);
    expect(april?.contributed).toBe(0);
  });

  it('uninvestedDelta equals contributed + deployed', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await makeTfsaAccount(app, accessToken);
    await investmentTransactionFixture(accountId, {
      date: '2024-05-01',
      action: 'deposit',
      amount: '1000.00',
    });
    await investmentTransactionFixture(accountId, {
      date: '2024-05-15',
      action: 'buy',
      symbol: 'XEI',
      amount: '-600.00',
    });

    const res = await request(app)
      .get('/api/v1/investments/monthly-breakdown')
      .query({ year: 2024 })
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    const body = res.body as MonthlyBreakdownBody;
    const may = body.months.find((m) => m.month === 5);
    expect(may?.contributed).toBe(1000);
    expect(may?.deployed).toBe(-600);
    expect(may?.uninvestedDelta).toBe(400);
  });

  it('months with no activity return zeros', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await makeTfsaAccount(app, accessToken);
    await investmentTransactionFixture(accountId, {
      date: '2024-01-10',
      action: 'deposit',
      amount: '500.00',
    });

    const res = await request(app)
      .get('/api/v1/investments/monthly-breakdown')
      .query({ year: 2024 })
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    const body = res.body as MonthlyBreakdownBody;
    const june = body.months.find((m) => m.month === 6);
    expect(june?.contributed).toBe(0);
    expect(june?.deployed).toBe(0);
    expect(june?.uninvestedDelta).toBe(0);
  });

  it('totals row sums all 12 months', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await makeTfsaAccount(app, accessToken);
    await investmentTransactionFixture(accountId, {
      date: '2024-01-10',
      action: 'deposit',
      amount: '500.00',
    });
    await investmentTransactionFixture(accountId, {
      date: '2024-06-10',
      action: 'deposit',
      amount: '300.00',
    });
    await investmentTransactionFixture(accountId, {
      date: '2024-06-15',
      action: 'buy',
      symbol: 'VFV',
      amount: '-200.00',
    });

    const res = await request(app)
      .get('/api/v1/investments/monthly-breakdown')
      .query({ year: 2024 })
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    const body = res.body as MonthlyBreakdownBody;
    expect(body.totals.contributed).toBe(800);
    expect(body.totals.deployed).toBe(-200);
    expect(body.totals.uninvestedDelta).toBe(600);
  });

  it('target is null when investmentsPercentage is not configured', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await makeTfsaAccount(app, accessToken);
    await investmentTransactionFixture(accountId, {
      date: '2024-03-01',
      action: 'deposit',
      amount: '500.00',
    });

    const res = await request(app)
      .get('/api/v1/investments/monthly-breakdown')
      .query({ year: 2024 })
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    const body = res.body as MonthlyBreakdownBody;
    expect(body.investmentsPercentage).toBeNull();
    expect(body.months.every((m) => m.target === null)).toBe(true);
    expect(body.totals.target).toBeNull();
  });

  it('target is null when no anticipated budget income entry exists', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await makeTfsaAccount(app, accessToken);
    await investmentTransactionFixture(accountId, {
      date: '2024-03-01',
      action: 'deposit',
      amount: '500.00',
    });
    // Set investmentsPercentage but do NOT create an anticipated budget income entry.
    await request(app)
      .patch('/api/v1/user-config')
      .set(authHeader(accessToken))
      .send({ allocations: { needsPercentage: 50, wantsPercentage: 30, investmentsPercentage: 20 } });

    const res = await request(app)
      .get('/api/v1/investments/monthly-breakdown')
      .query({ year: 2024 })
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    const body = res.body as MonthlyBreakdownBody;
    expect(body.months.every((m) => m.target === null)).toBe(true);
    expect(body.totals.target).toBeNull();
  });

  it('target is non-null and correct when both investmentsPercentage and income are configured', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await makeTfsaAccount(app, accessToken);
    await investmentTransactionFixture(accountId, {
      date: '2024-03-01',
      action: 'deposit',
      amount: '500.00',
    });

    // Set investmentsPercentage to 20%.
    await request(app)
      .patch('/api/v1/user-config')
      .set(authHeader(accessToken))
      .send({ allocations: { needsPercentage: 50, wantsPercentage: 30, investmentsPercentage: 20 } });

    // Create an anticipated budget income entry for 2024: $5000/month.
    await request(app)
      .post('/api/v1/anticipated-budget')
      .set(authHeader(accessToken))
      .send({
        name: 'Salary',
        isIncome: true,
        monthlyAmount: '5000.00',
        effectiveYear: 2024,
        needWant: null,
        categoryId: null,
        notes: null,
      });

    const res = await request(app)
      .get('/api/v1/investments/monthly-breakdown')
      .query({ year: 2024 })
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    const body = res.body as MonthlyBreakdownBody;
    // 5000 * 20% = 1000 per month
    expect(body.months.every((m) => m.target === 1000)).toBe(true);
    // totals.target = 1000 * 12 = 12000
    expect(body.totals.target).toBe(12000);
    expect(body.investmentsPercentage).toBe(20);
  });

  it('totals.target is null if any month has a null target', async () => {
    const { accessToken } = await registerUser(app);
    // investmentsPercentage is not set → all targets null → totals.target null
    const res = await request(app)
      .get('/api/v1/investments/monthly-breakdown')
      .query({ year: 2024 })
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    const body = res.body as MonthlyBreakdownBody;
    expect(body.totals.target).toBeNull();
  });

  it('transactions from another user are not included', async () => {
    const { accessToken: user1Token } = await registerUser(app, 'breakdown-a@example.com');
    const { accessToken: user2Token } = await registerUser(app, 'breakdown-b@example.com');
    const user1Account = await makeTfsaAccount(app, user1Token);
    const user2Account = await makeTfsaAccount(app, user2Token);

    await investmentTransactionFixture(user1Account, {
      date: '2024-01-15',
      action: 'deposit',
      amount: '1000.00',
    });
    await investmentTransactionFixture(user2Account, {
      date: '2024-01-20',
      action: 'deposit',
      amount: '9999.00',
    });

    const res = await request(app)
      .get('/api/v1/investments/monthly-breakdown')
      .query({ year: 2024 })
      .set(authHeader(user1Token));

    expect(res.status).toBe(200);
    const body = res.body as MonthlyBreakdownBody;
    const jan = body.months.find((m) => m.month === 1);
    expect(jan?.contributed).toBe(1000);
    expect(body.totals.contributed).toBe(1000);
  });

  it('non-investment account transactions are not included', async () => {
    const { accessToken } = await registerUser(app);
    const chequingId = await makeChequingAccount(app, accessToken);
    const tfsaId = await makeTfsaAccount(app, accessToken);

    await investmentTransactionFixture(tfsaId, {
      date: '2024-02-01',
      action: 'deposit',
      amount: '750.00',
    });
    // Insert directly into investment_transactions for the chequing account,
    // bypassing the API account-type guard. The breakdown must exclude it
    // because queryInvestmentAccountIds only returns investment-type accounts.
    await investmentTransactionFixture(chequingId, {
      date: '2024-02-15',
      action: 'deposit',
      amount: '9999.00',
    });

    const res = await request(app)
      .get('/api/v1/investments/monthly-breakdown')
      .query({ year: 2024 })
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    const body = res.body as MonthlyBreakdownBody;
    // Only the TFSA transaction should count; the chequing row must be absent.
    expect(body.totals.contributed).toBe(750);
  });

  it('always returns 12 month rows regardless of activity', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .get('/api/v1/investments/monthly-breakdown')
      .query({ year: 2024 })
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    const body = res.body as MonthlyBreakdownBody;
    expect(body.months).toHaveLength(12);
    expect(body.months.map((m) => m.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
});
