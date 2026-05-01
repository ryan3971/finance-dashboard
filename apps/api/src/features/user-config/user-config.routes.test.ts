import {
  cleanDatabase,
  createAccount,
  registerUser,
} from '@/testing/test-helpers';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '@/app';
import request from 'supertest';
import type { UserConfigResponse } from '@/testing/types';

const app = createApp();

beforeEach(() => cleanDatabase());

describe('GET /api/v1/user-config', () => {
  describe('auth', () => {
    it('returns 401 when Authorization header is absent', async () => {
      const res = await request(app).get('/api/v1/user-config');
      expect(res.status).toBe(401);
    });

    it('returns 401 for a malformed Bearer token', async () => {
      const res = await request(app)
        .get('/api/v1/user-config')
        .set('Authorization', 'Bearer not.a.valid.jwt');
      expect(res.status).toBe(401);
    });
  });

  it('returns 200 with a config object with null percentages for a new user', async () => {
    const { accessToken } = await registerUser(app);

    const res = await request(app)
      .get('/api/v1/user-config')
      .set('Authorization', `Bearer ${accessToken}`);

    const body = res.body as UserConfigResponse;
    expect(res.status).toBe(200);
    expect(body.id).toBeDefined();
    expect(body.userId).toBeDefined();
    expect(body.needsPercentage).toBeNull();
    expect(body.wantsPercentage).toBeNull();
    expect(body.investmentsPercentage).toBeNull();
    expect(body.emergencyFundTarget).toBeNull();
    expect(body.updatedAt).toBeDefined();
  });

  it('is idempotent — repeated GETs return the same config row', async () => {
    const { accessToken } = await registerUser(app);

    const first = await request(app)
      .get('/api/v1/user-config')
      .set('Authorization', `Bearer ${accessToken}`);

    const second = await request(app)
      .get('/api/v1/user-config')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect((first.body as UserConfigResponse).id).toBe(
      (second.body as UserConfigResponse).id
    );
  });

  it('scopes config to the authenticated user', async () => {
    const userA = await registerUser(app, 'a@example.com');
    const userB = await registerUser(app, 'b@example.com');

    const resA = await request(app)
      .get('/api/v1/user-config')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    const resB = await request(app)
      .get('/api/v1/user-config')
      .set('Authorization', `Bearer ${userB.accessToken}`);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    expect((resA.body as UserConfigResponse).id).not.toBe(
      (resB.body as UserConfigResponse).id
    );
    expect((resA.body as UserConfigResponse).userId).toBe(userA.user.id);
    expect((resB.body as UserConfigResponse).userId).toBe(userB.user.id);
  });
});

