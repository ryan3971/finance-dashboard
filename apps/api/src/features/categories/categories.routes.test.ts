import { transactionFixture } from '@/testing/fixtures/transaction.fixture';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  cleanDatabase,
  createAccount,
  registerUser,
  getTransaction,
} from '@/testing/test-helpers';
import { createApp } from '@/app';
import request from 'supertest';
import { categoryRequest, patchCategoryRequest } from '@/testing/types';
import { UNKNOWN_ID, MALFORMED_ID, VALID_UUID } from '@/testing/constants';

const app = createApp();

beforeEach(() => cleanDatabase());

interface CategoryItem {
  id: string;
  name: string;
  isIncome: boolean;
  icon: string | null;
  userId: string;
  subcategories: { id: string; name: string; isIncome: boolean }[];
}

interface CategoryTreeItem {
  id: string;
  name: string;
  isIncome: boolean;
  subcategories: { id: string; name: string; isIncome: boolean }[];
}

interface CategoryResponse {
  id: string;
  name: string;
  isIncome: boolean;
  icon: string | null;
  userId: string;
}

describe('GET /api/v1/categories', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/v1/categories');
    expect(res.status).toBe(401);
  });

  it('returns the seeded category tree for a new user', async () => {
    // Registration seeds a copy of the system category tree for each user.
    // In tests the system set is the TEST_CATEGORIES fixture (5 top-level categories).
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .get('/api/v1/categories')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);

    const body = res.body as CategoryItem[];
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(5); // Groceries, Dining, Income, Transfer, Uncategorized

    const groceries = body.find((c) => c.name === 'Groceries');
    expect(groceries).toMatchObject({
      id: expect.any(String) as string,
      name: 'Groceries',
      isIncome: false,
      subcategories: [
        expect.objectContaining({
          id: expect.any(String) as string,
          name: 'Supermarket',
        }),
      ],
    });
  });

  it('includes user-created categories with subcategories nested correctly', async () => {
    const { accessToken } = await registerUser(app);

    const parentRes = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(categoryRequest({ name: 'My Expenses', isIncome: false }));
    expect(parentRes.status).toBe(201);
    const { id: parentId } = parentRes.body as { id: string };

    const childRes = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(categoryRequest({ name: 'Rent', parentId }));
    expect(childRes.status).toBe(201);

    const res = await request(app)
      .get('/api/v1/categories')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);

    const tree = res.body as CategoryTreeItem[];
    const myExpenses = tree.find((c) => c.name === 'My Expenses');
    expect(myExpenses).toBeDefined();
    expect(myExpenses?.subcategories).toHaveLength(1);
    expect(myExpenses?.subcategories[0]).toMatchObject({
      id: expect.any(String) as string,
      name: 'Rent',
      isIncome: false,
    });
  });

  it("does not include another user's categories", async () => {
    const [{ accessToken: tokenA }, { accessToken: tokenB }] =
      await Promise.all([
        registerUser(app, 'a@example.com'),
        registerUser(app, 'b@example.com'),
      ]);

    const createRes = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(categoryRequest({ name: 'User A Private', isIncome: false }));
    expect(createRes.status).toBe(201);

    const res = await request(app)
      .get('/api/v1/categories')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    const names = (res.body as { name: string }[]).map((c) => c.name);
    expect(names).not.toContain('User A Private');
  });
});

