import { cleanDatabase, registerUser } from '@/testing/test-helpers';
import { MALFORMED_ID, UNKNOWN_ID } from '@/testing/constants';
import { createApp } from '@/app';
import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { ruleSuggestionFixture } from '@/testing/fixtures/rule-suggestion.fixture';
import { categoryFixture } from '@/testing/fixtures/category.fixture';
import { accountFixture } from '@/testing/fixtures/account.fixture';
import { transactionFixture } from '@/testing/fixtures/transaction.fixture';
import { db } from '@/db';
import { eq } from 'drizzle-orm';
import { transactions } from '@/db/schema';

const app = createApp();

beforeEach(() => cleanDatabase());

// ─── Types ───────────────────────────────────────────────────────────────────

interface SuggestionResponse {
  id: string;
  suggestedKeyword: string;
  categoryId: string | null;
  categoryName: string | null;
  subcategoryId: string | null;
  subcategoryName: string | null;
  needWant: string | null;
  confidence: number;
  transactionId: string | null;
  status: string;
  createdAt: string;
}

interface RuleResponse {
  id: string;
  keyword: string;
  categoryId: string | null;
  needWant: string | null;
  priority: number;
  matchType: string;
}

// ─── GET /api/v1/rule-suggestions ────────────────────────────────────────────

describe('GET /api/v1/rule-suggestions', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/v1/rule-suggestions');
    expect(res.status).toBe(401);
  });

  it('returns an empty array when the user has no suggestions', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .get('/api/v1/rule-suggestions')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns pending suggestions with joined category names', async () => {
    const { accessToken, user } = await registerUser(app);
    const cat = await categoryFixture({ userId: user.id, name: 'Groceries' });
    await ruleSuggestionFixture({
      userId: user.id,
      suggestedKeyword: 'WALMART',
      categoryId: cat.id,
      needWant: 'Need',
      confidence: '0.920',
    });

    const res = await request(app)
      .get('/api/v1/rule-suggestions')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const body = res.body as SuggestionResponse[];
    expect(body).toHaveLength(1);
    const s = body[0] as SuggestionResponse;
    expect(s.id).toBeDefined();
    expect(typeof s.createdAt).toBe('string');
    expect(s).toMatchObject({
      suggestedKeyword: 'WALMART',
      categoryId: cat.id,
      categoryName: 'Groceries',
      subcategoryId: null,
      subcategoryName: null,
      needWant: 'Need',
      confidence: 0.92,
      status: 'pending',
    });
  });

  it('does not return accepted or dismissed suggestions', async () => {
    const { accessToken, user } = await registerUser(app);
    await ruleSuggestionFixture({ userId: user.id, suggestedKeyword: 'ACCEPTED', status: 'accepted' });
    await ruleSuggestionFixture({ userId: user.id, suggestedKeyword: 'DISMISSED', status: 'dismissed' });

    const res = await request(app)
      .get('/api/v1/rule-suggestions')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("does not return another user's suggestions", async () => {
    const { accessToken } = await registerUser(app);
    const { user: other } = await registerUser(app, 'other@example.com');
    await ruleSuggestionFixture({ userId: other.id, suggestedKeyword: 'STARBUCKS' });

    const res = await request(app)
      .get('/api/v1/rule-suggestions')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns suggestions ordered by confidence desc', async () => {
    const { accessToken, user } = await registerUser(app);
    await ruleSuggestionFixture({ userId: user.id, suggestedKeyword: 'LOW',  confidence: '0.710' });
    await ruleSuggestionFixture({ userId: user.id, suggestedKeyword: 'HIGH', confidence: '0.980' });
    await ruleSuggestionFixture({ userId: user.id, suggestedKeyword: 'MID',  confidence: '0.840' });

    const res = await request(app)
      .get('/api/v1/rule-suggestions')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const keywords = (res.body as SuggestionResponse[]).map((s) => s.suggestedKeyword);
    expect(keywords).toEqual(['HIGH', 'MID', 'LOW']);
  });
});