describe('PATCH /api/v1/user-config', () => {
  describe('auth', () => {
    it('returns 401 when Authorization header is absent', async () => {
      const res = await request(app)
        .patch('/api/v1/user-config')
        .send({
          allocations: {
            needsPercentage: 50,
            wantsPercentage: 30,
            investmentsPercentage: 20,
          },
        });
      expect(res.status).toBe(401);
    });

    it('returns 401 for a malformed Bearer token', async () => {
      const res = await request(app)
        .patch('/api/v1/user-config')
        .set('Authorization', 'Bearer not.a.valid.jwt')
        .send({
          allocations: {
            needsPercentage: 50,
            wantsPercentage: 30,
            investmentsPercentage: 20,
          },
        });
      expect(res.status).toBe(401);
    });
  });

  it('updates allocations and returns the updated config', async () => {
    const { accessToken } = await registerUser(app);

    const res = await request(app)
      .patch('/api/v1/user-config')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        allocations: {
          needsPercentage: 50,
          wantsPercentage: 30,
          investmentsPercentage: 20,
        },
      });

    const body = res.body as UserConfigResponse;
    expect(res.status).toBe(200);
    expect(body.needsPercentage).toBe(50);
    expect(body.wantsPercentage).toBe(30);
    expect(body.investmentsPercentage).toBe(20);
  });

  it('returns the existing config unchanged when no fields are provided', async () => {
    const { accessToken } = await registerUser(app);

    // First establish a known state
    await request(app)
      .patch('/api/v1/user-config')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        allocations: {
          needsPercentage: 60,
          wantsPercentage: 20,
          investmentsPercentage: 20,
        },
      });

    // PATCH with empty body should be a no-op
    const res = await request(app)
      .patch('/api/v1/user-config')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    const body = res.body as UserConfigResponse;
    expect(res.status).toBe(200);
    expect(body.needsPercentage).toBe(60);
    expect(body.wantsPercentage).toBe(20);
    expect(body.investmentsPercentage).toBe(20);
  });

  it('persists the update — subsequent GET reflects new values', async () => {
    const { accessToken } = await registerUser(app);

    await request(app)
      .patch('/api/v1/user-config')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        allocations: {
          needsPercentage: 40,
          wantsPercentage: 40,
          investmentsPercentage: 20,
        },
      });

    const res = await request(app)
      .get('/api/v1/user-config')
      .set('Authorization', `Bearer ${accessToken}`);

    const body = res.body as UserConfigResponse;
    expect(res.status).toBe(200);
    expect(body.needsPercentage).toBe(40);
    expect(body.wantsPercentage).toBe(40);
    expect(body.investmentsPercentage).toBe(20);
  });

  it("does not affect another user's config", async () => {
    const userA = await registerUser(app, 'a@example.com');
    const userB = await registerUser(app, 'b@example.com');

    // Give user B some allocations
    await request(app)
      .patch('/api/v1/user-config')
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .send({
        allocations: {
          needsPercentage: 60,
          wantsPercentage: 20,
          investmentsPercentage: 20,
        },
      });

    // User A patches their own config
    await request(app)
      .patch('/api/v1/user-config')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({
        allocations: {
          needsPercentage: 50,
          wantsPercentage: 30,
          investmentsPercentage: 20,
        },
      });

    // User B's config should be unchanged
    const resB = await request(app)
      .get('/api/v1/user-config')
      .set('Authorization', `Bearer ${userB.accessToken}`);

    const bodyB = resB.body as UserConfigResponse;
    expect(bodyB.needsPercentage).toBe(60);
    expect(bodyB.wantsPercentage).toBe(20);
    expect(bodyB.investmentsPercentage).toBe(20);
  });

  describe('emergencyFundTarget', () => {
    it('sets a positive target and returns it as a string', async () => {
      const { accessToken } = await registerUser(app);

      const res = await request(app)
        .patch('/api/v1/user-config')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ emergencyFundTarget: 10000 });

      const body = res.body as UserConfigResponse;
      expect(res.status).toBe(200);
      expect(body.emergencyFundTarget).toBe('10000.00');
    });

    it('treats 0 as clearing the target — returns null', async () => {
      const { accessToken } = await registerUser(app);

      await request(app)
        .patch('/api/v1/user-config')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ emergencyFundTarget: 5000 });

      const res = await request(app)
        .patch('/api/v1/user-config')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ emergencyFundTarget: 0 });

      const body = res.body as UserConfigResponse;
      expect(res.status).toBe(200);
      expect(body.emergencyFundTarget).toBeNull();
    });

    it('clears the target when null is sent', async () => {
      const { accessToken } = await registerUser(app);

      await request(app)
        .patch('/api/v1/user-config')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ emergencyFundTarget: 8000 });

      const res = await request(app)
        .patch('/api/v1/user-config')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ emergencyFundTarget: null });

      const body = res.body as UserConfigResponse;
      expect(res.status).toBe(200);
      expect(body.emergencyFundTarget).toBeNull();
    });

    it('returns 400 when a negative value is sent', async () => {
      const { accessToken } = await registerUser(app);

      const res = await request(app)
        .patch('/api/v1/user-config')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ emergencyFundTarget: -100 });

      expect(res.status).toBe(400);
    });

    it('persists the target — subsequent GET reflects the new value', async () => {
      const { accessToken } = await registerUser(app);

      await request(app)
        .patch('/api/v1/user-config')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ emergencyFundTarget: 15000.50 });

      const res = await request(app)
        .get('/api/v1/user-config')
        .set('Authorization', `Bearer ${accessToken}`);

      const body = res.body as UserConfigResponse;
      expect(res.status).toBe(200);
      expect(body.emergencyFundTarget).toBe('15000.50');
    });
  });

  describe('allocation validation', () => {
    it('returns 400 when percentages do not sum to 100', async () => {
      const { accessToken } = await registerUser(app);

      const res = await request(app)
        .patch('/api/v1/user-config')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          allocations: {
            needsPercentage: 50,
            wantsPercentage: 30,
            investmentsPercentage: 10,
          },
        });

      expect(res.status).toBe(400);
    });

    it('returns 400 when a percentage is negative', async () => {
      const { accessToken } = await registerUser(app);

      const res = await request(app)
        .patch('/api/v1/user-config')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          allocations: {
            needsPercentage: -10,
            wantsPercentage: 60,
            investmentsPercentage: 50,
          },
        });

      expect(res.status).toBe(400);
    });

    it('returns 400 when a percentage exceeds 100', async () => {
      const { accessToken } = await registerUser(app);

      const res = await request(app)
        .patch('/api/v1/user-config')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          allocations: {
            needsPercentage: 110,
            wantsPercentage: 0,
            investmentsPercentage: 0,
          },
        });

      expect(res.status).toBe(400);
    });

    it('returns 400 when a percentage is not an integer', async () => {
      const { accessToken } = await registerUser(app);

      const res = await request(app)
        .patch('/api/v1/user-config')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          allocations: {
            needsPercentage: 33.33,
            wantsPercentage: 33.33,
            investmentsPercentage: 33.34,
          },
        });

      expect(res.status).toBe(400);
    });

    it('returns 400 when a required allocation field is missing', async () => {
      const { accessToken } = await registerUser(app);

      const res = await request(app)
        .patch('/api/v1/user-config')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          allocations: {
            needsPercentage: 50,
            wantsPercentage: 50,
            // investmentsPercentage missing
          },
        });

      expect(res.status).toBe(400);
    });

    it('accepts allocations that sum to exactly 100 with a zero field', async () => {
      const { accessToken } = await registerUser(app);

      const res = await request(app)
        .patch('/api/v1/user-config')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          allocations: {
            needsPercentage: 100,
            wantsPercentage: 0,
            investmentsPercentage: 0,
          },
        });

      const body = res.body as UserConfigResponse;
      expect(res.status).toBe(200);
      expect(body.needsPercentage).toBe(100);
      expect(body.wantsPercentage).toBe(0);
      expect(body.investmentsPercentage).toBe(0);
    });
  });
});

