import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '@/app';
import request from 'supertest';
import { cleanDatabase, registerUser } from '@/testing/test-helpers';
import { UNKNOWN_ID, MALFORMED_ID } from '@/testing/constants';
import { accountFixture } from '@/testing/fixtures/account.fixture';
import { transactionFixture } from '@/testing/fixtures/transaction.fixture';

const app = createApp();

beforeEach(() => cleanDatabase());

// ─── Local types ──────────────────────────────────────────────────────────────

interface GroupTransaction {
  transactionId: string;
  role: 'source' | 'offset';
  amount: string;
  date: string;
  description: string;
  accountName: string;
  categoryName: string | null;
  subcategoryName: string | null;
}

interface RebalancingGroup {
  id: string;
  label: string;
  status: 'open' | 'resolved';
  myShareOverride: number | null;
  flaggedForReview: boolean;
  createdAt: string;
  sourceTotal: number;
  offsetTotal: number;
  myShare: number;
  transactions: GroupTransaction[];
}

interface GroupsResponse {
  groups: RebalancingGroup[];
}

// ─── Setup helpers ─────────────────────────────────────────────────────────────

async function setup() {
  const auth = await registerUser(app);
  const account = await accountFixture(auth.user.id);
  return { auth, account };
}

async function createGroup(
  token: string,
  transactionId: string,
  options: { label?: string; role?: 'source' | 'offset'; myShareOverride?: number } = {}
): Promise<RebalancingGroup> {
  const res = await request(app)
    .post('/api/v1/rebalancing/groups')
    .set('Authorization', `Bearer ${token}`)
    .send({
      label: options.label ?? 'Test Group',
      initialTransactionId: transactionId,
      role: options.role ?? 'source',
      ...(options.myShareOverride !== undefined
        ? { myShareOverride: options.myShareOverride }
        : {}),
    });
  if (res.status !== 201) {
    throw new Error(`createGroup failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body as RebalancingGroup;
}

async function addTransaction(
  token: string,
  groupId: string,
  transactionId: string,
  role: 'source' | 'offset'
): Promise<void> {
  const res = await request(app)
    .post(`/api/v1/rebalancing/groups/${groupId}/transactions`)
    .set('Authorization', `Bearer ${token}`)
    .send({ transactionId, role });
  if (res.status !== 201) {
    throw new Error(`addTransaction failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
}

// ─── GET /api/v1/rebalancing/groups ───────────────────────────────────────────

describe('GET /api/v1/rebalancing/groups', () => {
  it('returns 401 without an auth token', async () => {
    const res = await request(app).get('/api/v1/rebalancing/groups');
    expect(res.status).toBe(401);
  });

  it('returns an empty list when no groups exist', async () => {
    const { auth } = await setup();
    const res = await request(app)
      .get('/api/v1/rebalancing/groups')
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(res.status).toBe(200);
    expect((res.body as GroupsResponse).groups).toHaveLength(0);
  });

  it('returns groups with computed sourceTotal, offsetTotal, and myShare', async () => {
    const { auth, account } = await setup();
    // source: -120 → contributes 120 to sourceTotal
    // offset:  +40 → contributes  40 to offsetTotal
    // myShare = max(0, 120 - 40) = 80
    const source = await transactionFixture(account.id, { amount: '-120.00' });
    const offset = await transactionFixture(account.id, { amount: '40.00' });
    const group = await createGroup(auth.accessToken, source.id);
    await addTransaction(auth.accessToken, group.id, offset.id, 'offset');

    const res = await request(app)
      .get('/api/v1/rebalancing/groups')
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(res.status).toBe(200);
    const body = res.body as GroupsResponse;
    expect(body.groups).toHaveLength(1);
    expect(body.groups[0]).toMatchObject({
      sourceTotal: 120,
      offsetTotal: 40,
      myShare: 80,
    });
    expect(body.groups[0]?.transactions).toHaveLength(2);
  });

  it('only returns groups belonging to the authenticated user', async () => {
    const { auth, account } = await setup();
    const txn = await transactionFixture(account.id);
    await createGroup(auth.accessToken, txn.id);

    const otherAuth = await registerUser(app, 'other@example.com');
    const res = await request(app)
      .get('/api/v1/rebalancing/groups')
      .set('Authorization', `Bearer ${otherAuth.accessToken}`);

    expect((res.body as GroupsResponse).groups).toHaveLength(0);
  });
});

// ─── POST /api/v1/rebalancing/groups ──────────────────────────────────────────

describe('POST /api/v1/rebalancing/groups', () => {
  it('returns 401 without an auth token', async () => {
    const res = await request(app)
      .post('/api/v1/rebalancing/groups')
      .send({ label: 'Test', initialTransactionId: UNKNOWN_ID, role: 'source' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when label is missing', async () => {
    const { auth, account } = await setup();
    const txn = await transactionFixture(account.id);
    const res = await request(app)
      .post('/api/v1/rebalancing/groups')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ initialTransactionId: txn.id, role: 'source' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when initialTransactionId is missing', async () => {
    const { auth } = await setup();
    const res = await request(app)
      .post('/api/v1/rebalancing/groups')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ label: 'Test', role: 'source' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for a malformed initialTransactionId', async () => {
    const { auth } = await setup();
    const res = await request(app)
      .post('/api/v1/rebalancing/groups')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ label: 'Test', initialTransactionId: MALFORMED_ID, role: 'source' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid role', async () => {
    const { auth, account } = await setup();
    const txn = await transactionFixture(account.id);
    const res = await request(app)
      .post('/api/v1/rebalancing/groups')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ label: 'Test', initialTransactionId: txn.id, role: 'unknown' });
    expect(res.status).toBe(400);
  });

  it('returns 403 when the transaction does not exist', async () => {
    const { auth } = await setup();
    const res = await request(app)
      .post('/api/v1/rebalancing/groups')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ label: 'Test', initialTransactionId: UNKNOWN_ID, role: 'source' });
    expect(res.status).toBe(403);
  });

  it('returns 403 when the transaction belongs to another user', async () => {
    const { auth } = await setup();
    const otherAuth = await registerUser(app, 'other@example.com');
    const otherAccount = await accountFixture(otherAuth.user.id);
    const otherTxn = await transactionFixture(otherAccount.id);

    const res = await request(app)
      .post('/api/v1/rebalancing/groups')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ label: 'Test', initialTransactionId: otherTxn.id, role: 'source' });
    expect(res.status).toBe(403);
  });

  it('returns 409 when the transaction is already in a group', async () => {
    const { auth, account } = await setup();
    const txn = await transactionFixture(account.id);
    await createGroup(auth.accessToken, txn.id);

    const res = await request(app)
      .post('/api/v1/rebalancing/groups')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ label: 'Second Group', initialTransactionId: txn.id, role: 'source' });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      error: 'Transaction already belongs to a rebalancing group',
    });
  });

  it('returns 201 with the created group and computed totals', async () => {
    const { auth, account } = await setup();
    const txn = await transactionFixture(account.id, { amount: '-75.00' });

    const res = await request(app)
      .post('/api/v1/rebalancing/groups')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ label: 'Dinner split', initialTransactionId: txn.id, role: 'source' });

    expect(res.status).toBe(201);
    const body = res.body as RebalancingGroup;
    expect(body).toMatchObject({
      label: 'Dinner split',
      status: 'open',
      flaggedForReview: false,
      myShareOverride: null,
      sourceTotal: 75,
      offsetTotal: 0,
      myShare: 75,
    });
    expect(body.id).toBeDefined();
    expect(body.transactions).toHaveLength(1);
    expect(body.transactions[0]).toMatchObject({ transactionId: txn.id, role: 'source' });
  });

  it('applies myShareOverride when provided', async () => {
    const { auth, account } = await setup();
    const txn = await transactionFixture(account.id, { amount: '-100.00' });

    const res = await request(app)
      .post('/api/v1/rebalancing/groups')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ label: 'Rent split', initialTransactionId: txn.id, role: 'source', myShareOverride: 60 });

    expect(res.status).toBe(201);
    const body = res.body as RebalancingGroup;
    expect(body.myShareOverride).toBe(60);
    expect(body.myShare).toBe(60);
  });
});

