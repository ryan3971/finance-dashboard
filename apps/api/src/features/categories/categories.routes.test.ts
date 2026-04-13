import { categories } from '@/db/schema';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  cleanDatabase,
  registerUser,
} from '../../testing/test-helpers';
import { createApp } from '@/app';
import { db } from '@/db';
import request from 'supertest';
import { assertDefined } from '@/lib/assert';

const app = createApp();

beforeEach(() => cleanDatabase());

describe('GET /api/v1/categories', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/v1/categories');
    expect(res.status).toBe(401);
  });

  it('returns system categories for authenticated user', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .get('/api/v1/categories')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const systemCategories = (res.body as { userId: string | null }[]).filter(
      (c) => c.userId === null
    );
    expect(systemCategories.length).toBeGreaterThan(0);
  });

  it('includes user-specific categories in the response', async () => {
    const { accessToken, user } = await registerUser(app);

    await db.insert(categories).values({
      name: 'My Custom Category',
      isIncome: false,
      userId: user.id,
    });

    const res = await request(app)
      .get('/api/v1/categories')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const names = (res.body as { name: string }[]).map((c) => c.name);
    expect(names).toContain('My Custom Category');
  });

  it('nests subcategories under their parent', async () => {
    const { accessToken, user } = await registerUser(app);

    const [parent] = await db
      .insert(categories)
      .values({ name: 'Parent', isIncome: false, userId: user.id })
      .returning({ id: categories.id });
    assertDefined(parent, 'Expected parent category insert to return a row');

    await db.insert(categories).values({
      name: 'Child',
      isIncome: false,
      userId: user.id,
      parentId: parent.id,
    });

    const res = await request(app)
      .get('/api/v1/categories')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);

    interface CategoryTreeItem {
      name: string;
      subcategories: { name: string }[];
    }

    const tree = res.body as CategoryTreeItem[];
    const parentNode = tree.find((c) => c.name === 'Parent');
    expect(parentNode).toBeDefined();
    expect(parentNode?.subcategories).toHaveLength(1);
    expect(parentNode?.subcategories[0]?.name).toBe('Child');
  });

  it("does not include another user's categories", async () => {
    const { accessToken: tokenB } = await registerUser(app, 'b@example.com');
    const { user: userA } = await registerUser(app, 'a@example.com');

    await db.insert(categories).values({
      name: 'User A Private',
      isIncome: false,
      userId: userA.id,
    });

    const res = await request(app)
      .get('/api/v1/categories')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    const names = (res.body as { name: string }[]).map((c) => c.name);
    expect(names).not.toContain('User A Private');
  });
});
