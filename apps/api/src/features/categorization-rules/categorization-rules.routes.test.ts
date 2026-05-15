import { cleanDatabase, registerUser, createCategory } from '@/testing/test-helpers';
import { MALFORMED_ID, UNKNOWN_ID } from '@/testing/constants';
import { createApp } from '@/app';
import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { RuleResponse } from '@/testing/types';
import { categorizationRuleFixture } from '@/testing/fixtures/categorization-rules.fixture';

const app = createApp();

beforeEach(() => cleanDatabase());

// ─── GET /api/v1/categorization-rules ─────────────────────────────────────────

describe('GET /api/v1/categorization-rules', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/v1/categorization-rules');
    expect(res.status).toBe(401);
  });

  it('returns an empty array when the user has no rules', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .get('/api/v1/categorization-rules')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns rules belonging to the authenticated user with the correct shape', async () => {
    const { accessToken, user } = await registerUser(app);
    await categorizationRuleFixture({
      userId: user.id,
      keyword: 'amazon',
      needWant: 'Want',
      priority: 5,
    });

    const res = await request(app)
      .get('/api/v1/categorization-rules')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const body = res.body as RuleResponse[];
    expect(body).toHaveLength(1);
    const rule = body[0] as RuleResponse; // length asserted above
    expect(rule.id).toBeDefined();
    expect(typeof rule.createdAt).toBe('string');
    expect(rule).toMatchObject({
      keyword: 'amazon',
      sourceName: null,
      categoryId: null,
      categoryName: null,
      subcategoryId: null,
      subcategoryName: null,
      needWant: 'Want',
      flagForReview: false,
      priority: 5,
    });
  });

  it('returns rules ordered by priority descending', async () => {
    const { accessToken, user } = await registerUser(app);
    await Promise.all([
      categorizationRuleFixture({ userId: user.id, keyword: 'low', priority: 1 }),
      categorizationRuleFixture({ userId: user.id, keyword: 'high', priority: 10 }),
      categorizationRuleFixture({ userId: user.id, keyword: 'mid', priority: 5 }),
    ]);

    const res = await request(app)
      .get('/api/v1/categorization-rules')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const keywords = (res.body as RuleResponse[]).map((r) => r.keyword);
    expect(keywords).toEqual(['high', 'mid', 'low']);
  });

  it("does not include another user's rules", async () => {
    const [{ user: userA }, { accessToken: tokenB }] = await Promise.all([
      registerUser(app, 'a@example.com'),
      registerUser(app, 'b@example.com'),
    ]);

    await categorizationRuleFixture({
      userId: userA.id,
      keyword: 'user-a-keyword',
    });

    const res = await request(app)
      .get('/api/v1/categorization-rules')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(res.body as RuleResponse[]).toHaveLength(0);
  });

  it('populates categoryName when the rule has a linked category', async () => {
    const { accessToken, user } = await registerUser(app);
    const categoryId = await createCategory(app, accessToken, { name: 'Groceries', isIncome: false });

    await categorizationRuleFixture({ userId: user.id, keyword: 'walmart', categoryId });

    const res = await request(app)
      .get('/api/v1/categorization-rules')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const body = res.body as RuleResponse[];
    expect(body[0]).toMatchObject({
      categoryId,
      categoryName: 'Groceries',
    });
  });

  it('populates subcategoryName when the rule has a linked subcategory', async () => {
    const { accessToken, user } = await registerUser(app);
    const categoryId = await createCategory(app, accessToken, { name: 'Food', isIncome: false });
    const subcategoryId = await createCategory(app, accessToken, {
      name: 'Groceries',
      isIncome: false,
      parentId: categoryId,
    });

    await categorizationRuleFixture({ userId: user.id, keyword: 'costco', subcategoryId });

    const res = await request(app)
      .get('/api/v1/categorization-rules')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const body = res.body as RuleResponse[];
    expect(body[0]).toMatchObject({
      subcategoryId,
      subcategoryName: 'Groceries',
    });
  });

  it('returns sourceName when the rule has a sourceName set', async () => {
    const { accessToken, user } = await registerUser(app);
    await categorizationRuleFixture({ userId: user.id, keyword: 'td payment', sourceName: 'TD' });

    const res = await request(app)
      .get('/api/v1/categorization-rules')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const body = res.body as RuleResponse[];
    expect(body[0]).toMatchObject({ sourceName: 'TD' });
  });

  it('returns matchType: substring on rules seeded with the default', async () => {
    const { accessToken, user } = await registerUser(app);
    await categorizationRuleFixture({ userId: user.id, keyword: 'amazon' });

    const res = await request(app)
      .get('/api/v1/categorization-rules')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect((res.body as RuleResponse[])[0]).toMatchObject({ matchType: 'substring' });
  });
});

