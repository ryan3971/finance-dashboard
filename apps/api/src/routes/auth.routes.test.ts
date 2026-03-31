import {
  accounts,
  categorizationRules,
  imports,
  investmentTransactions,
  refreshTokens,
  transactions,
  users,
} from '../db/schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { db } from '../db';
import request from 'supertest';

const app = createApp();

beforeEach(async () => {
  // Clean up in FK-dependency order (children before parents)
  await db.delete(transactions);
  await db.delete(investmentTransactions);
  await db.delete(imports);
  await db.delete(accounts);
  await db.delete(refreshTokens);
  await db.delete(categorizationRules);
  await db.delete(users);
});

describe('POST /api/v1/auth/register', () => {
  it('creates a user and returns access token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
      });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe('test@example.com');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('returns 409 for duplicate email', async () => {
    await request(app).post('/api/v1/auth/register').send({
      email: 'test@example.com',
      password: 'password123',
    });

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'test@example.com',
        password: 'different',
      });

    expect(res.status).toBe(409);
  });

  it('returns 400 for invalid email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'not-an-email',
        password: 'password123',
      });

    expect(res.status).toBe(400);
  });

  it('returns 400 for short password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'test@example.com',
        password: 'short',
      });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/v1/auth/register').send({
      email: 'test@example.com',
      password: 'password123',
    });
  });

  it('returns tokens for valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123',
      });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'test@example.com',
        password: 'wrongpassword',
      });

    expect(res.status).toBe(401);
  });

  it('returns 401 for unknown email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'nobody@example.com',
        password: 'password123',
      });

    expect(res.status).toBe(401);
  });
});

describe('Protected route', () => {
  it('returns 401 without auth header', async () => {
    const res = await request(app).get('/api/v1/accounts');
    expect(res.status).toBe(401);
  });
});
