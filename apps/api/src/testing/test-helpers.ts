import type { Application } from 'express';
import request from 'supertest';

export interface AuthResponse {
  accessToken: string;
  user: { email: string };
}

export interface AccountResponse {
  id: string;
  name: string;
  type: string;
  institution: string;
  isCredit: boolean;
}

export interface ImportSummaryResponse {
  importedCount: number;
  duplicateCount: number;
  errorCount: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    totalPages: number;
  };
}

export async function registerAndLogin(
  app: Application,
  email = 'test@example.com'
): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'password123' });
  return (res.body as AuthResponse).accessToken;
}

export async function createAccount(
  app: Application,
  token: string,
  options: {
    name: string;
    type: string;
    institution: string;
    isCredit?: boolean;
  }
): Promise<string> {
  const res = await request(app)
    .post('/api/v1/accounts')
    .set('Authorization', `Bearer ${token}`)
    .send(options);
  return (res.body as AccountResponse).id;
}
