import {
  type AccountResponse,
  cleanDatabase,
  registerAndLogin,
} from '../../testing/test-helpers';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '@/app';
import request from 'supertest';

const app = createApp();

beforeEach(() => cleanDatabase());

describe('GET /api/v1/accounts', () => {
  it('returns empty array for new user', async () => {
    const token = await registerAndLogin(app);
    const res = await request(app)
      .get('/api/v1/accounts')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns only accounts belonging to the authenticated user', async () => {
    const tokenA = await registerAndLogin(app, 'a@example.com');
    const tokenB = await registerAndLogin(app, 'b@example.com');

    await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'A Account', type: 'chequing', institution: 'td', currency: 'CAD', isCredit: false });

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
  it('creates an account and returns it', async () => {
    const token = await registerAndLogin(app);
    const res = await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'My CIBC Card',
        type: 'credit',
        institution: 'cibc',
        currency: 'CAD',
        isCredit: true,
      });

    const body = res.body as AccountResponse;
    expect(res.status).toBe(201);
    expect(body.id).toBeDefined();
    expect(body.name).toBe('My CIBC Card');
    expect(body.type).toBe('credit');
    expect(body.institution).toBe('cibc');
    expect(body.isCredit).toBe(true);
  });

  it('returns 400 for invalid institution', async () => {
    const token = await registerAndLogin(app);
    const res = await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Bad Account',
        type: 'credit',
        institution: 'unknown-bank',
      });

    expect(res.status).toBe(400);
  });

  it('returns 400 when required fields are missing', async () => {
    const token = await registerAndLogin(app);
    const res = await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ institution: 'td' });

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).post('/api/v1/accounts').send({
      name: 'Test',
      type: 'credit',
      institution: 'cibc',
    });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/accounts/:id', () => {
  it('returns account by id', async () => {
    const token = await registerAndLogin(app);
    const createRes = await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'TD Chequing',
        type: 'chequing',
        institution: 'td',
        currency: 'CAD',
        isCredit: false,
      });

    expect(createRes.status).toBe(201);

    const createBody = createRes.body as AccountResponse;
    const res = await request(app)
      .get(`/api/v1/accounts/${createBody.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect((res.body as AccountResponse).id).toBe(createBody.id);
  });

  it('returns 404 for unknown id', async () => {
    const token = await registerAndLogin(app);
    const res = await request(app)
      .get('/api/v1/accounts/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it("returns 404 when accessing another user's account", async () => {
    const tokenA = await registerAndLogin(app, 'a@example.com');
    const tokenB = await registerAndLogin(app, 'b@example.com');

    const createRes = await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'A Account', type: 'chequing', institution: 'td', currency: 'CAD', isCredit: false });

    expect(createRes.status).toBe(201);
    const { id } = createRes.body as AccountResponse;

    const res = await request(app)
      .get(`/api/v1/accounts/${id}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
  });
});
