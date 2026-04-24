import { and, eq, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  accounts,
  categories,
  rebalancingGroupTransactions,
  rebalancingGroups,
  transactions,
} from '@/db/schema';
import { db } from '@/db';
import Decimal from 'decimal.js';
import type {
  RebalancingGroup,
  RebalancingGroupTransaction,
  RebalancingGroupsResponse,
  RebalancingRole,
  RebalancingStatus,
} from '@finance/shared/types/rebalancing';
import type {
  createRebalancingGroupSchema,
  updateRebalancingGroupSchema,
  addGroupTransactionSchema,
} from '@finance/shared/schemas/rebalancing';
import type { z } from 'zod';
import { RebalancingError, RebalancingErrorCode } from './rebalancing.errors';
import { assertDefined } from '@/lib/assert';
import { updateGroupAfterMemberRemoval } from '@/pipelines/rebalancing/rebalancing-group-hooks';

// ─── Types ────────────────────────────────────────────────────────────────────

type CreateGroupInput = z.infer<typeof createRebalancingGroupSchema>;
type UpdateGroupInput = z.infer<typeof updateRebalancingGroupSchema>;
type AddTransactionInput = z.infer<typeof addGroupTransactionSchema>;

interface GroupRow {
  id: string;
  label: string;
  // Drizzle types text() as string; the DB CHECK constraint ensures this is
  // always a valid RebalancingStatus. The assertion lives in queryGroupRows.
  status: RebalancingStatus;
  myShareOverride: string | null;
  flaggedForReview: boolean;
  createdAt: Date;
}

interface MemberRow {
  groupId: string;
  transactionId: string;
  // Drizzle types text() as string; the DB CHECK constraint ensures this is
  // always a valid RebalancingRole. The assertion lives in queryMemberRows.
  role: RebalancingRole;
  amount: string;
  date: string;
  description: string;
  accountName: string;
  categoryName: string | null;
  subcategoryName: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true when a Postgres unique-violation error is thrown (code 23505). */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: string }).code === '23505'
  );
}

function computeMyShare(
  members: MemberRow[],
  myShareOverride: string | null
): { sourceTotal: number; offsetTotal: number; myShare: number } {
  let sourceTotal = new Decimal(0);
  let offsetTotal = new Decimal(0);

  for (const m of members) {
    if (m.role === 'source') {
      sourceTotal = sourceTotal.plus(new Decimal(m.amount).negated());
    } else {
      offsetTotal = offsetTotal.plus(new Decimal(m.amount));
    }
  }

  const myShare =
    myShareOverride !== null
      ? new Decimal(myShareOverride)
      : Decimal.max(0, sourceTotal.minus(offsetTotal));

  return {
    sourceTotal: sourceTotal.toNumber(),
    offsetTotal: offsetTotal.toNumber(),
    myShare: myShare.toNumber(),
  };
}

function assembleGroup(
  group: GroupRow,
  members: MemberRow[]
): RebalancingGroup {
  const { sourceTotal, offsetTotal, myShare } = computeMyShare(
    members,
    group.myShareOverride
  );

  const groupTransactions: RebalancingGroupTransaction[] = members.map((m) => ({
    transactionId: m.transactionId,
    role: m.role,
    amount: m.amount,
    date: m.date,
    description: m.description,
    accountName: m.accountName,
    categoryName: m.categoryName,
    subcategoryName: m.subcategoryName,
  }));

  return {
    id: group.id,
    label: group.label,
    status: group.status,
    myShareOverride:
      group.myShareOverride !== null
        ? new Decimal(group.myShareOverride).toNumber()
        : null,
    flaggedForReview: group.flaggedForReview,
    createdAt: group.createdAt.toISOString(),
    sourceTotal,
    offsetTotal,
    myShare,
    transactions: groupTransactions,
  };
}

const groupColumns = {
  id: rebalancingGroups.id,
  label: rebalancingGroups.label,
  status: rebalancingGroups.status,
  myShareOverride: rebalancingGroups.myShareOverride,
  flaggedForReview: rebalancingGroups.flaggedForReview,
  createdAt: rebalancingGroups.createdAt,
};

function narrowStatus(status: string): RebalancingStatus {
  if (status !== 'open' && status !== 'resolved')
    throw new Error(`Invalid rebalancing status in DB: ${status}`);
  return status;
}

function narrowRole(role: string): RebalancingRole {
  if (role !== 'source' && role !== 'offset')
    throw new Error(`Invalid rebalancing role in DB: ${role}`);
  return role;
}

/**
 * Fetches group rows for a user, optionally filtered to a single group.
 * The `as unknown as GroupRow[]` cast is safe: the DB CHECK constraint on
 * `status` guarantees it is always a valid RebalancingStatus.
 */
