import { beforeEach, describe, expect, it } from 'vitest';
import { cleanDatabase, registerUser } from '@/testing/test-helpers';
import { createApp } from '@/app';
import request from 'supertest';
import type { AccountRequest, AccountResponse, PatchAccountRequest } from '@/testing/types';

const app = createApp();

beforeEach(() => cleanDatabase());

const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';
const MALFORMED_ID = 'not-a-uuid';

// .send() accepts `any`; these wrappers give TypeScript a surface to type-check
// test inputs against the declared request shape without importing schema files.
const accountRequest = (body: AccountRequest): AccountRequest => body;
const patchAccountRequest = (body: PatchAccountRequest): PatchAccountRequest => body;

describe('GET /api/v1/accounts', () => {
  it('returns empty array for new user', async () => {
    const { accessToken: token } = await registerUser(app);
    const res = await request(app)
      .get('/api/v1/accounts')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('filters inactive accounts by default; includes them when ?includeInactive=true', async () => {
    const { accessToken: token } = await registerUser(app);

    const createRes = await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send(
        accountRequest({
          name: 'TD Chequing',
          type: 'chequing',
          institution: 'td',
          currency: 'CAD',
          isCredit: false,
        })
      );
    expect(createRes.status).toBe(201);
    const { id } = createRes.body as AccountResponse;

    const deactivateRes = await request(app)
      .post(`/api/v1/accounts/${id}/deactivate`)
      .set('Authorization', `Bearer ${token}`);
    expect(deactivateRes.status).toBe(200);

    const defaultRes = await request(app)
      .get('/api/v1/accounts')
      .set('Authorization', `Bearer ${token}`);
    expect(defaultRes.status).toBe(200);
    expect(defaultRes.body).toEqual([]);

    const allRes = await request(app)
      .get('/api/v1/accounts?includeInactive=true')
      .set('Authorization', `Bearer ${token}`);
    expect(allRes.status).toBe(200);
    expect(allRes.body).toHaveLength(1);
    expect((allRes.body as AccountResponse[])[0]).toMatchObject({ id, isActive: false });
  });

  it('returns only accounts belonging to the authenticated user', async () => {
    const [{ accessToken: tokenA }, { accessToken: tokenB }] = await Promise.all([
      registerUser(app, 'a@example.com'),
      registerUser(app, 'b@example.com'),
    ]);

    const createRes = await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(
        accountRequest({
          name: 'A Account',
          type: 'chequing',
          institution: 'td',
          currency: 'CAD',
          isCredit: false,
        })
      );
    expect(createRes.status).toBe(201);

    const res = await request(app)
      .get('/api/v1/accounts')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/v1/accounts');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/accounts', () => {
  it('creates an account and returns all fields', async () => {
    const { accessToken: token } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send(
        accountRequest({
          name: 'My CIBC Card',
          type: 'credit',
          institution: 'cibc',
          currency: 'CAD',
          isCredit: true,
        })
      );

    const body = res.body as AccountResponse;
    expect(res.status).toBe(201);
    expect(body.id).toBeDefined();
    expect(res.body).toMatchObject({
      name: 'My CIBC Card',
      type: 'credit',
      institution: 'cibc',
      currency: 'CAD',
      isCredit: true,
      isActive: true,
    });
    expect(typeof body.createdAt).toBe('string');
  });

  it('derives isCredit from type, ignoring the request body value', async () => {
    const { accessToken: token } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send(
        accountRequest({
          name: 'TD Chequing',
          type: 'chequing',
          institution: 'td',
          currency: 'CAD',
          isCredit: true, // contradicts type; service must override to false
        })
      );

    expect(res.status).toBe(201);
    expect((res.body as AccountResponse).isCredit).toBe(false);
  });

  it('returns 400 for invalid institution', async () => {
    const { accessToken: token } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Bad Account', type: 'credit', institution: 'unknown-bank', currency: 'CAD', isCredit: true });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation error' });
  });

  it('returns 400 for invalid type', async () => {
    const { accessToken: token } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Bad Account', type: 'wallet', institution: 'td', currency: 'CAD', isCredit: false });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation error' });
  });

  it('returns 400 when required fields are missing', async () => {
    const { accessToken: token } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ institution: 'td' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation error' });
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/v1/accounts')
      .send(
        accountRequest({
          name: 'Test',
          type: 'credit',
          institution: 'cibc',
          currency: 'CAD',
          isCredit: true,
        })
      );
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/accounts/:id', () => {
  it('returns the full account shape for an owned account', async () => {
    const { accessToken: token } = await registerUser(app);
    const createRes = await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send(
        accountRequest({
          name: 'TD Chequing',
          type: 'chequing',
          institution: 'td',
          currency: 'CAD',
          isCredit: false,
        })
      );
    expect(createRes.status).toBe(201);

    const createBody = createRes.body as AccountResponse;
    const res = await request(app)
      .get(`/api/v1/accounts/${createBody.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: createBody.id,
      name: 'TD Chequing',
      type: 'chequing',
      institution: 'td',
      currency: 'CAD',
      isCredit: false,
      isActive: true,
    });
    expect(typeof (res.body as AccountResponse).createdAt).toBe('string');
  });

  it('returns 404 for unknown id', async () => {
    const { accessToken: token } = await registerUser(app);
    const res = await request(app)
      .get(`/api/v1/accounts/${UNKNOWN_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it("returns 404 when accessing another user's account", async () => {
    const [{ accessToken: tokenA }, { accessToken: tokenB }] = await Promise.all([
      registerUser(app, 'a@example.com'),
      registerUser(app, 'b@example.com'),
    ]);

    const createRes = await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(
        accountRequest({
          name: 'A Account',
          type: 'chequing',
          institution: 'td',
          currency: 'CAD',
          isCredit: false,
        })
      );
    expect(createRes.status).toBe(201);
    const { id } = createRes.body as AccountResponse;

    const res = await request(app)
      .get(`/api/v1/accounts/${id}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).get(`/api/v1/accounts/${UNKNOWN_ID}`);
    expect(res.status).toBe(401);
  });

  it('returns 500 for a malformed (non-UUID) id', async () => {
    const { accessToken: token } = await registerUser(app);
    const res = await request(app)
      .get(`/api/v1/accounts/${MALFORMED_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/v1/accounts/:id', () => {
  it('updates account fields and returns the updated shape', async () => {
    const { accessToken: token } = await registerUser(app);
    const createRes = await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send(
        accountRequest({
          name: 'Old Name',
          type: 'chequing',
          institution: 'td',
          currency: 'CAD',
          isCredit: false,
        })
      );
    expect(createRes.status).toBe(201);
    const { id } = createRes.body as AccountResponse;

    const res = await request(app)
      .patch(`/api/v1/accounts/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(patchAccountRequest({ name: 'New Name' }));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id,
      name: 'New Name',
      type: 'chequing',
      institution: 'td',
      isActive: true,
    });
  });

  it('updating type to credit auto-sets isCredit to true', async () => {
    const { accessToken: token } = await registerUser(app);
    const createRes = await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send(
        accountRequest({
          name: 'TD Chequing',
          type: 'chequing',
          institution: 'td',
          currency: 'CAD',
          isCredit: false,
        })
      );
    expect(createRes.status).toBe(201);
    const { id } = createRes.body as AccountResponse;

    const res = await request(app)
      .patch(`/api/v1/accounts/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(patchAccountRequest({ type: 'credit' }));

    expect(res.status).toBe(200);
    expect((res.body as AccountResponse).isCredit).toBe(true);
  });

  it('returns 400 for an empty body', async () => {
    const { accessToken: token } = await registerUser(app);
    const createRes = await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send(
        accountRequest({
          name: 'TD Chequing',
          type: 'chequing',
          institution: 'td',
          currency: 'CAD',
          isCredit: false,
        })
      );
    expect(createRes.status).toBe(201);
    const { id } = createRes.body as AccountResponse;

    const res = await request(app)
      .patch(`/api/v1/accounts/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation error' });
  });

  it('returns 400 for a malformed (non-UUID) id', async () => {
    const { accessToken: token } = await registerUser(app);
    const res = await request(app)
      .patch(`/api/v1/accounts/${MALFORMED_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send(patchAccountRequest({ name: 'New Name' }));

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation error' });
  });

  it('returns 404 for unknown id', async () => {
    const { accessToken: token } = await registerUser(app);
    const res = await request(app)
      .patch(`/api/v1/accounts/${UNKNOWN_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send(patchAccountRequest({ name: 'New Name' }));

    expect(res.status).toBe(404);
  });

  it("returns 404 when patching another user's account", async () => {
    const [{ accessToken: tokenA }, { accessToken: tokenB }] = await Promise.all([
      registerUser(app, 'a@example.com'),
      registerUser(app, 'b@example.com'),
    ]);

    const createRes = await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(
        accountRequest({
          name: 'A Account',
          type: 'chequing',
          institution: 'td',
          currency: 'CAD',
          isCredit: false,
        })
      );
    expect(createRes.status).toBe(201);
    const { id } = createRes.body as AccountResponse;

    const res = await request(app)
      .patch(`/api/v1/accounts/${id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send(patchAccountRequest({ name: 'Hijacked' }));

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .patch(`/api/v1/accounts/${UNKNOWN_ID}`)
      .send(patchAccountRequest({ name: 'New Name' }));
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/accounts/:id/deactivate', () => {
  it('sets isActive to false and returns the updated account', async () => {
    const { accessToken: token } = await registerUser(app);
    const createRes = await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send(
        accountRequest({
          name: 'TD Chequing',
          type: 'chequing',
          institution: 'td',
          currency: 'CAD',
          isCredit: false,
        })
      );
    expect(createRes.status).toBe(201);
    const { id } = createRes.body as AccountResponse;

    const res = await request(app)
      .post(`/api/v1/accounts/${id}/deactivate`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id, isActive: false });
  });

  it('returns 400 for a malformed (non-UUID) id', async () => {
    const { accessToken: token } = await registerUser(app);
    const res = await request(app)
      .post(`/api/v1/accounts/${MALFORMED_ID}/deactivate`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation error' });
  });

  it('returns 404 for unknown id', async () => {
    const { accessToken: token } = await registerUser(app);
    const res = await request(app)
      .post(`/api/v1/accounts/${UNKNOWN_ID}/deactivate`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it("returns 404 when deactivating another user's account", async () => {
    const [{ accessToken: tokenA }, { accessToken: tokenB }] = await Promise.all([
      registerUser(app, 'a@example.com'),
      registerUser(app, 'b@example.com'),
    ]);

    const createRes = await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(
        accountRequest({
          name: 'A Account',
          type: 'chequing',
          institution: 'td',
          currency: 'CAD',
          isCredit: false,
        })
      );
    expect(createRes.status).toBe(201);
    const { id } = createRes.body as AccountResponse;

    const res = await request(app)
      .post(`/api/v1/accounts/${id}/deactivate`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).post(`/api/v1/accounts/${UNKNOWN_ID}/deactivate`);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/accounts/:id/reactivate', () => {
  it('sets isActive back to true for a deactivated account', async () => {
    const { accessToken: token } = await registerUser(app);
    const createRes = await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send(
        accountRequest({
          name: 'TD Chequing',
          type: 'chequing',
          institution: 'td',
          currency: 'CAD',
          isCredit: false,
        })
      );
    expect(createRes.status).toBe(201);
    const { id } = createRes.body as AccountResponse;

    const deactivateRes = await request(app)
      .post(`/api/v1/accounts/${id}/deactivate`)
      .set('Authorization', `Bearer ${token}`);
    expect(deactivateRes.status).toBe(200);

    const res = await request(app)
      .post(`/api/v1/accounts/${id}/reactivate`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id, isActive: true });
  });

  it('returns 400 for a malformed (non-UUID) id', async () => {
    const { accessToken: token } = await registerUser(app);
    const res = await request(app)
      .post(`/api/v1/accounts/${MALFORMED_ID}/reactivate`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation error' });
  });

  it('returns 404 for unknown id', async () => {
    const { accessToken: token } = await registerUser(app);
    const res = await request(app)
      .post(`/api/v1/accounts/${UNKNOWN_ID}/reactivate`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it("returns 404 when reactivating another user's account", async () => {
    const [{ accessToken: tokenA }, { accessToken: tokenB }] = await Promise.all([
      registerUser(app, 'a@example.com'),
      registerUser(app, 'b@example.com'),
    ]);

    const createRes = await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(
        accountRequest({
          name: 'A Account',
          type: 'chequing',
          institution: 'td',
          currency: 'CAD',
          isCredit: false,
        })
      );
    expect(createRes.status).toBe(201);
    const { id } = createRes.body as AccountResponse;

    const res = await request(app)
      .post(`/api/v1/accounts/${id}/reactivate`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).post(`/api/v1/accounts/${UNKNOWN_ID}/reactivate`);
    expect(res.status).toBe(401);
  });
});
