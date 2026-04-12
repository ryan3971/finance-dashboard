import type { AccountType, Institution } from '@finance/shared/constants';
import { and, eq } from 'drizzle-orm';
import { accounts } from '@/db/schema';
import { db } from '@/db';

interface CreateAccountInput {
  name: string;
  type: AccountType;
  institution: Institution;
  currency: string;
}

interface UpdateAccountInput {
  name?: string;
  institution?: Institution;
  type?: AccountType;
  currency?: string;
  isCredit?: boolean;
}

const accountColumns = {
  id: accounts.id,
  name: accounts.name,
  type: accounts.type,
  institution: accounts.institution,
  currency: accounts.currency,
  isActive: accounts.isActive,
  isCredit: accounts.isCredit,
  createdAt: accounts.createdAt,
};

export async function listAccounts(
  userId: string,
  options?: { includeInactive?: boolean }
) {
  const where = options?.includeInactive
    ? eq(accounts.userId, userId)
    : and(eq(accounts.userId, userId), eq(accounts.isActive, true));
  return db.select(accountColumns).from(accounts).where(where);
}

export async function createAccount(userId: string, input: CreateAccountInput) {
  const [account] = await db
    .insert(accounts)
    .values({ ...input, userId, isCredit: input.type === 'credit' })
    .returning(accountColumns);
  return account;
}

export async function getAccountById(id: string, userId: string) {
  const [account] = await db
    .select(accountColumns)
    .from(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .limit(1);
  return account ?? null;
}

export async function updateAccount(
  id: string,
  userId: string,
  input: UpdateAccountInput
) {
  const patch = { ...input };
  if (input.type !== undefined && input.isCredit === undefined) {
    patch.isCredit = input.type === 'credit';
  }
  const [updated] = await db
    .update(accounts)
    .set(patch)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .returning(accountColumns);
  return updated ?? null;
}

async function setAccountActive(id: string, userId: string, isActive: boolean) {
  const [updated] = await db
    .update(accounts)
    .set({ isActive })
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .returning(accountColumns);
  return updated ?? null;
}

export const deactivateAccount = (id: string, userId: string) =>
  setAccountActive(id, userId, false);

export const reactivateAccount = (id: string, userId: string) =>
  setAccountActive(id, userId, true);