async function queryGroupRows(
  userId: string,
  groupId?: string
): Promise<GroupRow[]> {
  const rows = await db
    .select(groupColumns)
    .from(rebalancingGroups)
    .where(
      groupId
        ? and(
            eq(rebalancingGroups.userId, userId),
            eq(rebalancingGroups.id, groupId)
          )
        : eq(rebalancingGroups.userId, userId)
    )
    .orderBy(rebalancingGroups.createdAt);
  return rows.map((r) => ({ ...r, status: narrowStatus(r.status) }));
}

/**
 * The `as unknown as MemberRow[]` cast is safe: the DB CHECK constraint on
 * `role` guarantees it is always a valid RebalancingRole.
 */
async function queryMemberRows(groupIds: string[]): Promise<MemberRow[]> {
  if (groupIds.length === 0) return [];

  const categoryAlias = alias(categories, 'cat');
  const subcategoryAlias = alias(categories, 'sub');

  const rows = await db
    .select({
      groupId: rebalancingGroupTransactions.groupId,
      transactionId: rebalancingGroupTransactions.transactionId,
      role: rebalancingGroupTransactions.role,
      amount: transactions.amount,
      date: transactions.date,
      description: transactions.description,
      accountName: accounts.name,
      categoryName: categoryAlias.name,
      subcategoryName: subcategoryAlias.name,
    })
    .from(rebalancingGroupTransactions)
    .innerJoin(
      transactions,
      eq(rebalancingGroupTransactions.transactionId, transactions.id)
    )
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .leftJoin(categoryAlias, eq(transactions.categoryId, categoryAlias.id))
    .leftJoin(
      subcategoryAlias,
      eq(transactions.subcategoryId, subcategoryAlias.id)
    )
    .where(inArray(rebalancingGroupTransactions.groupId, groupIds));
  return rows.map((r) => ({ ...r, role: narrowRole(r.role) }));
}