// ─── GET /api/v1/rebalancing/groups/:id ───────────────────────────────────────

describe('GET /api/v1/rebalancing/groups/:id', () => {
  it('returns 401 without an auth token', async () => {
    const res = await request(app).get(`/api/v1/rebalancing/groups/${UNKNOWN_ID}`);
    expect(res.status).toBe(401);
  });

  it('returns 400 for a malformed id', async () => {
    const { auth } = await setup();
    const res = await request(app)
      .get(`/api/v1/rebalancing/groups/${MALFORMED_ID}`)
      .set('Authorization', `Bearer ${auth.accessToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown id', async () => {
    const { auth } = await setup();
    const res = await request(app)
      .get(`/api/v1/rebalancing/groups/${UNKNOWN_ID}`)
      .set('Authorization', `Bearer ${auth.accessToken}`);
    expect(res.status).toBe(404);
  });

  it('returns 404 when the group belongs to another user', async () => {
    const { auth, account } = await setup();
    const txn = await transactionFixture(account.id);
    const group = await createGroup(auth.accessToken, txn.id);

    const otherAuth = await registerUser(app, 'other@example.com');
    const res = await request(app)
      .get(`/api/v1/rebalancing/groups/${group.id}`)
      .set('Authorization', `Bearer ${otherAuth.accessToken}`);
    expect(res.status).toBe(404);
  });

  it('returns 200 with the group', async () => {
    const { auth, account } = await setup();
    const txn = await transactionFixture(account.id);
    const group = await createGroup(auth.accessToken, txn.id, { label: 'My Group' });

    const res = await request(app)
      .get(`/api/v1/rebalancing/groups/${group.id}`)
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: group.id, label: 'My Group' });
  });
});

// ─── PATCH /api/v1/rebalancing/groups/:id ─────────────────────────────────────

describe('PATCH /api/v1/rebalancing/groups/:id', () => {
  it('returns 401 without an auth token', async () => {
    const res = await request(app)
      .patch(`/api/v1/rebalancing/groups/${UNKNOWN_ID}`)
      .send({ label: 'Updated' });
    expect(res.status).toBe(401);
  });

  it('returns 400 for a malformed id', async () => {
    const { auth } = await setup();
    const res = await request(app)
      .patch(`/api/v1/rebalancing/groups/${MALFORMED_ID}`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ label: 'Updated' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for an empty body', async () => {
    const { auth, account } = await setup();
    const txn = await transactionFixture(account.id);
    const group = await createGroup(auth.accessToken, txn.id);

    const res = await request(app)
      .patch(`/api/v1/rebalancing/groups/${group.id}`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown id', async () => {
    const { auth } = await setup();
    const res = await request(app)
      .patch(`/api/v1/rebalancing/groups/${UNKNOWN_ID}`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ label: 'Updated' });
    expect(res.status).toBe(404);
  });

  it('returns 404 when the group belongs to another user', async () => {
    const { auth, account } = await setup();
    const txn = await transactionFixture(account.id);
    const group = await createGroup(auth.accessToken, txn.id);

    const otherAuth = await registerUser(app, 'other@example.com');
    const res = await request(app)
      .patch(`/api/v1/rebalancing/groups/${group.id}`)
      .set('Authorization', `Bearer ${otherAuth.accessToken}`)
      .send({ label: 'Updated' });
    expect(res.status).toBe(404);
  });

  it('returns 422 when resolving a group with no source transactions', async () => {
    const { auth, account } = await setup();
    const txn = await transactionFixture(account.id, { amount: '50.00' });
    const group = await createGroup(auth.accessToken, txn.id, { role: 'offset' });

    const res = await request(app)
      .patch(`/api/v1/rebalancing/groups/${group.id}`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ status: 'resolved' });

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({
      error: 'A resolved group must have at least one source transaction',
    });
  });

  it('updates the label', async () => {
    const { auth, account } = await setup();
    const txn = await transactionFixture(account.id);
    const group = await createGroup(auth.accessToken, txn.id);

    const res = await request(app)
      .patch(`/api/v1/rebalancing/groups/${group.id}`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ label: 'Renamed Group' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ label: 'Renamed Group' });
  });

  it('resolves a group that has at least one source transaction', async () => {
    const { auth, account } = await setup();
    const txn = await transactionFixture(account.id, { amount: '-50.00' });
    const group = await createGroup(auth.accessToken, txn.id, { role: 'source' });

    const res = await request(app)
      .patch(`/api/v1/rebalancing/groups/${group.id}`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ status: 'resolved' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'resolved' });
  });

  it('sets myShareOverride and overrides the computed myShare', async () => {
    const { auth, account } = await setup();
    const txn = await transactionFixture(account.id, { amount: '-100.00' });
    const group = await createGroup(auth.accessToken, txn.id);

    const res = await request(app)
      .patch(`/api/v1/rebalancing/groups/${group.id}`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ myShareOverride: 45 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ myShareOverride: 45, myShare: 45 });
  });

  it('clears myShareOverride and falls back to the computed myShare', async () => {
    const { auth, account } = await setup();
    const txn = await transactionFixture(account.id, { amount: '-100.00' });
    const group = await createGroup(auth.accessToken, txn.id, { myShareOverride: 45 });

    const res = await request(app)
      .patch(`/api/v1/rebalancing/groups/${group.id}`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ myShareOverride: null });

    expect(res.status).toBe(200);
    const body = res.body as RebalancingGroup;
    expect(body.myShareOverride).toBeNull();
    expect(body.myShare).toBe(100); // sourceTotal with no offsets
  });

  it('clears flaggedForReview', async () => {
    const { auth, account } = await setup();
    const source = await transactionFixture(account.id, { amount: '-60.00' });
    const offset = await transactionFixture(account.id, { amount: '20.00' });
    const group = await createGroup(auth.accessToken, source.id);
    await addTransaction(auth.accessToken, group.id, offset.id, 'offset');

    // Remove the offset transaction to trigger flaggedForReview
    await request(app)
      .delete(`/api/v1/rebalancing/groups/${group.id}/transactions/${offset.id}`)
      .set('Authorization', `Bearer ${auth.accessToken}`);

    const res = await request(app)
      .patch(`/api/v1/rebalancing/groups/${group.id}`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ flaggedForReview: false });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ flaggedForReview: false });
  });
});

// ─── DELETE /api/v1/rebalancing/groups/:id ────────────────────────────────────

describe('DELETE /api/v1/rebalancing/groups/:id', () => {
  it('returns 401 without an auth token', async () => {
    const res = await request(app).delete(`/api/v1/rebalancing/groups/${UNKNOWN_ID}`);
    expect(res.status).toBe(401);
  });

  it('returns 400 for a malformed id', async () => {
    const { auth } = await setup();
    const res = await request(app)
      .delete(`/api/v1/rebalancing/groups/${MALFORMED_ID}`)
      .set('Authorization', `Bearer ${auth.accessToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown id', async () => {
    const { auth } = await setup();
    const res = await request(app)
      .delete(`/api/v1/rebalancing/groups/${UNKNOWN_ID}`)
      .set('Authorization', `Bearer ${auth.accessToken}`);
    expect(res.status).toBe(404);
  });

  it('returns 404 when the group belongs to another user', async () => {
    const { auth, account } = await setup();
    const txn = await transactionFixture(account.id);
    const group = await createGroup(auth.accessToken, txn.id);

    const otherAuth = await registerUser(app, 'other@example.com');
    const res = await request(app)
      .delete(`/api/v1/rebalancing/groups/${group.id}`)
      .set('Authorization', `Bearer ${otherAuth.accessToken}`);
    expect(res.status).toBe(404);
  });

  it('returns 204 and the group is no longer accessible', async () => {
    const { auth, account } = await setup();
    const txn = await transactionFixture(account.id);
    const group = await createGroup(auth.accessToken, txn.id);

    const res = await request(app)
      .delete(`/api/v1/rebalancing/groups/${group.id}`)
      .set('Authorization', `Bearer ${auth.accessToken}`);
    expect(res.status).toBe(204);

    const getRes = await request(app)
      .get(`/api/v1/rebalancing/groups/${group.id}`)
      .set('Authorization', `Bearer ${auth.accessToken}`);
    expect(getRes.status).toBe(404);
  });
});

// ─── POST /api/v1/rebalancing/groups/:id/transactions ─────────────────────────

describe('POST /api/v1/rebalancing/groups/:id/transactions', () => {
  it('returns 401 without an auth token', async () => {
    const res = await request(app)
      .post(`/api/v1/rebalancing/groups/${UNKNOWN_ID}/transactions`)
      .send({ transactionId: UNKNOWN_ID, role: 'offset' });
    expect(res.status).toBe(401);
  });

  it('returns 400 for a malformed group id', async () => {
    const { auth } = await setup();
    const res = await request(app)
      .post(`/api/v1/rebalancing/groups/${MALFORMED_ID}/transactions`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ transactionId: UNKNOWN_ID, role: 'offset' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for a malformed transactionId', async () => {
    const { auth, account } = await setup();
    const txn = await transactionFixture(account.id);
    const group = await createGroup(auth.accessToken, txn.id);

    const res = await request(app)
      .post(`/api/v1/rebalancing/groups/${group.id}/transactions`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ transactionId: MALFORMED_ID, role: 'offset' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid role', async () => {
    const { auth, account } = await setup();
    const source = await transactionFixture(account.id);
    const extra = await transactionFixture(account.id);
    const group = await createGroup(auth.accessToken, source.id);

    const res = await request(app)
      .post(`/api/v1/rebalancing/groups/${group.id}/transactions`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ transactionId: extra.id, role: 'invalid' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when the group does not exist', async () => {
    const { auth, account } = await setup();
    const txn = await transactionFixture(account.id);

    const res = await request(app)
      .post(`/api/v1/rebalancing/groups/${UNKNOWN_ID}/transactions`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ transactionId: txn.id, role: 'offset' });
    expect(res.status).toBe(404);
  });

  it('returns 403 when the transaction does not belong to the user', async () => {
    const { auth, account } = await setup();
    const source = await transactionFixture(account.id);
    const group = await createGroup(auth.accessToken, source.id);

    const otherAuth = await registerUser(app, 'other@example.com');
    const otherAccount = await accountFixture(otherAuth.user.id);
    const otherTxn = await transactionFixture(otherAccount.id);

    const res = await request(app)
      .post(`/api/v1/rebalancing/groups/${group.id}/transactions`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ transactionId: otherTxn.id, role: 'offset' });
    expect(res.status).toBe(403);
  });

  it('returns 409 when the transaction is already in a different group', async () => {
    const { auth, account } = await setup();
    const source1 = await transactionFixture(account.id);
    const source2 = await transactionFixture(account.id);
    const group1 = await createGroup(auth.accessToken, source1.id);
    await createGroup(auth.accessToken, source2.id); // source2 now belongs to group2

    const res = await request(app)
      .post(`/api/v1/rebalancing/groups/${group1.id}/transactions`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ transactionId: source2.id, role: 'offset' });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      error: 'Transaction already belongs to a rebalancing group',
    });
  });

  it('returns 201 with the updated group and recalculated totals', async () => {
    const { auth, account } = await setup();
    const source = await transactionFixture(account.id, { amount: '-90.00' });
    const offset = await transactionFixture(account.id, { amount: '30.00' });
    const group = await createGroup(auth.accessToken, source.id);

    const res = await request(app)
      .post(`/api/v1/rebalancing/groups/${group.id}/transactions`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ transactionId: offset.id, role: 'offset' });

    expect(res.status).toBe(201);
    const body = res.body as RebalancingGroup;
    expect(body.transactions).toHaveLength(2);
    expect(body).toMatchObject({ sourceTotal: 90, offsetTotal: 30, myShare: 60 });
  });
});

