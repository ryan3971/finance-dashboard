import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanDatabase, createAccount, registerUser } from '@/testing/test-helpers';
import { createApp } from '@/app';
import { db } from '@/db';
import { contributionRecords } from '@/db/schema';
import { investmentTransactionFixture } from '@/testing/fixtures/investment-transaction.fixture';
import request from 'supertest';

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

interface TransactionsResponse {
  data: InvestmentTransactionBody[];
  pagination: PaginationMeta;
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

interface SummaryBody {
  year: number;
  dividendsReceived: number;
  feesPaid: number;
  netDeposits: number;
  totalContributions: number;
  totalWithdrawals: number;
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

  it('affects GET /summary totals after a deposit is created', async () => {
    const { accessToken } = await registerUser(app);
    const tfsaId = await makeTfsaAccount(app, accessToken);

    await request(app)
      .post('/api/v1/investments/transactions')
      .set(authHeader(accessToken))
      .send({ accountId: tfsaId, ...validFields, amount: 3000 });

    const summaryRes = await request(app)
      .get('/api/v1/investments/summary')
      .query({ year: 2024 })
      .set(authHeader(accessToken));

    expect(summaryRes.status).toBe(200);
    const summaryBody = summaryRes.body as SummaryBody;
    expect(summaryBody.totalContributions).toBe(3000);
    expect(summaryBody.netDeposits).toBe(3000);
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

// ─── GET /api/v1/investments/summary ─────────────────────────────────────────

describe('GET /api/v1/investments/summary', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app)
      .get('/api/v1/investments/summary')
      .query({ year: 2024 });
    expect(res.status).toBe(401);
  });

  it('returns 400 when year is missing', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .get('/api/v1/investments/summary')
      .set(authHeader(accessToken));
    expect(res.status).toBe(400);
  });

  it('correctly aggregates dividends, fees, contributions, and withdrawals for a year', async () => {
    const { accessToken } = await registerUser(app);
    const tfsaId = await makeTfsaAccount(app, accessToken);
    await investmentTransactionFixture(tfsaId, {
      action: 'deposit',
      amount: '7000.00',
      date: '2024-01-15',
    });
    await investmentTransactionFixture(tfsaId, {
      action: 'dividend',
      amount: '120.00',
      date: '2024-03-01',
    });
    await investmentTransactionFixture(tfsaId, {
      action: 'fee',
      rawAction: 'FCH',
      amount: '-15.00',
      date: '2024-06-30',
    });
    await investmentTransactionFixture(tfsaId, {
      action: 'withdrawal',
      rawAction: 'WDW',
      amount: '-2000.00',
      date: '2024-09-01',
    });
    // Transaction in a different year — must not be included
    await investmentTransactionFixture(tfsaId, {
      action: 'deposit',
      amount: '500.00',
      date: '2023-12-31',
    });

    const res = await request(app)
      .get('/api/v1/investments/summary')
      .query({ year: 2024 })
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    const body = res.body as SummaryBody;
    expect(body.year).toBe(2024);
    expect(body.dividendsReceived).toBe(120);
    expect(body.feesPaid).toBe(15);
    expect(body.totalContributions).toBe(7000);
    expect(body.totalWithdrawals).toBe(2000);
    expect(body.netDeposits).toBe(5000); // 7000 - 2000
  });

  it('scopes to a specific accountId when provided', async () => {
    const { accessToken } = await registerUser(app);
    const tfsaId = await makeTfsaAccount(app, accessToken);
    const rrspId = await makeRrspAccount(app, accessToken);
    await investmentTransactionFixture(tfsaId, {
      action: 'deposit',
      amount: '7000.00',
      date: '2024-01-15',
    });
    await investmentTransactionFixture(rrspId, {
      action: 'deposit',
      amount: '29000.00',
      date: '2024-01-15',
    });

    const res = await request(app)
      .get('/api/v1/investments/summary')
      .query({ year: 2024, accountId: tfsaId })
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    const body = res.body as SummaryBody;
    expect(body.totalContributions).toBe(7000);
    expect(body.netDeposits).toBe(7000);
  });

  it('returns zeros (not null) when no transactions exist for the year', async () => {
    const { accessToken } = await registerUser(app);
    await makeTfsaAccount(app, accessToken);

    const res = await request(app)
      .get('/api/v1/investments/summary')
      .query({ year: 2024 })
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    const body = res.body as SummaryBody;
    expect(body.dividendsReceived).toBe(0);
    expect(body.feesPaid).toBe(0);
    expect(body.netDeposits).toBe(0);
    expect(body.totalContributions).toBe(0);
    expect(body.totalWithdrawals).toBe(0);
  });
});