describe('POST /api/v1/categories', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/v1/categories')
      .send(categoryRequest({ name: 'Test', isIncome: false }));
    expect(res.status).toBe(401);
  });

  it('creates a top-level expense category and returns all fields', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(categoryRequest({ name: 'Custom Expense', isIncome: false }));

    const body = res.body as CategoryResponse;
    expect(res.status).toBe(201);
    expect(body).toMatchObject({
      id: expect.any(String) as string,
      name: 'Custom Expense',
      isIncome: false,
    });
  });

  it('creates a top-level income category', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(categoryRequest({ name: 'Side Hustle', isIncome: true }));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Side Hustle', isIncome: true });
  });

  it('creates a subcategory and inherits isIncome from the parent', async () => {
    const { accessToken } = await registerUser(app);

    const parentRes = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(categoryRequest({ name: 'Food', isIncome: false }));
    expect(parentRes.status).toBe(201);
    const { id: parentId } = parentRes.body as { id: string };

    const res = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(categoryRequest({ name: 'Restaurants', parentId }));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(String) as string,
      name: 'Restaurants',
      isIncome: false, // inherited from parent
    });
  });

  it('returns 400 when isIncome is omitted for a top-level category', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(categoryRequest({ name: 'No Income Flag' }));

    expect(res.status).toBe(400);
  });

  it('returns 400 when parentId does not exist', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(categoryRequest({ name: 'Child', parentId: UNKNOWN_ID }));

    expect(res.status).toBe(400);
  });

  it('returns 400 when parentId belongs to another user', async () => {
    const [{ accessToken: tokenA }, { accessToken: tokenB }] =
      await Promise.all([
        registerUser(app, 'a@example.com'),
        registerUser(app, 'b@example.com'),
      ]);

    const parentRes = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(categoryRequest({ name: 'A Category', isIncome: false }));
    expect(parentRes.status).toBe(201);
    const { id: parentId } = parentRes.body as { id: string };

    const res = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${tokenB}`)
      .send(categoryRequest({ name: 'Child', parentId }));

    expect(res.status).toBe(400);
  });

  it('returns 400 when parentId is itself a subcategory', async () => {
    const { accessToken } = await registerUser(app);

    const parentRes = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(categoryRequest({ name: 'Top Level', isIncome: false }));
    expect(parentRes.status).toBe(201);
    const { id: parentId } = parentRes.body as { id: string };

    const subRes = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(categoryRequest({ name: 'Sub', parentId }));
    expect(subRes.status).toBe(201);
    const { id: subId } = subRes.body as { id: string };

    const res = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(categoryRequest({ name: 'Grandchild', parentId: subId }));

    expect(res.status).toBe(400);
  });

  it('returns 400 for an empty name', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(categoryRequest({ name: '', isIncome: false }));

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation error' });
  });

  it('returns 400 when name exceeds 100 characters', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(categoryRequest({ name: 'a'.repeat(101), isIncome: false }));

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation error' });
  });

  it('returns 400 when parentId is not a valid UUID', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(categoryRequest({ name: 'Child', parentId: MALFORMED_ID }));

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation error' });
  });
});

describe('PATCH /api/v1/categories/:id', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .patch(`/api/v1/categories/${UNKNOWN_ID}`)
      .send(patchCategoryRequest({ name: 'New Name' }));
    expect(res.status).toBe(401);
  });

  it('renames the category and returns the updated shape', async () => {
    const { accessToken } = await registerUser(app);

    const createRes = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(categoryRequest({ name: 'Old Name', isIncome: false }));
    expect(createRes.status).toBe(201);
    const { id } = createRes.body as { id: string };

    const res = await request(app)
      .patch(`/api/v1/categories/${id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(patchCategoryRequest({ name: 'New Name' }));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id,
      name: 'New Name',
      isIncome: false,
    });
  });

  it('returns 400 for a malformed (non-UUID) id', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .patch(`/api/v1/categories/${MALFORMED_ID}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(patchCategoryRequest({ name: 'New Name' }));

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation error' });
  });

  it('returns 404 for unknown id', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .patch(`/api/v1/categories/${UNKNOWN_ID}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(patchCategoryRequest({ name: 'New Name' }));

    expect(res.status).toBe(404);
  });

  it("returns 403 when renaming another user's category", async () => {
    const [{ accessToken: tokenA }, { accessToken: tokenB }] =
      await Promise.all([
        registerUser(app, 'a@example.com'),
        registerUser(app, 'b@example.com'),
      ]);

    const createRes = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(categoryRequest({ name: 'A Category', isIncome: false }));
    expect(createRes.status).toBe(201);
    const { id } = createRes.body as { id: string };

    const res = await request(app)
      .patch(`/api/v1/categories/${id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send(patchCategoryRequest({ name: 'Hijacked' }));

    expect(res.status).toBe(403);
  });

  it('returns 400 for an empty name', async () => {
    const { accessToken } = await registerUser(app);

    const createRes = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(categoryRequest({ name: 'Old Name', isIncome: false }));
    expect(createRes.status).toBe(201);
    const { id } = createRes.body as { id: string };

    const res = await request(app)
      .patch(`/api/v1/categories/${id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(patchCategoryRequest({ name: '' }));

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation error' });
  });
});