// ─── DELETE /api/v1/rebalancing/groups/:id/transactions/:transactionId ─────────

describe('DELETE /api/v1/rebalancing/groups/:id/transactions/:transactionId', () => {
  it('returns 401 without an auth token', async () => {
    const res = await request(app)
      .delete(`/api/v1/rebalancing/groups/${UNKNOWN_ID}/transactions/${UNKNOWN_ID}`);
    expect(res.status).toBe(401);
  });

  it('returns 400 for a malformed group id', async () => {
    const { auth } = await setup();
    const res = await request(app)
      .delete(`/api/v1/rebalancing/groups/${MALFORMED_ID}/transactions/${UNKNOWN_ID}`)
      .set('Authorization', `Bearer ${auth.accessToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 400 for a malformed transactionId', async () => {
    const { auth, account } = await setup();
    const txn = await transactionFixture(account.id);
    const group = await createGroup(auth.accessToken, txn.id);

    const res = await request(app)
      .delete(`/api/v1/rebalancing/groups/${group.id}/transactions/${MALFORMED_ID}`)
      .set('Authorization', `Bearer ${auth.accessToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 404 when the group does not exist', async () => {
    const { auth } = await setup();
    const res = await request(app)
      .delete(`/api/v1/rebalancing/groups/${UNKNOWN_ID}/transactions/${UNKNOWN_ID}`)
      .set('Authorization', `Bearer ${auth.accessToken}`);
    expect(res.status).toBe(404);
  });

  it('returns 200 as a no-op when the transaction is not in the group', async () => {
    const { auth, account } = await setup();
    const source = await transactionFixture(account.id);
    const unrelated = await transactionFixture(account.id);
    const group = await createGroup(auth.accessToken, source.id);

    const res = await request(app)
      .delete(`/api/v1/rebalancing/groups/${group.id}/transactions/${unrelated.id}`)
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(res.status).toBe(200);
    expect((res.body as RebalancingGroup).transactions).toHaveLength(1);
  });

  it('removes the transaction and flags the group for review', async () => {
    const { auth, account } = await setup();
    const source = await transactionFixture(account.id, { amount: '-80.00' });
    const offset = await transactionFixture(account.id, { amount: '20.00' });
    const group = await createGroup(auth.accessToken, source.id);
    await addTransaction(auth.accessToken, group.id, offset.id, 'offset');

    const res = await request(app)
      .delete(`/api/v1/rebalancing/groups/${group.id}/transactions/${offset.id}`)
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(res.status).toBe(200);
    const body = res.body as RebalancingGroup;
    expect(body.flaggedForReview).toBe(true);
    expect(body.transactions).toHaveLength(1);
    expect(body.transactions[0]?.transactionId).toBe(source.id);
  });

  it('reverts status to open when the last source transaction is removed', async () => {
    const { auth, account } = await setup();
    const source = await transactionFixture(account.id, { amount: '-60.00' });
    const group = await createGroup(auth.accessToken, source.id, { role: 'source' });

    // Resolve the group first
    await request(app)
      .patch(`/api/v1/rebalancing/groups/${group.id}`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ status: 'resolved' });

    const res = await request(app)
      .delete(`/api/v1/rebalancing/groups/${group.id}/transactions/${source.id}`)
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(res.status).toBe(200);
    const body = res.body as RebalancingGroup;
    expect(body.status).toBe('open');
    expect(body.flaggedForReview).toBe(true);
    expect(body.transactions).toHaveLength(0);
  });
});

// ─── Side effects: deleting a transaction that belongs to a group ─────────────

describe('DELETE /api/v1/transactions/:id — rebalancing side effects', () => {
  it('flags the group for review when a member transaction is deleted', async () => {
    const { auth, account } = await setup();
    const source = await transactionFixture(account.id, { amount: '-100.00' });
    const offset = await transactionFixture(account.id, { amount: '40.00' });
    const group = await createGroup(auth.accessToken, source.id);
    await addTransaction(auth.accessToken, group.id, offset.id, 'offset');

    await request(app)
      .delete(`/api/v1/transactions/${offset.id}`)
      .set('Authorization', `Bearer ${auth.accessToken}`);

    const groupRes = await request(app)
      .get(`/api/v1/rebalancing/groups/${group.id}`)
      .set('Authorization', `Bearer ${auth.accessToken}`);
    const updated = groupRes.body as RebalancingGroup;
    expect(updated.flaggedForReview).toBe(true);
    expect(updated.transactions).toHaveLength(1);
  });

  it('reverts status to open when the last source transaction is deleted', async () => {
    const { auth, account } = await setup();
    const source = await transactionFixture(account.id, { amount: '-50.00' });
    const group = await createGroup(auth.accessToken, source.id, { role: 'source' });

    await request(app)
      .patch(`/api/v1/rebalancing/groups/${group.id}`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ status: 'resolved' });

    await request(app)
      .delete(`/api/v1/transactions/${source.id}`)
      .set('Authorization', `Bearer ${auth.accessToken}`);

    const groupRes = await request(app)
      .get(`/api/v1/rebalancing/groups/${group.id}`)
      .set('Authorization', `Bearer ${auth.accessToken}`);
    const updated = groupRes.body as RebalancingGroup;
    expect(updated.status).toBe('open');
    expect(updated.flaggedForReview).toBe(true);
    expect(updated.transactions).toHaveLength(0);
  });
});

// ─── Transaction list: rebalancing fields ─────────────────────────────────────

describe('GET /api/v1/transactions — rebalancing fields', () => {
  it('exposes rebalancingGroupId and rebalancingRole on member transactions, null on others', async () => {
    const { auth, account } = await setup();
    const source = await transactionFixture(account.id, { amount: '-50.00' });
    const unrelated = await transactionFixture(account.id, { amount: '-20.00' });
    const group = await createGroup(auth.accessToken, source.id, { role: 'source' });

    const res = await request(app)
      .get('/api/v1/transactions')
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(res.status).toBe(200);

    interface TxnRow {
      id: string;
      rebalancingGroupId: string | null;
      rebalancingRole: string | null;
    }
    const body = res.body as { data: TxnRow[] };
    const sourceTxn = body.data.find((t) => t.id === source.id);
    const unrelatedTxn = body.data.find((t) => t.id === unrelated.id);

    expect(sourceTxn?.rebalancingGroupId).toBe(group.id);
    expect(sourceTxn?.rebalancingRole).toBe('source');
    expect(unrelatedTxn?.rebalancingGroupId).toBeNull();
    expect(unrelatedTxn?.rebalancingRole).toBeNull();
  });
});
