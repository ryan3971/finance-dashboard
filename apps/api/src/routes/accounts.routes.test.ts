import {
  accounts,
  categorizationRules,
  imports,
  investmentTransactions,
  refreshTokens,
  transactions,
  users,
} from '@/db/schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '@/app';
import { db } from '@/db';
import request from 'supertest';

const app = createApp();

async function registerAndLogin() {
  const res = await request(app).post('/api/v1/auth/register').send({
    email: 'test@example.com',
    password: 'password123',
  });
  return res.body.accessToken as string;
}

beforeEach(async () => {
  await db.delete(transactions);
  await db.delete(investmentTransactions);
  await db.delete(imports);
  await db.delete(accounts);
  await db.delete(refreshTokens);
  await db.delete(categorizationRules);
  await db.delete(users);
});

describe('GET /api/v1/accounts', () => {
  it('returns empty array for new user', async () => {
    const token = await registerAndLogin();
    const res = await request(app)
      .get('/api/v1/accounts')
      .set('Authorization', `Bearer ${token}`);

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
    const token = await registerAndLogin();
    const res = await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'My CIBC Card',
        type: 'credit',
        institution: 'cibc',
        isCredit: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('My CIBC Card');
    expect(res.body.institution).toBe('cibc');
  });

  it('returns 400 for invalid institution', async () => {
    const token = await registerAndLogin();
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
    const token = await registerAndLogin();
    const createRes = await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'TD Chequing',
        type: 'chequing',
        institution: 'td',
      });

    const res = await request(app)
      .get(`/api/v1/accounts/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createRes.body.id);
  });

  it('returns 404 for unknown id', async () => {
    const token = await registerAndLogin();
    const res = await request(app)
      .get('/api/v1/accounts/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