async function verifyTransactionOwnership(
  transactionId: string,
  userId: string
): Promise<{ id: string; amount: string; isIncome: boolean } | null> {
  const [row] = await db
    .select({
      id: transactions.id,
      amount: transactions.amount,
      isIncome: transactions.isIncome,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(and(eq(transactions.id, transactionId), eq(accounts.userId, userId)))
    .limit(1);
  return row ?? null;
}

async function checkExistingMembership(
  transactionId: string
): Promise<string | null> {
  const [row] = await db
    .select({ groupId: rebalancingGroupTransactions.groupId })
    .from(rebalancingGroupTransactions)
    .where(eq(rebalancingGroupTransactions.transactionId, transactionId))
    .limit(1);
  return row?.groupId ?? null;
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listGroups(
  userId: string
): Promise<RebalancingGroupsResponse> {
  const groupRows = await queryGroupRows(userId);
  if (groupRows.length === 0) return { groups: [] };

  const groupIds = groupRows.map((g) => g.id);
  const memberRows = await queryMemberRows(groupIds);

  const membersByGroup = memberRows.reduce<Record<string, MemberRow[]>>(
    (acc, m) => {
      const arr = acc[m.groupId] ?? [];
      acc[m.groupId] = arr;
      arr.push(m);
      return acc;
    },
    {}
  );

  const groups = groupRows.map((g) =>
    assembleGroup(g, membersByGroup[g.id] ?? [])
  );

  return { groups };
}

// ─── Get single ───────────────────────────────────────────────────────────────

export async function getGroup(
  groupId: string,
  userId: string
): Promise<RebalancingGroup | null> {
  const [groupRow] = await queryGroupRows(userId, groupId);
  if (!groupRow) return null;

  const memberRows = await queryMemberRows([groupId]);
  return assembleGroup(groupRow, memberRows);
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createGroup(
  userId: string,
  input: CreateGroupInput
): Promise<RebalancingGroup> {
  const owned = await verifyTransactionOwnership(
    input.initialTransactionId,
    userId
  );
  if (!owned)
    throw new RebalancingError(RebalancingErrorCode.TRANSACTION_NOT_OWNED);

  const existingGroupId = await checkExistingMembership(
    input.initialTransactionId
  );
  if (existingGroupId !== null) {
    throw new RebalancingError(
      RebalancingErrorCode.TRANSACTION_ALREADY_IN_GROUP
    );
  }

  const createdGroupId = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(rebalancingGroups)
      .values({
        userId,
        label: input.label,
        status: 'open' satisfies RebalancingStatus,
        myShareOverride:
          input.myShareOverride !== undefined
            ? String(input.myShareOverride)
            : null,
      })
      .returning({ id: rebalancingGroups.id });

    assertDefined(inserted, 'Expected insert to return a row');

    try {
      await tx.insert(rebalancingGroupTransactions).values({
        groupId: inserted.id,
        transactionId: input.initialTransactionId,
        role: input.role,
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new RebalancingError(
          RebalancingErrorCode.TRANSACTION_ALREADY_IN_GROUP
        );
      }
      throw err;
    }

    return inserted.id;
  });

  const result = await getGroup(createdGroupId, userId);
  if (result === null) {
    // Cannot happen — we just created the group with the same userId
    throw new Error('Group missing immediately after creation');
  }
  return result;
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateGroup(
  groupId: string,
  userId: string,
  patch: UpdateGroupInput
): Promise<RebalancingGroup | null> {
  const [existing] = await db
    .select({ id: rebalancingGroups.id })
    .from(rebalancingGroups)
    .where(
      and(
        eq(rebalancingGroups.id, groupId),
        eq(rebalancingGroups.userId, userId)
      )
    )
    .limit(1);

  if (!existing) return null;

  if (patch.status === 'resolved') {
    const [countRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(rebalancingGroupTransactions)
      .where(
        and(
          eq(rebalancingGroupTransactions.groupId, groupId),
          eq(rebalancingGroupTransactions.role, 'source')
        )
      );
    if (Number(countRow?.count ?? 0) === 0) {
      throw new RebalancingError(RebalancingErrorCode.GROUP_REQUIRES_SOURCE);
    }
  }

  const updateData: Partial<typeof rebalancingGroups.$inferInsert> = {};
  if (patch.label !== undefined) updateData.label = patch.label;
  if (patch.status !== undefined) updateData.status = patch.status;
  if (patch.myShareOverride !== undefined) {
    updateData.myShareOverride =
      patch.myShareOverride !== null ? String(patch.myShareOverride) : null;
  }
  if (patch.flaggedForReview !== undefined) {
    updateData.flaggedForReview = patch.flaggedForReview;
  }

  await db
    .update(rebalancingGroups)
    .set(updateData)
    .where(eq(rebalancingGroups.id, groupId));

  return getGroup(groupId, userId);
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteGroup(
  groupId: string,
  userId: string
): Promise<boolean> {
  const [existing] = await db
    .select({ id: rebalancingGroups.id })
    .from(rebalancingGroups)
    .where(
      and(
        eq(rebalancingGroups.id, groupId),
        eq(rebalancingGroups.userId, userId)
      )
    )
    .limit(1);

  if (!existing) return false;

  await db.delete(rebalancingGroups).where(eq(rebalancingGroups.id, groupId));
  return true;
}

// ─── Add transaction ──────────────────────────────────────────────────────────

export async function addGroupTransaction(
  groupId: string,
  userId: string,
  input: AddTransactionInput
): Promise<RebalancingGroup | null> {
  const [group] = await db
    .select({ id: rebalancingGroups.id })
    .from(rebalancingGroups)
    .where(
      and(
        eq(rebalancingGroups.id, groupId),
        eq(rebalancingGroups.userId, userId)
      )
    )
    .limit(1);

  if (!group) return null;

  const owned = await verifyTransactionOwnership(input.transactionId, userId);
  if (!owned)
    throw new RebalancingError(RebalancingErrorCode.TRANSACTION_NOT_OWNED);

  const existingGroupId = await checkExistingMembership(input.transactionId);
  if (existingGroupId !== null) {
    throw new RebalancingError(
      RebalancingErrorCode.TRANSACTION_ALREADY_IN_GROUP
    );
  }

  try {
    await db.insert(rebalancingGroupTransactions).values({
      groupId,
      transactionId: input.transactionId,
      role: input.role,
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new RebalancingError(
        RebalancingErrorCode.TRANSACTION_ALREADY_IN_GROUP
      );
    }
    throw err;
  }

  return getGroup(groupId, userId);
}

// ─── Remove transaction ───────────────────────────────────────────────────────

export async function removeGroupTransaction(
  groupId: string,
  userId: string,
  transactionId: string
): Promise<RebalancingGroup | null> {
  const [group] = await db
    .select({ id: rebalancingGroups.id })
    .from(rebalancingGroups)
    .where(
      and(
        eq(rebalancingGroups.id, groupId),
        eq(rebalancingGroups.userId, userId)
      )
    )
    .limit(1);

  if (!group) return null;

  const [membership] = await db
    .select({ role: rebalancingGroupTransactions.role })
    .from(rebalancingGroupTransactions)
    .where(
      and(
        eq(rebalancingGroupTransactions.groupId, groupId),
        eq(rebalancingGroupTransactions.transactionId, transactionId)
      )
    )
    .limit(1);

  // If the transaction isn't a member, treat the remove as a no-op and return
  // the current group — consistent with idempotent REST DELETE semantics.
  // The router already confirmed the group exists; the group is already in
  // its correct final state.
  if (!membership) return getGroup(groupId, userId);

  await db.transaction(async (tx) => {
    await tx
      .delete(rebalancingGroupTransactions)
      .where(
        and(
          eq(rebalancingGroupTransactions.groupId, groupId),
          eq(rebalancingGroupTransactions.transactionId, transactionId)
        )
      );
    await updateGroupAfterMemberRemoval(
      tx,
      groupId,
      membership.role as RebalancingRole
    );
  });

  return getGroup(groupId, userId);
}
