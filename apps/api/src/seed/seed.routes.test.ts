import {
  cleanDatabase,
  createAccount,
  registerUser,
} from '@/testing/test-helpers';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '@/app';
import request from 'supertest';

const app = createApp();

beforeEach(() => cleanDatabase());
// loadSampleData inserts anticipated_budget rows referencing system category IDs.
// Without this cleanup the global resetTestSystemData() in setup.ts will fail on
// the next test run because those rows still exist and block the category delete.
afterAll(() => cleanDatabase());

describe('POST /api/v1/seed/load', () => {
  describe('auth', () => {
    it('returns 401 when Authorization header is absent', async () => {
      const res = await request(app).post('/api/v1/seed/load');
      expect(res.status).toBe(401);
    });

    it('returns 401 for a malformed Bearer token', async () => {
      const res = await request(app)
        .post('/api/v1/seed/load')
        .set('Authorization', 'Bearer not.a.valid.jwt');
      expect(res.status).toBe(401);
    });
  });

  it('returns 200 and inserts fixture accounts and transactions', async () => {
    const { accessToken } = await registerUser(app);

    const res = await request(app)
      .post('/api/v1/seed/load')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ message: 'Sample data loaded' });

    // Verify accounts were created
    const accountsRes = await request(app)
      .get('/api/v1/accounts')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(accountsRes.status).toBe(200);
    expect((accountsRes.body as unknown[]).length).toBeGreaterThan(0);

    // Verify transactions were imported
    const txRes = await request(app)
      .get('/api/v1/transactions')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(txRes.status).toBe(200);
    interface PaginatedBody { pagination: { total: number } }
    expect((txRes.body as PaginatedBody).pagination.total).toBeGreaterThan(0);
  });

  it('returns 409 when user already has accounts', async () => {
    const { accessToken } = await registerUser(app);

    await createAccount(app, accessToken, {
      name: 'My Chequing',
      type: 'chequing',
      institution: 'td',
      isCredit: false,
      currency: 'CAD',
    });

    const res = await request(app)
      .post('/api/v1/seed/load')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(409);
  });

  it('scopes seed data to the authenticated user', async () => {
    const userA = await registerUser(app, 'a@example.com');
    const userB = await registerUser(app, 'b@example.com');

    await request(app)
      .post('/api/v1/seed/load')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    // User B's account list should still be empty
    const res = await request(app)
      .get('/api/v1/accounts')
      .set('Authorization', `Bearer ${userB.accessToken}`);
    expect((res.body as unknown[]).length).toBe(0);
  });
});
