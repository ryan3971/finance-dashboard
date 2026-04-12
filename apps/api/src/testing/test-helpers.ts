import {
  accounts,
  anticipatedBudget,
  anticipatedBudgetMonths,
  categories,
  categorizationRules,
  imports,
  investmentTransactions,
  refreshTokens,
  tags,
  transactions,
  userConfig,
  users,
} from '@/db/schema';
import type { Application } from 'express';
import type { AuthResponse } from '@finance/shared/types/auth';
import { db } from '@/db';
import { isNotNull } from 'drizzle-orm';
import request from 'supertest';

export type { AuthResponse };

export interface AccountResponse {
  id: string;
  name: string;
  type: string;
  institution: string;
  isCredit: boolean;
}

export interface ImportSummaryResponse {
  importedCount: number;
  duplicateCount: number;
  errorCount: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    totalPages: number;
  };
}

export interface RegisterResult {
  accessToken: string;
  user: { id: string; email: string };
}

export async function cleanDatabase(): Promise<void> {
  await db.delete(transactions);
  await db.delete(investmentTransactions);
  await db.delete(imports);
  await db.delete(accounts);
  await db.delete(refreshTokens);
  await db.delete(categorizationRules);
  await db.delete(categories).where(isNotNull(categories.userId));
  await db.delete(tags);
  await db.delete(anticipatedBudgetMonths);
  await db.delete(anticipatedBudget);
  await db.delete(userConfig);
  await db.delete(users);
}

export async function registerUser(
  app: Application,
  email = 'test@example.com'
): Promise<RegisterResult> {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'password123' });
  // supertest types res.body as `any`; the cast satisfies no-unsafe-return
  // without hiding a real type gap — the shape is validated by the route's
  // Zod schema before it ever reaches this helper.
  return res.body as RegisterResult;
}

export async function registerAndLogin(
  app: Application,
  email = 'test@example.com'
): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'password123' });
  // Same boundary cast as registerUser: supertest's `any` body requires a cast
  // to satisfy no-unsafe-member-access. The shape is guaranteed by the route.
  return (res.body as AuthResponse).accessToken;
}

export async function createAccount(
  app: Application,
  token: string,
  options: {
    name: string;
    type: string;
    institution: string;
    isCredit?: boolean;
  }
): Promise<string> {
  const res = await request(app)
    .post('/api/v1/accounts')
    .set('Authorization', `Bearer ${token}`)
    .send(options);
  // Same boundary cast: supertest body is `any`; cast required by no-unsafe-member-access.
  return (res.body as AccountResponse).id;
}
