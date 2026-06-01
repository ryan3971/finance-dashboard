import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '@/app';
import { cleanDatabase, registerUser } from '@/testing/test-helpers';
import { accountFixture } from '@/testing/fixtures/account.fixture';
import { transactionFixture } from '@/testing/fixtures/transaction.fixture';
import { detectRefunds } from './refund-detection.service';
import { db } from '@/db';
import { rebalancingGroupTransactions, rebalancingGroups } from '@/db/schema';
import { eq } from 'drizzle-orm';

const app = createApp();

beforeEach(() => cleanDatabase());

async function setup() {
  const auth = await registerUser(app);
  const account = await accountFixture(auth.user.id);
  return { auth, account };
}

async function getRefundGroups(userId: string) {
  return db
    .select()
    .from(rebalancingGroups)
    .where(eq(rebalancingGroups.userId, userId));
}

async function getGroupMembers(groupId: string) {
  return db
    .select()
    .from(rebalancingGroupTransactions)
    .where(eq(rebalancingGroupTransactions.groupId, groupId));
}

describe('detectRefunds', () => {
  it('creates one group for a same-account inverse-amount pair within the window', async () => {
    const { auth, account } = await setup();
    const charge = await transactionFixture(account.id, {
      amount: '-50.00',
      date: '2024-01-10',
    });
    const credit = await transactionFixture(account.id, {
      amount: '50.00',
      date: '2024-01-20',
    });

    const result = await detectRefunds(auth.user.id);

    expect(result).toEqual({ created: 1 });

    const groups = await getRefundGroups(auth.user.id);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.type).toBe('refund');
    expect(groups[0]?.status).toBe('open');

    const groupId = groups[0]?.id;
    expect(groupId).toBeDefined();
    const members = await getGroupMembers(groupId as string);
    expect(members).toHaveLength(2);
    const memberIds = members.map((m) => m.transactionId).sort();
    expect(memberIds).toEqual([charge.id, credit.id].sort());
    const source = members.find((m) => m.role === 'source');
    const offset = members.find((m) => m.role === 'offset');
    expect(source?.transactionId).toBe(charge.id);
    expect(offset?.transactionId).toBe(credit.id);
  });

  it('returns 0 when no matching pair exists', async () => {
    const { auth, account } = await setup();
    await transactionFixture(account.id, { amount: '-50.00', date: '2024-01-10' });
    await transactionFixture(account.id, { amount: '-30.00', date: '2024-01-20' });

    const result = await detectRefunds(auth.user.id);
    expect(result).toEqual({ created: 0 });
  });

  it('does not match pairs outside the detection window', async () => {
    const { auth, account } = await setup();
    // 200 days apart — exceeds default 90-day window
    await transactionFixture(account.id, { amount: '-50.00', date: '2023-01-01' });
    await transactionFixture(account.id, { amount: '50.00', date: '2023-07-20' });

    const result = await detectRefunds(auth.user.id);
    expect(result).toEqual({ created: 0 });
  });

  it('does not match pairs on different accounts', async () => {
    const { auth } = await setup();
    const accountB = await accountFixture(auth.user.id);
    const accountC = await accountFixture(auth.user.id);
    await transactionFixture(accountB.id, { amount: '-50.00', date: '2024-01-10' });
    await transactionFixture(accountC.id, { amount: '50.00', date: '2024-01-15' });

    const result = await detectRefunds(auth.user.id);
    expect(result).toEqual({ created: 0 });
  });

  it('skips transactions already confirmed as transfers', async () => {
    const { auth, account } = await setup();
    await transactionFixture(account.id, {
      amount: '-50.00',
      date: '2024-01-10',
      isTransfer: true,
    });
    await transactionFixture(account.id, {
      amount: '50.00',
      date: '2024-01-15',
    });

    const result = await detectRefunds(auth.user.id);
    expect(result).toEqual({ created: 0 });
  });

  it('skips transactions already in a rebalancing group', async () => {
    const { auth, account } = await setup();
    const charge = await transactionFixture(account.id, {
      amount: '-50.00',
      date: '2024-01-10',
    });
    await transactionFixture(account.id, {
      amount: '50.00',
      date: '2024-01-15',
    });

    // Manually add the charge to an existing group
    const [group] = await db
      .insert(rebalancingGroups)
      .values({ userId: auth.user.id, label: 'Existing', type: 'rebalancing', status: 'open' })
      .returning();
    const groupId = group?.id;
    expect(groupId).toBeDefined();
    await db.insert(rebalancingGroupTransactions).values({
      groupId: groupId as string,
      transactionId: charge.id,
      role: 'source',
    });

    const result = await detectRefunds(auth.user.id);
    expect(result).toEqual({ created: 0 });
  });

  it('is idempotent — running twice creates no duplicate groups', async () => {
    const { auth, account } = await setup();
    await transactionFixture(account.id, { amount: '-50.00', date: '2024-01-10' });
    await transactionFixture(account.id, { amount: '50.00', date: '2024-01-20' });

    await detectRefunds(auth.user.id);
    const second = await detectRefunds(auth.user.id);

    expect(second).toEqual({ created: 0 });
    const groups = await getRefundGroups(auth.user.id);
    expect(groups).toHaveLength(1);
  });

  it('detects multiple independent pairs', async () => {
    const { auth, account } = await setup();
    // Pair 1
    await transactionFixture(account.id, { amount: '-50.00', date: '2024-01-10' });
    await transactionFixture(account.id, { amount: '50.00', date: '2024-01-12' });
    // Pair 2
    await transactionFixture(account.id, { amount: '-80.00', date: '2024-02-01' });
    await transactionFixture(account.id, { amount: '80.00', date: '2024-02-05' });

    const result = await detectRefunds(auth.user.id);
    expect(result).toEqual({ created: 2 });
    const groups = await getRefundGroups(auth.user.id);
    expect(groups).toHaveLength(2);
  });

  it('pairs each charge with the closest credit when the same amount recurs monthly', async () => {
    const { auth, account } = await setup();
    // Monthly bank fee + refund pattern: same amount, same account, recurring
    const janCharge = await transactionFixture(account.id, { amount: '-50.00', date: '2024-01-15' });
    const janRefund = await transactionFixture(account.id, { amount: '50.00',  date: '2024-01-20' });
    const febCharge = await transactionFixture(account.id, { amount: '-50.00', date: '2024-02-15' });
    const febRefund = await transactionFixture(account.id, { amount: '50.00',  date: '2024-02-20' });

    const result = await detectRefunds(auth.user.id);
    expect(result).toEqual({ created: 2 });

    const groups = await getRefundGroups(auth.user.id);
    expect(groups).toHaveLength(2);

    // Verify each group pairs the charge and refund from the same month.
    for (const group of groups) {
      const members = await getGroupMembers(group.id);
      const source = members.find((m) => m.role === 'source');
      const offset = members.find((m) => m.role === 'offset');
      expect(source).toBeDefined();
      expect(offset).toBeDefined();
      const isJanPair =
        source?.transactionId === janCharge.id && offset?.transactionId === janRefund.id;
      const isFebPair =
        source?.transactionId === febCharge.id && offset?.transactionId === febRefund.id;
      expect(isJanPair || isFebPair).toBe(true);
    }
  });

  it('does not expose transactions belonging to another user', async () => {
    const { auth } = await setup();
    const otherAuth = await registerUser(app, 'other@example.com');
    const otherAccount = await accountFixture(otherAuth.user.id);

    // Other user has a matching pair
    await transactionFixture(otherAccount.id, { amount: '-50.00', date: '2024-01-10' });
    await transactionFixture(otherAccount.id, { amount: '50.00', date: '2024-01-15' });

    // Our user has nothing
    const result = await detectRefunds(auth.user.id);
    expect(result).toEqual({ created: 0 });

    const groups = await getRefundGroups(auth.user.id);
    expect(groups).toHaveLength(0);
  });
});
