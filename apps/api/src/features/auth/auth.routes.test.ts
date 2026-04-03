import { beforeEach, describe, expect, it } from 'vitest';
import { type AuthResponse, cleanDatabase } from '@/testing/test-helpers';
import { createApp } from '@/app';
import request from 'supertest';

const app = createApp();

beforeEach(() => cleanDatabase());

describe('POST /api/v1/auth/register', () => {
  it('creates a user and returns access token', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'test@example.com',
      password: 'password123',
    });

    const body = res.body as AuthResponse;
    expect(res.status).toBe(201);
    expect(body.accessToken).toBeDefined();
    expect(body.user.email).toBe('test@example.com');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('returns 409 for duplicate email', async () => {
    await request(app).post('/api/v1/auth/register').send({
      email: 'test@example.com',
      password: 'password123',
    });

    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'test@example.com',
      password: 'different',
    });

    expect(res.status).toBe(409);
  });

  it('returns 400 for invalid email', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'not-an-email',
      password: 'password123',
    });

    expect(res.status).toBe(400);
  });

  it('returns 400 for short password', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
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
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'test@example.com',
      password: 'password123',
    });

    expect(res.status).toBe(200);
    expect((res.body as AuthResponse).accessToken).toBeDefined();
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'test@example.com',
      password: 'wrongpassword',
    });

    expect(res.status).toBe(401);
  });

  it('returns 401 for unknown email', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
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
