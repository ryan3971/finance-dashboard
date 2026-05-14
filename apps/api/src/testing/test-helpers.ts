import * as path from 'path';
import {
  accounts,
  anticipatedBudget,
  categories,
  categorizationRules,
  contributionRecords,
  imports,
  investmentSnapshots,
  investmentTransactions,
  rebalancingGroups,
  refreshTokens,
  tags,
  transactions,
  userConfig,
  users,
} from '@/db/schema';
import type { Application } from 'express';
import { db } from '@/db';
import { eq, inArray } from 'drizzle-orm';
import request from 'supertest';
import type {
  AuthResponse,
  AccountResponse,
  TransactionResponse,
  PaginatedResponse,
} from '@/testing/types';

export interface ImportSummaryResponse {
  importedCount: number;
  duplicateCount: number;
  errorCount: number;
}

// Worker-local set of user IDs created during this test file's run.
// Vitest re-initialises module state for each file (isolate: true),
// so this set is automatically scoped to a single file's lifecycle.
const _trackedUserIds = new Set<string>();

/**
 * Register a user ID for cleanup by cleanDatabase().
 * Call this when registering a user via raw HTTP instead of registerUser()
 * (e.g. in auth tests that exercise the registration endpoint directly).
 */
export function trackForCleanup(userId: string): void {
  _trackedUserIds.add(userId);
}

/**
 * Delete all data created by the current test file. Only removes rows owned
 * by users registered through registerUser() or trackForCleanup(). System
 * categories (userId IS NULL) and global sequences are untouched.
 *
 * Called in beforeEach (cleans previous test's data) and afterAll (cleans
 * the last test's data after the file finishes).
 */
export async function cleanDatabase(): Promise<void> {
  if (_trackedUserIds.size === 0) return;

  const userIds = [..._trackedUserIds];
  _trackedUserIds.clear();

  // Resolve account IDs before deleting accounts; transactions are scoped
  // to accounts rather than users directly.
  const userAccounts = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(inArray(accounts.userId, userIds));
  const accountIds = userAccounts.map((a) => a.id);

  if (accountIds.length > 0) {
    // transaction_tags and rebalancing_group_transactions cascade from
    // transactions, so they don't need explicit deletes.
    await db.delete(transactions).where(inArray(transactions.accountId, accountIds));
    await db.delete(investmentTransactions).where(inArray(investmentTransactions.accountId, accountIds));
    await db.delete(investmentSnapshots).where(inArray(investmentSnapshots.accountId, accountIds));
    await db.delete(contributionRecords).where(inArray(contributionRecords.accountId, accountIds));
    await db.delete(imports).where(inArray(imports.accountId, accountIds));
    await db.delete(accounts).where(inArray(accounts.id, accountIds));
  }

  // rebalancing_group_transactions cascades from rebalancing_groups.
  await db.delete(rebalancingGroups).where(inArray(rebalancingGroups.userId, userIds));
  await db.delete(categorizationRules).where(inArray(categorizationRules.userId, userIds));
  // transaction_tags cascades from tags.
  await db.delete(tags).where(inArray(tags.userId, userIds));
  // anticipated_budget_months cascades from anticipated_budget.
  await db.delete(anticipatedBudget).where(inArray(anticipatedBudget.userId, userIds));
  await db.delete(userConfig).where(inArray(userConfig.userId, userIds));
  await db.delete(refreshTokens).where(inArray(refreshTokens.userId, userIds));
  await db.delete(categories).where(inArray(categories.userId, userIds));
  await db.delete(users).where(inArray(users.id, userIds));
}

// Suffix applied to all emails registered via this helper to keep them unique
// across parallel workers. Each Vitest worker gets a distinct VITEST_WORKER_ID.
const _workerSuffix = `-w${process.env.VITEST_WORKER_ID ?? '0'}`;

