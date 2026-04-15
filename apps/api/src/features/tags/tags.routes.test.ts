import { beforeEach, describe, expect, it } from 'vitest';
import {
  cleanDatabase,
  createAccount,
  createTag,
  uploadAmex,
  registerUser,
  getFirstTransaction,
} from '@/testing/test-helpers';
import { createApp } from '@/app';
import request from 'supertest';
import { UNKNOWN_ID, MALFORMED_ID } from '@/testing/constants';
import type { TagResponse } from '@/testing/types';

const app = createApp();

beforeEach(() => cleanDatabase());

// ── GET /api/v1/tags ──────────────────────────────────────────────────────────

describe('GET /api/v1/tags', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/v1/tags');
    expect(res.status).toBe(401);
  });

  it('returns an empty array for a new user', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .get('/api/v1/tags')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns all created tags with expected fields', async () => {
    const { accessToken } = await registerUser(app);
    await createTag(app, accessToken, 'Reimbursable');

    const res = await request(app)
      .get('/api/v1/tags')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const body = res.body as TagResponse[];
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      id: expect.any(String) as string,
      name: 'Reimbursable',
      color: null,
      createdAt: expect.any(String) as string,
    });
  });

  it('returns tags ordered alphabetically by name', async () => {
    const { accessToken } = await registerUser(app);
    // Insert in reverse alphabetical order to confirm DB-level ordering
    await createTag(app, accessToken, 'Zebra');
    await createTag(app, accessToken, 'Alpha');
    await createTag(app, accessToken, 'Mango');

    const res = await request(app)
      .get('/api/v1/tags')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const names = (res.body as TagResponse[]).map((t) => t.name);
    expect(names).toEqual(['Alpha', 'Mango', 'Zebra']);
  });

  it("does not return another user's tags", async () => {
    const [{ accessToken: tokenA }, { accessToken: tokenB }] =
      await Promise.all([
        registerUser(app, 'a@example.com'),
        registerUser(app, 'b@example.com'),
      ]);

    await createTag(app, tokenA, 'User A Tag');

    const res = await request(app)
      .get('/api/v1/tags')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ── POST /api/v1/tags ─────────────────────────────────────────────────────────

describe('POST /api/v1/tags', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).post('/api/v1/tags').send({ name: 'Test' });
    expect(res.status).toBe(401);
  });

  it('creates a tag with just a name and returns all fields', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/tags')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Reimbursable' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(String) as string,
      name: 'Reimbursable',
      color: null,
      createdAt: expect.any(String) as string,
    });
  });

  it('creates a tag with an optional color', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/tags')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Personal', color: '#FF5733' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Personal', color: '#FF5733' });
  });

  it('returns 409 when the name is already taken by the same user', async () => {
    const { accessToken } = await registerUser(app);
    await createTag(app, accessToken, 'Duplicate');

    const res = await request(app)
      .post('/api/v1/tags')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Duplicate' });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ error: 'A tag with that name already exists' });
  });

  it('allows the same tag name to be used by different users', async () => {
    const [{ accessToken: tokenA }, { accessToken: tokenB }] =
      await Promise.all([
        registerUser(app, 'a@example.com'),
        registerUser(app, 'b@example.com'),
      ]);

    const resA = await request(app)
      .post('/api/v1/tags')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Shared Name' });

    const resB = await request(app)
      .post('/api/v1/tags')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Shared Name' });

    expect(resA.status).toBe(201);
    expect(resB.status).toBe(201);
  });

  it('returns 400 for an empty name', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/tags')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: '' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation error' });
  });

  it('returns 400 when name exceeds 15 characters', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/tags')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'a'.repeat(16) });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation error' });
  });

  it('returns 400 for an invalid color format', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/tags')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Tagged', color: 'red' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation error' });
  });
});

// ── DELETE /api/v1/tags/:id ───────────────────────────────────────────────────

describe('DELETE /api/v1/tags/:id', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).delete(`/api/v1/tags/${UNKNOWN_ID}`);
    expect(res.status).toBe(401);
  });

  it('deletes a tag and returns 204', async () => {
    const { accessToken } = await registerUser(app);
    const tagId = await createTag(app, accessToken, 'To Delete');

    const res = await request(app)
      .delete(`/api/v1/tags/${tagId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(204);
  });

  it('deleted tag no longer appears in the list', async () => {
    const { accessToken } = await registerUser(app);
    const tagId = await createTag(app, accessToken, 'Gone');

    await request(app)
      .delete(`/api/v1/tags/${tagId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    const listRes = await request(app)
      .get('/api/v1/tags')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body).toEqual([]);
  });

  it('returns 404 for an unknown id', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .delete(`/api/v1/tags/${UNKNOWN_ID}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'Tag not found' });
  });

  it("returns 404 when deleting another user's tag", async () => {
    const [{ accessToken: tokenA }, { accessToken: tokenB }] =
      await Promise.all([
        registerUser(app, 'a@example.com'),
        registerUser(app, 'b@example.com'),
      ]);

    const tagId = await createTag(app, tokenA, 'User A Tag');

    const res = await request(app)
      .delete(`/api/v1/tags/${tagId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
  });

  it('returns 400 for a malformed (non-UUID) id', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .delete(`/api/v1/tags/${MALFORMED_ID}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation error' });
  });

  it('cascade-removes the tag from transactions when the tag is deleted', async () => {
    const { accessToken } = await registerUser(app);
    const accountId = await createAccount(app, accessToken, {
      name: 'My AMEX',
      type: 'credit',
      institution: 'amex',
      currency: 'CAD',
      isCredit: true,
    });
    await uploadAmex(app, accessToken, accountId);
    const txn = await getFirstTransaction(app, accessToken);
    const tagId = await createTag(app, accessToken, 'Reimbursable');

    await request(app)
      .post(`/api/v1/transactions/${txn.id}/tags`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ tagId });

    await request(app)
      .delete(`/api/v1/tags/${tagId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    const txnRes = await request(app)
      .get('/api/v1/transactions')
      .set('Authorization', `Bearer ${accessToken}`);

    interface TxnWithTags {
      id: string;
      tags: { id: string }[];
    }

    const updated = (txnRes.body as { data: TxnWithTags[] }).data.find(
      (t) => t.id === txn.id
    );
    expect(updated?.tags.some((t) => t.id === tagId)).toBe(false);
  });
});