describe('DELETE /api/v1/categories/:id', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).delete(`/api/v1/categories/${UNKNOWN_ID}`);
    expect(res.status).toBe(401);
  });

  it('deletes a top-level category and returns 204', async () => {
    const { accessToken } = await registerUser(app);

    const createRes = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(categoryRequest({ name: 'To Delete', isIncome: false }));
    expect(createRes.status).toBe(201);
    const { id } = createRes.body as { id: string };

    const res = await request(app)
      .delete(`/api/v1/categories/${id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(204);

    // Confirm the category no longer appears in the tree
    const listRes = await request(app)
      .get('/api/v1/categories')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(listRes.status).toBe(200);
    const names = (listRes.body as { name: string }[]).map((c) => c.name);
    expect(names).not.toContain('To Delete');
  });

  it('deletes a subcategory and falls back its transactions to the parent', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await createAccount(app, accessToken, {
      name: 'TD Chequing',
      type: 'chequing',
      institution: 'td',
      isCredit: false,
      currency: 'CAD',
    });

    const parentRes = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(categoryRequest({ name: 'Food', isIncome: false }));
    expect(parentRes.status).toBe(201);
    const { id: parentId } = parentRes.body as { id: string };

    const subRes = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(categoryRequest({ name: 'Restaurants', parentId }));
    expect(subRes.status).toBe(201);
    const { id: subId } = subRes.body as { id: string };

    await transactionFixture(accountId, {
      id: VALID_UUID,
      date: '2024-01-15',
      description: 'Sushi Palace',
      rawDescription: 'SUSHI PALACE',
      amount: '45.00',
      categoryId: parentId,
      subcategoryId: subId,
      compositeKey: 'test-sub-delete-txn',
      source: 'manual',
    });

    const res = await request(app)
      .delete(`/api/v1/categories/${subId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(204);

    const txn = await getTransaction(app, accessToken, VALID_UUID);

    expect(txn?.categoryId).toBe(parentId);
    expect(txn?.subcategoryId).toBeNull();
  });

  it('deletes a top-level category and clears the category from its transactions', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await createAccount(app, accessToken, {
      name: 'TD Chequing',
      type: 'chequing',
      institution: 'td',
      isCredit: false,
      currency: 'CAD',
    });

    const createRes = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(categoryRequest({ name: 'Misc', isIncome: false }));
    expect(createRes.status).toBe(201);
    const { id: categoryId } = createRes.body as { id: string };

    await transactionFixture(accountId, {
      id: VALID_UUID,
      date: '2024-01-10',
      description: 'Some Expense',
      rawDescription: 'SOME EXPENSE',
      amount: '20.00',
      categoryId: categoryId,
      compositeKey: 'test-top-delete-txn',
      source: 'manual',
    });

    const res = await request(app)
      .delete(`/api/v1/categories/${categoryId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(204);

    const txn = await getTransaction(app, accessToken, VALID_UUID);

    expect(txn?.categoryId).toBeNull();
    expect(txn?.subcategoryId).toBeNull();
  });

  it('returns 409 when the category has subcategories', async () => {
    const { accessToken } = await registerUser(app);

    const parentRes = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(categoryRequest({ name: 'Parent', isIncome: false }));
    expect(parentRes.status).toBe(201);
    const { id: parentId } = parentRes.body as { id: string };

    const childRes = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(categoryRequest({ name: 'Child', parentId }));
    expect(childRes.status).toBe(201);

    const res = await request(app)
      .delete(`/api/v1/categories/${parentId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(409);
  });

  it('returns 404 for unknown id', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .delete(`/api/v1/categories/${UNKNOWN_ID}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
  });

  it("returns 403 when deleting another user's category", async () => {
    const [{ accessToken: tokenA }, { accessToken: tokenB }] =
      await Promise.all([
        registerUser(app, 'a@example.com'),
        registerUser(app, 'b@example.com'),
      ]);

    const createRes = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(categoryRequest({ name: 'A Category', isIncome: false }));
    expect(createRes.status).toBe(201);
    const { id } = createRes.body as { id: string };

    const res = await request(app)
      .delete(`/api/v1/categories/${id}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(403);
  });

  it('returns 400 for a malformed (non-UUID) id', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .delete(`/api/v1/categories/${MALFORMED_ID}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation error' });
  });
});