describe('POST /api/v1/user-config/reset', () => {
  describe('auth', () => {
    it('returns 401 when Authorization header is absent', async () => {
      const res = await request(app).post('/api/v1/user-config/reset');
      expect(res.status).toBe(401);
    });

    it('returns 401 for a malformed Bearer token', async () => {
      const res = await request(app)
        .post('/api/v1/user-config/reset')
        .set('Authorization', 'Bearer not.a.valid.jwt');
      expect(res.status).toBe(401);
    });
  });

  it('returns 200 on success', async () => {
    const { accessToken } = await registerUser(app);

    const res = await request(app)
      .post('/api/v1/user-config/reset')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ message: 'Account reset' });
  });

  it('deletes user accounts and transactions', async () => {
    const { accessToken } = await registerUser(app);

    await createAccount(app, accessToken, {
      name: 'My Chequing',
      type: 'chequing',
      institution: 'td',
      isCredit: false,
      currency: 'CAD',
    });

    await request(app)
      .post('/api/v1/user-config/reset')
      .set('Authorization', `Bearer ${accessToken}`);

    const accountsRes = await request(app)
      .get('/api/v1/accounts')
      .set('Authorization', `Bearer ${accessToken}`);

    expect((accountsRes.body as unknown[]).length).toBe(0);
  });

  it('re-seeds default categories after reset', async () => {
    const { accessToken } = await registerUser(app);

    await request(app)
      .post('/api/v1/user-config/reset')
      .set('Authorization', `Bearer ${accessToken}`);

    const catRes = await request(app)
      .get('/api/v1/categories')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(catRes.status).toBe(200);
    expect((catRes.body as unknown[]).length).toBeGreaterThan(0);
  });

  it('is idempotent — calling reset twice leaves account in the same state', async () => {
    const { accessToken } = await registerUser(app);

    await request(app)
      .post('/api/v1/user-config/reset')
      .set('Authorization', `Bearer ${accessToken}`);

    const res = await request(app)
      .post('/api/v1/user-config/reset')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);

    const catRes = await request(app)
      .get('/api/v1/categories')
      .set('Authorization', `Bearer ${accessToken}`);
    expect((catRes.body as unknown[]).length).toBeGreaterThan(0);
  });

  it('does not delete the user row — user remains authenticated', async () => {
    const { accessToken } = await registerUser(app);

    await request(app)
      .post('/api/v1/user-config/reset')
      .set('Authorization', `Bearer ${accessToken}`);

    // Token remains valid: user-config endpoint returns 200, not 401
    const configRes = await request(app)
      .get('/api/v1/user-config')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(configRes.status).toBe(200);
  });
});