// ─── POST /api/v1/categorization-rules ────────────────────────────────────────

describe('POST /api/v1/categorization-rules', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/v1/categorization-rules')
      .send({ keyword: 'amazon', categoryId: null });
    expect(res.status).toBe(401);
  });

  it('creates a rule and returns 201 with default matchType: substring', async () => {
    const { accessToken } = await registerUser(app);

    const res = await request(app)
      .post('/api/v1/categorization-rules')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ keyword: 'amazon', categoryId: null });

    expect(res.status).toBe(201);
    const body = res.body as RuleResponse;
    expect(body.id).toBeDefined();
    expect(body).toMatchObject({
      keyword: 'amazon',
      categoryId: null,
      categoryName: null,
      subcategoryId: null,
      subcategoryName: null,
      needWant: null,
      flagForReview: false,
      matchType: 'substring',
    });
    expect(typeof body.createdAt).toBe('string');
  });

  it('creates a rule with matchType: wildcard and returns it correctly', async () => {
    const { accessToken } = await registerUser(app);

    const res = await request(app)
      .post('/api/v1/categorization-rules')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ keyword: 'amazon*', categoryId: null, matchType: 'wildcard' });

    expect(res.status).toBe(201);
    expect((res.body as RuleResponse).matchType).toBe('wildcard');
  });

  it('created wildcard rule appears in GET with matchType: wildcard', async () => {
    const { accessToken } = await registerUser(app);

    await request(app)
      .post('/api/v1/categorization-rules')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ keyword: 'amazon*', categoryId: null, matchType: 'wildcard' });

    const listRes = await request(app)
      .get('/api/v1/categorization-rules')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(listRes.status).toBe(200);
    expect((listRes.body as RuleResponse[])[0]?.matchType).toBe('wildcard');
  });

  it('creates a rule with a linked category and returns categoryName', async () => {
    const { accessToken } = await registerUser(app);
    const categoryId = await createCategory(app, accessToken, { name: 'Groceries', isIncome: false });

    const res = await request(app)
      .post('/api/v1/categorization-rules')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ keyword: 'walmart', categoryId });

    expect(res.status).toBe(201);
    expect(res.body as RuleResponse).toMatchObject({ categoryId, categoryName: 'Groceries' });
  });

  it('returns 400 when keyword is missing', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/categorization-rules')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ categoryId: null });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation error' });
  });

  it('returns 400 when keyword is empty', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/categorization-rules')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ keyword: '', categoryId: null });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation error' });
  });

  it('returns 400 when keyword exceeds 200 characters', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/categorization-rules')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ keyword: 'a'.repeat(201), categoryId: null });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation error' });
  });

  it('accepts a keyword of exactly 200 characters', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/categorization-rules')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ keyword: 'a'.repeat(200), categoryId: null });
    expect(res.status).toBe(201);
  });

  it('returns 400 when categoryId is missing', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/categorization-rules')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ keyword: 'amazon' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation error' });
  });

  it('accepts categoryId: null when flagForReview is true', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/categorization-rules')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ keyword: 'transfer', categoryId: null, flagForReview: true });
    expect(res.status).toBe(201);
    expect((res.body as RuleResponse).flagForReview).toBe(true);
  });

  it('returns 400 for an invalid matchType value', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/categorization-rules')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ keyword: 'amazon', categoryId: null, matchType: 'regex' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation error' });
  });

  it("rule is scoped to the authenticated user — another user's GET does not return it", async () => {
    const [{ accessToken: tokenA }, { accessToken: tokenB }] = await Promise.all([
      registerUser(app, 'a@example.com'),
      registerUser(app, 'b@example.com'),
    ]);

    await request(app)
      .post('/api/v1/categorization-rules')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ keyword: 'user-a-only', categoryId: null });

    const res = await request(app)
      .get('/api/v1/categorization-rules')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(res.body as RuleResponse[]).toHaveLength(0);
  });
});

// ─── PATCH /api/v1/categorization-rules/:id ───────────────────────────────────