// ─── POST /api/v1/rule-suggestions/:id/accept ────────────────────────────────

describe('POST /api/v1/rule-suggestions/:id/accept', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).post(`/api/v1/rule-suggestions/${UNKNOWN_ID}/accept`);
    expect(res.status).toBe(401);
  });

  it('returns 400 on malformed id', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .post(`/api/v1/rule-suggestions/${MALFORMED_ID}/accept`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 404 when suggestion does not exist', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .post(`/api/v1/rule-suggestions/${UNKNOWN_ID}/accept`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(404);
  });

  it("returns 403 when accepting another user's suggestion", async () => {
    const { accessToken } = await registerUser(app);
    const { user: other } = await registerUser(app, 'other@example.com');
    const suggestion = await ruleSuggestionFixture({ userId: other.id });

    const res = await request(app)
      .post(`/api/v1/rule-suggestions/${suggestion.id}/accept`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(403);
  });

  it('creates a rule from suggestion values and returns 201', async () => {
    const { accessToken, user } = await registerUser(app);
    const cat = await categoryFixture({ userId: user.id, name: 'Food' });
    const suggestion = await ruleSuggestionFixture({
      userId: user.id,
      suggestedKeyword: 'MCDONALDS',
      categoryId: cat.id,
      needWant: 'Want',
      confidence: '0.900',
    });

    const res = await request(app)
      .post(`/api/v1/rule-suggestions/${suggestion.id}/accept`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    expect(res.status).toBe(201);
    const body = res.body as RuleResponse;
    expect(body.id).toBeDefined();
    expect(body).toMatchObject({
      keyword: 'MCDONALDS',
      categoryId: cat.id,
      needWant: 'Want',
      priority: 5,
      matchType: 'substring',
    });
  });

  it('applies body overrides when provided', async () => {
    const { accessToken, user } = await registerUser(app);
    const cat = await categoryFixture({ userId: user.id, name: 'Food' });
    const cat2 = await categoryFixture({ userId: user.id, name: 'Transport' });
    const suggestion = await ruleSuggestionFixture({
      userId: user.id,
      suggestedKeyword: 'TRANSIT',
      categoryId: cat.id,
      needWant: 'Want',
    });

    const res = await request(app)
      .post(`/api/v1/rule-suggestions/${suggestion.id}/accept`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ keyword: 'TTRANSIT', categoryId: cat2.id, needWant: 'Need', priority: 10 });

    expect(res.status).toBe(201);
    const body = res.body as RuleResponse;
    expect(body).toMatchObject({
      keyword: 'TTRANSIT',
      categoryId: cat2.id,
      needWant: 'Need',
      priority: 10,
    });
  });

  it("coerces needWant 'NA' on the suggestion to null in the created rule", async () => {
    const { accessToken, user } = await registerUser(app);
    const cat = await categoryFixture({ userId: user.id, name: 'Misc' });
    const suggestion = await ruleSuggestionFixture({
      userId: user.id,
      categoryId: cat.id,
      needWant: 'NA',
    });

    const res = await request(app)
      .post(`/api/v1/rule-suggestions/${suggestion.id}/accept`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    expect(res.status).toBe(201);
    const body = res.body as RuleResponse;
    expect(body.needWant).toBeNull();
  });

  it('returns 409 when accepting an already-accepted suggestion', async () => {
    const { accessToken, user } = await registerUser(app);
    const suggestion = await ruleSuggestionFixture({ userId: user.id, status: 'accepted' });

    const res = await request(app)
      .post(`/api/v1/rule-suggestions/${suggestion.id}/accept`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(res.status).toBe(409);
  });

  it('suggestion no longer appears in GET after accept', async () => {
    const { accessToken, user } = await registerUser(app);
    const cat = await categoryFixture({ userId: user.id, name: 'Food' });
    const suggestion = await ruleSuggestionFixture({
      userId: user.id,
      categoryId: cat.id,
    });

    await request(app)
      .post(`/api/v1/rule-suggestions/${suggestion.id}/accept`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    const listRes = await request(app)
      .get('/api/v1/rule-suggestions')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body).toEqual([]);
  });

  it('response includes retroactivelyApplied count', async () => {
    const { accessToken, user } = await registerUser(app);
    const cat = await categoryFixture({ userId: user.id, name: 'Food' });
    const suggestion = await ruleSuggestionFixture({
      userId: user.id,
      suggestedKeyword: 'MCDONALDS',
      categoryId: cat.id,
    });

    const res = await request(app)
      .post(`/api/v1/rule-suggestions/${suggestion.id}/accept`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    expect(res.status).toBe(201);
    const body = res.body as { retroactivelyApplied: number };
    expect(typeof body.retroactivelyApplied).toBe('number');
  });

  it('retroactively updates matching AI-categorized transactions when a suggestion is accepted', async () => {
    const { accessToken, user } = await registerUser(app);
    const cat = await categoryFixture({ userId: user.id, name: 'Food' });
    const account = await accountFixture(user.id);

    // Transaction with AI-assigned category whose description matches the suggestion keyword
    const txn = await transactionFixture(account.id, {
      description: 'mcdonalds',
      categorySource: 'ai',
      categoryId: null,
      flaggedForReview: false,
    });

    const suggestion = await ruleSuggestionFixture({
      userId: user.id,
      suggestedKeyword: 'mcdonalds',
      categoryId: cat.id,
      transactionId: txn.id,
    });

    const res = await request(app)
      .post(`/api/v1/rule-suggestions/${suggestion.id}/accept`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    expect(res.status).toBe(201);
    const body = res.body as { retroactivelyApplied: number };
    expect(body.retroactivelyApplied).toBe(1);

    // Verify the transaction was updated in the DB
    const [updated] = await db
      .select({ categoryId: transactions.categoryId, categorySource: transactions.categorySource })
      .from(transactions)
      .where(eq(transactions.id, txn.id));
    expect(updated).toMatchObject({ categoryId: cat.id, categorySource: 'rule' });
  });

  it('does not retroactively update manually-categorized transactions', async () => {
    const { accessToken, user } = await registerUser(app);
    const cat = await categoryFixture({ userId: user.id, name: 'Food' });
    const account = await accountFixture(user.id);

    const txn = await transactionFixture(account.id, {
      description: 'mcdonalds',
      categorySource: 'manual',
      categoryId: cat.id,
      flaggedForReview: false,
    });

    const suggestion = await ruleSuggestionFixture({
      userId: user.id,
      suggestedKeyword: 'mcdonalds',
      categoryId: cat.id,
    });

    const res = await request(app)
      .post(`/api/v1/rule-suggestions/${suggestion.id}/accept`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    expect(res.status).toBe(201);
    expect((res.body as { retroactivelyApplied: number }).retroactivelyApplied).toBe(0);

    // Manual categorization must be preserved
    const [after] = await db
      .select({ categorySource: transactions.categorySource })
      .from(transactions)
      .where(eq(transactions.id, txn.id));
    expect(after?.categorySource).toBe('manual');
  });

  it('does not retroactively update transfer transactions', async () => {
    const { accessToken, user } = await registerUser(app);
    const cat = await categoryFixture({ userId: user.id, name: 'Food' });
    const account = await accountFixture(user.id);

    const txn = await transactionFixture(account.id, {
      description: 'mcdonalds',
      categorySource: 'ai',
      categoryId: null,
      isTransfer: true,
    });

    const suggestion = await ruleSuggestionFixture({
      userId: user.id,
      suggestedKeyword: 'mcdonalds',
      categoryId: cat.id,
    });

    const res = await request(app)
      .post(`/api/v1/rule-suggestions/${suggestion.id}/accept`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    expect(res.status).toBe(201);
    expect((res.body as { retroactivelyApplied: number }).retroactivelyApplied).toBe(0);

    const [after] = await db
      .select({ categorySource: transactions.categorySource })
      .from(transactions)
      .where(eq(transactions.id, txn.id));
    expect(after?.categorySource).toBe('ai');
  });

  it('returns retroactivelyApplied: 0 when no transactions match the rule keyword', async () => {
    const { accessToken, user } = await registerUser(app);
    const cat = await categoryFixture({ userId: user.id, name: 'Food' });
    const account = await accountFixture(user.id);

    // Transaction that does NOT match the keyword
    await transactionFixture(account.id, {
      description: 'starbucks',
      categorySource: 'ai',
      categoryId: null,
    });

    const suggestion = await ruleSuggestionFixture({
      userId: user.id,
      suggestedKeyword: 'mcdonalds',
      categoryId: cat.id,
    });

    const res = await request(app)
      .post(`/api/v1/rule-suggestions/${suggestion.id}/accept`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    expect(res.status).toBe(201);
    expect((res.body as { retroactivelyApplied: number }).retroactivelyApplied).toBe(0);
  });

  it('coerces needWant to null for income transactions during retroactive application', async () => {
    const { accessToken, user } = await registerUser(app);
    const cat = await categoryFixture({ userId: user.id, name: 'Income' });
    const account = await accountFixture(user.id);

    const txn = await transactionFixture(account.id, {
      description: 'employer payroll',
      categorySource: 'ai',
      categoryId: null,
      isIncome: true,
      amount: '3000.00',
    });

    const suggestion = await ruleSuggestionFixture({
      userId: user.id,
      suggestedKeyword: 'employer',
      categoryId: cat.id,
      needWant: 'Need',
    });

    await request(app)
      .post(`/api/v1/rule-suggestions/${suggestion.id}/accept`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    const [after] = await db
      .select({ needWant: transactions.needWant, categorySource: transactions.categorySource })
      .from(transactions)
      .where(eq(transactions.id, txn.id));
    expect(after).toMatchObject({ needWant: null, categorySource: 'rule' });
  });
});

// ─── POST /api/v1/rule-suggestions/:id/dismiss ───────────────────────────────

describe('POST /api/v1/rule-suggestions/:id/dismiss', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).post(`/api/v1/rule-suggestions/${UNKNOWN_ID}/dismiss`);
    expect(res.status).toBe(401);
  });

  it('returns 400 on malformed id', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .post(`/api/v1/rule-suggestions/${MALFORMED_ID}/dismiss`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 404 when suggestion does not exist', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .post(`/api/v1/rule-suggestions/${UNKNOWN_ID}/dismiss`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(404);
  });

  it("returns 403 when dismissing another user's suggestion", async () => {
    const { accessToken } = await registerUser(app);
    const { user: other } = await registerUser(app, 'other@example.com');
    const suggestion = await ruleSuggestionFixture({ userId: other.id });

    const res = await request(app)
      .post(`/api/v1/rule-suggestions/${suggestion.id}/dismiss`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(403);
  });

  it('dismisses a pending suggestion and returns 204', async () => {
    const { accessToken, user } = await registerUser(app);
    const suggestion = await ruleSuggestionFixture({ userId: user.id });

    const res = await request(app)
      .post(`/api/v1/rule-suggestions/${suggestion.id}/dismiss`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(204);
  });

  it('suggestion no longer appears in GET after dismiss', async () => {
    const { accessToken, user } = await registerUser(app);
    const suggestion = await ruleSuggestionFixture({ userId: user.id });

    await request(app)
      .post(`/api/v1/rule-suggestions/${suggestion.id}/dismiss`)
      .set('Authorization', `Bearer ${accessToken}`);

    const listRes = await request(app)
      .get('/api/v1/rule-suggestions')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body).toEqual([]);
  });

  it('returns 409 when dismissing an already-dismissed suggestion', async () => {
    const { accessToken, user } = await registerUser(app);
    const suggestion = await ruleSuggestionFixture({ userId: user.id, status: 'dismissed' });

    const res = await request(app)
      .post(`/api/v1/rule-suggestions/${suggestion.id}/dismiss`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(409);
  });
});
