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
import { db } from '@/db';
import { isNotNull } from 'drizzle-orm';
import request from 'supertest';
import type { AuthResponse, AccountResponse, TransactionResponse } from '@/testing/types';

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
): Promise<AuthResponse> {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'password123' });
  // supertest types res.body as `any`; the cast satisfies no-unsafe-return
  // without hiding a real type gap — the shape is validated by the route's
  // Zod schema before it ever reaches this helper.
  return res.body as AuthResponse;
}

// export async function registerAndGetToken(
//   app: Application,
//   email = 'test@example.com',
//   password = 'password123',
//   overrides = {}
// ): Promise<string> {
//   const res = await request(app)
//     .post('/api/v1/auth/register')
//     .send({ email, password, ...overrides });
//   expect(res.status).toBe(201);
//   expect((res.body as AuthResponse).accessToken).toBeDefined();
//   return (res.body as AuthResponse).accessToken;
// }

// Retrieving 500 transactions is a bit hacky but allows us to avoid adding a dedicated test-only route or directly querying the database in tests that need to verify transaction details after an operation like deletion or categorization.
export async function getTransaction(
  app: Application,
  token: string,
  id: string
): Promise<TransactionResponse | undefined> {
  const res = await request(app)
    .get('/api/v1/transactions')
    .set('Authorization', `Bearer ${token}`)
    .query({ limit: 500 });
  const body = res.body as PaginatedResponse<TransactionResponse>;
  return body.data.find((t) => t.id === id);
}

export async function createAccount(
  app: Application,
  token: string,
  options: {
    name: string;
    type: string;
    institution: string;
    isCredit: boolean;
    currency: string;
  }
): Promise<string> {
  const res = await request(app)
    .post('/api/v1/accounts')
    .set('Authorization', `Bearer ${token}`)
    .send(options);
  // Same boundary cast: supertest body is `any`; cast required by no-unsafe-member-access.
  return (res.body as AccountResponse).id;
}