describe('PATCH /api/v1/categorization-rules/:id', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .patch(`/api/v1/categorization-rules/${UNKNOWN_ID}`)
      .send({ keyword: 'amazon' });
    expect(res.status).toBe(401);
  });

  it('updates keyword and returns the full updated shape', async () => {
    const { accessToken, user } = await registerUser(app);
    const { id } = await categorizationRuleFixture({
      userId: user.id,
      keyword: 'old keyword',
    });

    const res = await request(app)
      .patch(`/api/v1/categorization-rules/${id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ keyword: 'new keyword' });

    expect(res.status).toBe(200);
    expect(res.body as RuleResponse).toMatchObject({
      id,
      keyword: 'new keyword',
      categoryId: null,
      categoryName: null,
      subcategoryId: null,
      subcategoryName: null,
    });
  });

  it('updates priority', async () => {
    const { accessToken, user } = await registerUser(app);
    const { id } = await categorizationRuleFixture({
      userId: user.id,
      priority: 0,
    });

    const res = await request(app)
      .patch(`/api/v1/categorization-rules/${id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ priority: 10 });

    expect(res.status).toBe(200);
    expect((res.body as RuleResponse).priority).toBe(10);
  });

  it('updates needWant', async () => {
    const { accessToken, user } = await registerUser(app);
    const { id } = await categorizationRuleFixture({
      userId: user.id,
      needWant: null,
    });

    const res = await request(app)
      .patch(`/api/v1/categorization-rules/${id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ needWant: 'Need' });

    expect(res.status).toBe(200);
    expect((res.body as RuleResponse).needWant).toBe('Need');
  });

  it('sets flagForReview to true', async () => {
    const { accessToken, user } = await registerUser(app);
    const { id } = await categorizationRuleFixture({ userId: user.id, flagForReview: false });

    const res = await request(app)
      .patch(`/api/v1/categorization-rules/${id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ flagForReview: true });

    expect(res.status).toBe(200);
    expect((res.body as RuleResponse).flagForReview).toBe(true);
  });

  it('clears flagForReview back to false', async () => {
    const { accessToken, user } = await registerUser(app);
    const { id } = await categorizationRuleFixture({ userId: user.id, flagForReview: true });

    const res = await request(app)
      .patch(`/api/v1/categorization-rules/${id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ flagForReview: false });

    expect(res.status).toBe(200);
    expect((res.body as RuleResponse).flagForReview).toBe(false);
  });

  it('clears needWant to null', async () => {
    const { accessToken, user } = await registerUser(app);
    const { id } = await categorizationRuleFixture({
      userId: user.id,
      needWant: 'Want',
    });

    const res = await request(app)
      .patch(`/api/v1/categorization-rules/${id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ needWant: null });

    expect(res.status).toBe(200);
    expect((res.body as RuleResponse).needWant).toBeNull();
  });

  it('updates categoryId and reflects categoryName in the response', async () => {
    const { accessToken, user } = await registerUser(app);
    const { id } = await categorizationRuleFixture({ userId: user.id });
    const categoryId = await createCategory(app, accessToken, { name: 'Dining', isIncome: false });

    const res = await request(app)
      .patch(`/api/v1/categorization-rules/${id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ categoryId });

    expect(res.status).toBe(200);
    expect(res.body as RuleResponse).toMatchObject({
      id,
      categoryId,
      categoryName: 'Dining',
    });
  });

  it('clears categoryId to null', async () => {
    const { accessToken, user } = await registerUser(app);
    const categoryId = await createCategory(app, accessToken, { name: 'Dining', isIncome: false });
    const { id } = await categorizationRuleFixture({ userId: user.id, categoryId });

    const res = await request(app)
      .patch(`/api/v1/categorization-rules/${id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ categoryId: null });

    expect(res.status).toBe(200);
    const body = res.body as RuleResponse;
    expect(body.categoryId).toBeNull();
    expect(body.categoryName).toBeNull();
  });

  it('returns 200 with no changes for an empty patch body', async () => {
    const { accessToken, user } = await registerUser(app);
    const { id } = await categorizationRuleFixture({ userId: user.id, keyword: 'original' });

    const res = await request(app)
      .patch(`/api/v1/categorization-rules/${id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect((res.body as RuleResponse).keyword).toBe('original');
  });

  it('returns 400 for a malformed (non-UUID) id', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .patch(`/api/v1/categorization-rules/${MALFORMED_ID}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ keyword: 'amazon' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation error' });
  });

  it('returns 404 for an unknown rule id', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .patch(`/api/v1/categorization-rules/${UNKNOWN_ID}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ keyword: 'amazon' });

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'Rule not found' });
  });

  it("returns 403 when patching another user's rule", async () => {
    const [{ user: userA }, { accessToken: tokenB }] = await Promise.all([
      registerUser(app, 'a@example.com'),
      registerUser(app, 'b@example.com'),
    ]);

    const { id } = await categorizationRuleFixture({ userId: userA.id });

    const res = await request(app)
      .patch(`/api/v1/categorization-rules/${id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ keyword: 'hijacked' });

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: 'Cannot modify this rule' });
  });

  it('returns 403 when patching a system rule (userId: null)', async () => {
    const { accessToken } = await registerUser(app);
    const { id } = await categorizationRuleFixture(); // userId: null by default

    const res = await request(app)
      .patch(`/api/v1/categorization-rules/${id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ keyword: 'hijacked' });

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: 'Cannot modify this rule' });
  });

  it('returns 400 for an empty keyword', async () => {
    const { accessToken, user } = await registerUser(app);
    const { id } = await categorizationRuleFixture({ userId: user.id });

    const res = await request(app)
      .patch(`/api/v1/categorization-rules/${id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ keyword: '' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation error' });
  });

  it('accepts a keyword of exactly 200 characters', async () => {
    const { accessToken, user } = await registerUser(app);
    const { id } = await categorizationRuleFixture({ userId: user.id });

    const res = await request(app)
      .patch(`/api/v1/categorization-rules/${id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ keyword: 'a'.repeat(200) });

    expect(res.status).toBe(200);
    expect((res.body as RuleResponse).keyword).toBe('a'.repeat(200));
  });

  it('returns 400 for a keyword exceeding 200 characters', async () => {
    const { accessToken, user } = await registerUser(app);
    const { id } = await categorizationRuleFixture({ userId: user.id });

    const res = await request(app)
      .patch(`/api/v1/categorization-rules/${id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ keyword: 'a'.repeat(201) });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation error' });
  });

  it('returns 400 for an invalid needWant value', async () => {
    const { accessToken, user } = await registerUser(app);
    const { id } = await categorizationRuleFixture({ userId: user.id });

    const res = await request(app)
      .patch(`/api/v1/categorization-rules/${id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ needWant: 'Invalid' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation error' });
  });

  it('updates matchType to wildcard and persists it', async () => {
    const { accessToken, user } = await registerUser(app);
    const { id } = await categorizationRuleFixture({ userId: user.id, matchType: 'substring' });

    const res = await request(app)
      .patch(`/api/v1/categorization-rules/${id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ matchType: 'wildcard' });

    expect(res.status).toBe(200);
    expect((res.body as RuleResponse).matchType).toBe('wildcard');

    const listRes = await request(app)
      .get('/api/v1/categorization-rules')
      .set('Authorization', `Bearer ${accessToken}`);
    expect((listRes.body as RuleResponse[])[0]?.matchType).toBe('wildcard');
  });

  it('returns 400 for an invalid matchType value', async () => {
    const { accessToken, user } = await registerUser(app);
    const { id } = await categorizationRuleFixture({ userId: user.id });

    const res = await request(app)
      .patch(`/api/v1/categorization-rules/${id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ matchType: 'regex' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation error' });
  });
});

// ─── DELETE /api/v1/categorization-rules/:id ──────────────────────────────────

describe('DELETE /api/v1/categorization-rules/:id', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).delete(
      `/api/v1/categorization-rules/${UNKNOWN_ID}`
    );
    expect(res.status).toBe(401);
  });

  it('deletes a rule and returns 204', async () => {
    const { accessToken, user } = await registerUser(app);
    const { id } = await categorizationRuleFixture({ userId: user.id });

    const res = await request(app)
      .delete(`/api/v1/categorization-rules/${id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(204);
  });

  it('rule is absent from the list after deletion', async () => {
    const { accessToken, user } = await registerUser(app);
    const { id } = await categorizationRuleFixture({
      userId: user.id,
      keyword: 'to-delete',
    });

    const deleteRes = await request(app)
      .delete(`/api/v1/categorization-rules/${id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(deleteRes.status).toBe(204);

    const listRes = await request(app)
      .get('/api/v1/categorization-rules')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body as RuleResponse[]).toHaveLength(0);
  });

  it('returns 400 for a malformed (non-UUID) id', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .delete(`/api/v1/categorization-rules/${MALFORMED_ID}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation error' });
  });

  it('returns 404 for an unknown rule id', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .delete(`/api/v1/categorization-rules/${UNKNOWN_ID}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'Rule not found' });
  });

  it("returns 403 when deleting another user's rule", async () => {
    const [{ user: userA }, { accessToken: tokenB }] = await Promise.all([
      registerUser(app, 'a@example.com'),
      registerUser(app, 'b@example.com'),
    ]);

    const { id } = await categorizationRuleFixture({ userId: userA.id });

    const res = await request(app)
      .delete(`/api/v1/categorization-rules/${id}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: 'Cannot modify this rule' });
  });

  it('returns 403 when deleting a system rule (userId: null)', async () => {
    const { accessToken } = await registerUser(app);
    const { id } = await categorizationRuleFixture(); // userId: null by default

    const res = await request(app)
      .delete(`/api/v1/categorization-rules/${id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: 'Cannot modify this rule' });
  });
});
