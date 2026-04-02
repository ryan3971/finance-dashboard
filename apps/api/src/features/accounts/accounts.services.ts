/**
 * Account services — DB queries and business logic for the accounts feature.
 *
 * All functions scope queries to the authenticated user's ID to prevent
 * cross-user data access. Functions return data or null; the route layer is
 * responsible for translating null into 404 responses.
 */
import { and, eq } from 'drizzle-orm';
import { accounts } from '@/db/schema';
import { db } from '@/db';

interface CreateAccountInput {
  name: string;
  type: 'chequing' | 'savings' | 'credit' | 'tfsa' | 'fhsa' | 'rrsp' | 'non-registered';
  institution: 'amex' | 'cibc' | 'td' | 'questrade' | 'manual';
  currency: string;
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

export async function listAccounts(userId: string) {
  return db
    .select(accountColumns)
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.isActive, true)));
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
