import { and, eq } from 'drizzle-orm';
import { accounts } from '@/db/schema';
import { db } from '@/db';

export interface CreateAccountInput {
  name: string;
  type: 'chequing' | 'savings' | 'credit' | 'tfsa' | 'fhsa' | 'rrsp' | 'non-registered';
  institution: 'amex' | 'cibc' | 'td' | 'questrade' | 'manual';
  currency: string;
  isCredit: boolean;
}

export async function listAccounts(userId: string) {
  return db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.isActive, true)));
}

export async function createAccount(userId: string, input: CreateAccountInput) {
  const [account] = await db
    .insert(accounts)
    .values({ ...input, userId })
    .returning();
  return account;
}

export async function getAccountById(id: string, userId: string) {
  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .limit(1);
  return account ?? null;
}