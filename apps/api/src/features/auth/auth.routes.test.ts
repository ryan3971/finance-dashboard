import { cleanDatabase } from '@/testing/test-helpers';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '@/app';
import request from 'supertest';
import type { AuthResponse } from '@/testing/types';
import { TEST_CREDENTIALS } from '@/testing/constants';

const app = createApp();

beforeEach(() => cleanDatabase());

// Extracts the name=value segment of the refresh_token cookie from a set-cookie
// response header array so it can be forwarded as a Cookie request header.
// Accepts `string | string[] | undefined` because supertest types headers as
// `Record<string, string>`, which doesn't reflect the array the HTTP stack
// actually produces for set-cookie.
function extractRefreshCookie(
  setCookieHeaders: string | string[] | undefined
): string {
  if (!Array.isArray(setCookieHeaders)) {
    throw new Error('set-cookie header missing or not an array');
  }
  const match = setCookieHeaders.find((c) => c.startsWith('refresh_token='));
  if (!match)
    throw new Error('refresh_token cookie not found in set-cookie header');
  const [nameValue] = match.split(';'); // "refresh_token=<value>"
  if (!nameValue) throw new Error('malformed refresh_token cookie');
  return nameValue;
}

describe('POST /api/v1/auth/register', () => {
  it('creates a user and returns tokens', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...TEST_CREDENTIALS });

    const body = res.body as AuthResponse;
    expect(res.status).toBe(201);
    expect(body.accessToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(body.user.id).toBeDefined();
    expect(body.user.email).toBe(TEST_CREDENTIALS.email);
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('normalizes email to lowercase', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'Test@Example.COM', password: 'password123' });

    expect(res.status).toBe(201);
    expect((res.body as AuthResponse).user.email).toBe('test@example.com');
  });

  describe('when email already exists', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({ ...TEST_CREDENTIALS });
    });

    it('returns 409 with error message', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: TEST_CREDENTIALS.email, password: 'different' });

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ error: 'Email already registered' });
    });
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

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ password: 'password123' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'test@example.com' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({ ...TEST_CREDENTIALS });
  });

  it('returns tokens and sets cookie for valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ ...TEST_CREDENTIALS });

    const body = res.body as AuthResponse;
    expect(res.status).toBe(200);
    expect(body.accessToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(body.user.email).toBe(TEST_CREDENTIALS.email);
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('accepts email regardless of case', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: TEST_CREDENTIALS.email.toUpperCase(),
      password: TEST_CREDENTIALS.password,
    });

    expect(res.status).toBe(200);
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: TEST_CREDENTIALS.email,
      password: 'wrongpassword',
    });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: 'Invalid email or password' });
  });

  it('returns 401 for unknown email', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'nobody@example.com',
      password: 'password123',
    });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: 'Invalid email or password' });
  });
});

describe('POST /api/v1/auth/refresh', () => {
  it('returns a new access token and rotates the cookie', async () => {
    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...TEST_CREDENTIALS });
    const cookie = extractRefreshCookie(registerRes.headers['set-cookie']);

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect((res.body as { accessToken: string }).accessToken).toMatch(
      /^[\w-]+\.[\w-]+\.[\w-]+$/
    );
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('returns 401 when the refresh token cookie is absent', async () => {
    const res = await request(app).post('/api/v1/auth/refresh');

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: 'No refresh token provided' });
  });

  it('returns 401 for an invalid refresh token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'refresh_token=not.a.valid.jwt');

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      error: 'Invalid or expired refresh token',
    });
  });

  it('returns 401 when replaying an already-rotated token', async () => {
    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...TEST_CREDENTIALS });
    const originalCookie = extractRefreshCookie(
      registerRes.headers['set-cookie']
    );

    // First use rotates the token
    await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', originalCookie);

    // Replaying the original token must fail
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', originalCookie);

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      error: 'Refresh token not found or expired',
    });
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('returns 204 and clears the cookie', async () => {
    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...TEST_CREDENTIALS });
    const cookie = extractRefreshCookie(registerRes.headers['set-cookie']);

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie);

    expect(res.status).toBe(204);
    const setCookieHeader = res.headers['set-cookie'];
    if (!Array.isArray(setCookieHeader))
      throw new Error('set-cookie header missing');
    expect(
      (setCookieHeader as string[]).some((c) => c.startsWith('refresh_token=;'))
    ).toBe(true);
  });

  it('returns 204 even without a cookie', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(204);
  });

  it('invalidates the refresh token so it cannot be reused', async () => {
    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...TEST_CREDENTIALS });
    const cookie = extractRefreshCookie(registerRes.headers['set-cookie']);

    await request(app).post('/api/v1/auth/logout').set('Cookie', cookie);

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie);

    expect(res.status).toBe(401);
  });
});

// requireAuth is tested here because it is an auth concern. /api/v1/accounts is
// used as the vehicle since all /api/v1/auth/* routes are public.
describe('requireAuth middleware', () => {
  it('returns 401 when Authorization header is absent', async () => {
    const res = await request(app).get('/api/v1/accounts');
    expect(res.status).toBe(401);
  });

  it('returns 401 for a malformed Bearer token', async () => {
    const res = await request(app)
      .get('/api/v1/accounts')
      .set('Authorization', 'Bearer not.a.valid.jwt');

    expect(res.status).toBe(401);
  });
});
