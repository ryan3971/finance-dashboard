import type { AccountType, Institution } from '@finance/shared/constants';
import { and, eq } from 'drizzle-orm';
import { accounts } from '@/db/schema';
import { db } from '@/db';
import { Decimal } from 'decimal.js';

interface CreateAccountInput {
  name: string;
  type: AccountType;
  institution: Institution;
  currency: string;
  initialBalance?: number;
}

interface UpdateAccountInput {
  name?: string;
  institution?: Institution;
  type?: AccountType;
  currency?: string;
  isCredit?: boolean;
  initialBalance?: number;
}

const accountColumns = {
  id: accounts.id,
  name: accounts.name,
  type: accounts.type,
  institution: accounts.institution,
  currency: accounts.currency,
  isActive: accounts.isActive,
  isCredit: accounts.isCredit,
  initialBalance: accounts.initialBalance,
  createdAt: accounts.createdAt,
};

function normalizeAccount(row: {
  id: string;
  name: string;
  type: string;
  institution: string;
  currency: string;
  isActive: boolean;
  isCredit: boolean;
  initialBalance: string;
  createdAt: Date;
}) {
  return { ...row, initialBalance: new Decimal(row.initialBalance).toNumber() };
}

export async function listAccounts(
  userId: string,
  options?: { includeInactive?: boolean }
) {
  const where = options?.includeInactive
    ? eq(accounts.userId, userId)
    : and(eq(accounts.userId, userId), eq(accounts.isActive, true));
  const rows = await db.select(accountColumns).from(accounts).where(where);
  return rows.map(normalizeAccount);
}

export async function createAccount(userId: string, input: CreateAccountInput) {
  const [account] = await db
    .insert(accounts)
    .values({
      ...input,
      userId,
      isCredit: input.type === 'credit',
      initialBalance: String(input.initialBalance ?? 0),
    })
    .returning(accountColumns);
  if (!account) throw new Error('Insert did not return account row');
  return normalizeAccount(account);
}

export async function getAccountById(id: string, userId: string) {
  const [account] = await db
    .select(accountColumns)
    .from(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .limit(1);
  return account ? normalizeAccount(account) : null;
}

export async function updateAccount(
  id: string,
  userId: string,
  input: UpdateAccountInput
) {
  const { initialBalance, ...rest } = input;
  const patch: {
    name?: string;
    institution?: Institution;
    type?: AccountType;
    currency?: string;
    isCredit?: boolean;
    initialBalance?: string;
  } = { ...rest };
  if (input.type !== undefined && input.isCredit === undefined) {
    patch.isCredit = input.type === 'credit';
  }
  if (initialBalance !== undefined) {
    patch.initialBalance = String(initialBalance);
  }
  const [updated] = await db
    .update(accounts)
    .set(patch)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .returning(accountColumns);
  return updated ? normalizeAccount(updated) : null;
}

async function setAccountActive(id: string, userId: string, isActive: boolean) {
  const [updated] = await db
    .update(accounts)
    .set({ isActive })
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .returning(accountColumns);
  return updated ? normalizeAccount(updated) : null;
}

export const deactivateAccount = (id: string, userId: string) =>
  setAccountActive(id, userId, false);

export const reactivateAccount = (id: string, userId: string) =>
  setAccountActive(id, userId, true);