export async function registerUser(
  app: Application,
  email = 'test@example.com'
): Promise<AuthResponse> {
  // Inject the worker suffix before the @ so parallel workers never collide on
  // the users.email unique constraint. 'test@example.com' → 'test-w1@example.com'.
  const workerEmail = email.replace('@', `${_workerSuffix}@`);
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email: workerEmail, password: 'password123' });
  if (res.status !== 201) {
    throw new Error(
      `registerUser failed: ${res.status} ${JSON.stringify(res.body)}`
    );
  }
  // supertest types res.body as `any`; the cast satisfies no-unsafe-return
  // without hiding a real type gap — the shape is validated by the route's
  // Zod schema before it ever reaches this helper.
  const body = res.body as AuthResponse;
  _trackedUserIds.add(body.user.id);
  return body;
}

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
  if (res.status !== 201) {
    throw new Error(
      `createAccount failed: ${res.status} ${JSON.stringify(res.body)}`
    );
  }
  // Same boundary cast: supertest body is `any`; cast required by no-unsafe-member-access.
  return (res.body as AccountResponse).id;
}

export async function createCategory(
  app: Application,
  token: string,
  options: { name: string; isIncome?: boolean; parentId?: string }
): Promise<string> {
  const res = await request(app)
    .post('/api/v1/categories')
    .set('Authorization', `Bearer ${token}`)
    .send(options);
  if (res.status !== 201) {
    throw new Error(
      `createCategory failed: ${res.status} ${JSON.stringify(res.body)}`
    );
  }
  return (res.body as { id: string }).id;
}

const AMEX_FIXTURE = path.join(__dirname, './csv/amex.csv');

export async function uploadCsv(
  app: Application,
  token: string,
  accountId: string,
  fixturePath: string,
  filename: string
): Promise<ImportSummaryResponse> {
  const res = await request(app)
    .post('/api/v1/imports/upload')
    .set('Authorization', `Bearer ${token}`)
    .field('accountId', accountId)
    .attach('file', fixturePath, filename);
  if (res.status !== 201) {
    throw new Error(
      `uploadCsv failed: ${res.status} ${JSON.stringify(res.body)}`
    );
  }
  return res.body as ImportSummaryResponse;
}

export async function uploadAmex(
  app: Application,
  token: string,
  accountId: string
): Promise<ImportSummaryResponse> {
  return uploadCsv(
    app,
    token,
    accountId,
    AMEX_FIXTURE,
    'amex.csv'
  );
}

export async function createTag(
  app: Application,
  token: string,
  name: string
): Promise<string> {
  const res = await request(app)
    .post('/api/v1/tags')
    .set('Authorization', `Bearer ${token}`)
    .send({ name });
  if (res.status !== 201) {
    throw new Error(
      `createTag failed: ${res.status} ${JSON.stringify(res.body)}`
    );
  }
  return (res.body as { id: string }).id;
}

/** Lists all transactions for the user and returns the first row. */
export async function getFirstTransaction(
  app: Application,
  accessToken: string
): Promise<TransactionResponse> {
  const res = await request(app)
    .get('/api/v1/transactions')
    .set('Authorization', `Bearer ${accessToken}`);
  const { data } = res.body as PaginatedResponse<TransactionResponse>;
  const first = data[0];
  if (!first) throw new Error('No transactions found');
  return first;
}

export async function setAllocations(
  app: Application,
  token: string,
  allocations: {
    needsPercentage: number;
    wantsPercentage: number;
    investmentsPercentage: number;
  }
): Promise<void> {
  const res = await request(app)
    .patch('/api/v1/user-config')
    .set('Authorization', `Bearer ${token}`)
    .send({ allocations });
  if (res.status !== 200) {
    throw new Error(
      `setAllocations failed: ${res.status} ${JSON.stringify(res.body)}`
    );
  }
}

/**
 * Ensures the user_config row exists (created lazily on first GET) then sets
 * the emergency fund target directly in the DB. Use this instead of importing
 * the userConfig schema and drizzle operators into a test file.
 */
export async function setEmergencyFundTarget(
  app: Application,
  accessToken: string,
  userId: string,
  target: string
): Promise<void> {
  await request(app)
    .get('/api/v1/user-config')
    .set('Authorization', `Bearer ${accessToken}`);
  await db
    .update(userConfig)
    .set({ emergencyFundTarget: target })
    .where(eq(userConfig.userId, userId));
}

/** Returns the id of a seeded category by name. */
export async function getCategoryId(
  app: Application,
  accessToken: string,
  name: string
): Promise<string> {
  const res = await request(app)
    .get('/api/v1/categories')
    .set('Authorization', `Bearer ${accessToken}`);
  const cat = (res.body as { id: string; name: string }[]).find(
    (c) => c.name === name
  );
  if (!cat) throw new Error(`Category '${name}' not found`);
  return cat.id;
}
