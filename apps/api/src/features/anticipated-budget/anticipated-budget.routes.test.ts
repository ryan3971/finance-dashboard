import { beforeEach, describe, expect, it } from 'vitest';
import { cleanDatabase, registerUser } from '@/testing/test-helpers';
import { createApp } from '@/app';
import request from 'supertest';

const app = createApp();

beforeEach(async () => {
  await cleanDatabase();
});

const baseEntry = {
  name: 'Rent',
  categoryId: null,
  needWant: 'Need',
  isIncome: false,
  monthlyAmount: '1500.00',
  notes: null,
  effectiveYear: 2025,
};

describe('GET /api/v1/anticipated-budget', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/anticipated-budget?year=2025');
    expect(res.status).toBe(401);
  });

  it('returns empty array when no entries exist', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .get('/api/v1/anticipated-budget?year=2025')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 400 when year param is missing', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .get('/api/v1/anticipated-budget')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(400);
  });

  it('returns entries with all 12 resolved months at default amount', async () => {
    const { accessToken } = await registerUser(app);
    await request(app)
      .post('/api/v1/anticipated-budget')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(baseEntry);

    const res = await request(app)
      .get('/api/v1/anticipated-budget?year=2025')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);

    const entry = res.body[0] as {
      months: { month: number; amount: number; isOverride: boolean }[];
    };
    expect(entry.months).toHaveLength(12);
    expect(entry.months[0]).toEqual({
      month: 1,
      amount: 1500,
      isOverride: false,
    });
    expect(entry.months[11]).toEqual({
      month: 12,
      amount: 1500,
      isOverride: false,
    });
  });

  it('reflects month overrides in resolved months', async () => {
    const { accessToken } = await registerUser(app);
    const create = await request(app)
      .post('/api/v1/anticipated-budget')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(baseEntry);
    const id = (create.body as { id: string }).id;

    await request(app)
      .put(`/api/v1/anticipated-budget/${id}/months/3`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: '1800.00' });

    const res = await request(app)
      .get('/api/v1/anticipated-budget?year=2025')
      .set('Authorization', `Bearer ${accessToken}`);

    const entry = res.body[0] as {
      months: { month: number; amount: number; isOverride: boolean }[];
    };
    const march = entry.months.find((m) => m.month === 3);
    expect(march).toEqual({ month: 3, amount: 1800, isOverride: true });

    const jan = entry.months.find((m) => m.month === 1);
    expect(jan).toEqual({ month: 1, amount: 1500, isOverride: false });
  });

  it('isolates entries between users', async () => {
    const { accessToken: accessTokenA } = await registerUser(
      app,
      'a@example.com'
    );
    const { accessToken: accessTokenB } = await registerUser(
      app,
      'b@example.com'
    );

    await request(app)
      .post('/api/v1/anticipated-budget')
      .set('Authorization', `Bearer ${accessTokenA}`)
      .send(baseEntry);

    const res = await request(app)
      .get('/api/v1/anticipated-budget?year=2025')
      .set('Authorization', `Bearer ${accessTokenB}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});

describe('POST /api/v1/anticipated-budget', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/v1/anticipated-budget')
      .send(baseEntry);
    expect(res.status).toBe(401);
  });

  it('creates entry and returns 201 with shaped response', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/anticipated-budget')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(baseEntry);

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('Rent');
    expect(res.body.needWant).toBe('Need');
    expect(res.body.isIncome).toBe(false);
    expect(res.body.monthlyAmount).toBe(1500);
    expect(res.body.months).toHaveLength(12);
  });

  it('returns 400 for invalid input', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/anticipated-budget')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: '', isIncome: false, effectiveYear: 2025 });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/v1/anticipated-budget/:id', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app)
      .patch('/api/v1/anticipated-budget/00000000-0000-0000-0000-000000000000')
      .send({ name: 'Updated' });
    expect(res.status).toBe(401);
  });

  it('updates an entry and returns updated data', async () => {
    const { accessToken } = await registerUser(app);
    const create = await request(app)
      .post('/api/v1/anticipated-budget')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(baseEntry);
    const id = (create.body as { id: string }).id;

    const res = await request(app)
      .patch(`/api/v1/anticipated-budget/${id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Updated Rent', monthlyAmount: '1600.00' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Rent');
    expect(res.body.monthlyAmount).toBe(1600);
  });

  it('returns 404 for non-existent entry', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .patch('/api/v1/anticipated-budget/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'X' });
    expect(res.status).toBe(404);
  });

  it('returns 404 when user does not own the entry', async () => {
    const { accessToken: accessTokenA } = await registerUser(
      app,
      'a@example.com'
    );
    const { accessToken: accessTokenB } = await registerUser(
      app,
      'b@example.com'
    );

    const create = await request(app)
      .post('/api/v1/anticipated-budget')
      .set('Authorization', `Bearer ${accessTokenA}`)
      .send(baseEntry);
    const id = (create.body as { id: string }).id;

    const res = await request(app)
      .patch(`/api/v1/anticipated-budget/${id}`)
      .set('Authorization', `Bearer ${accessTokenB}`)
      .send({ name: 'Hacked' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/v1/anticipated-budget/:id', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).delete(
      '/api/v1/anticipated-budget/00000000-0000-0000-0000-000000000000'
    );
    expect(res.status).toBe(401);
  });

  it('deletes an entry and returns 204', async () => {
    const { accessToken } = await registerUser(app);
    const create = await request(app)
      .post('/api/v1/anticipated-budget')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(baseEntry);
    const id = (create.body as { id: string }).id;

    const del = await request(app)
      .delete(`/api/v1/anticipated-budget/${id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(del.status).toBe(204);

    const list = await request(app)
      .get('/api/v1/anticipated-budget?year=2025')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(list.body).toHaveLength(0);
  });

  it('returns 404 for non-existent entry', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .delete('/api/v1/anticipated-budget/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/v1/anticipated-budget/:id/months/:month', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app)
      .put(
        '/api/v1/anticipated-budget/00000000-0000-0000-0000-000000000000/months/1'
      )
      .send({ amount: '100.00' });
    expect(res.status).toBe(401);
  });

  it('adds a month override and returns 204', async () => {
    const { accessToken } = await registerUser(app);
    const create = await request(app)
      .post('/api/v1/anticipated-budget')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(baseEntry);
    const id = (create.body as { id: string }).id;

    const res = await request(app)
      .put(`/api/v1/anticipated-budget/${id}/months/6`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: '2000.00' });
    expect(res.status).toBe(204);

    const list = await request(app)
      .get('/api/v1/anticipated-budget?year=2025')
      .set('Authorization', `Bearer ${accessToken}`);
    const entry = list.body[0] as {
      months: { month: number; amount: string; isOverride: boolean }[];
    };
    const june = entry.months.find((m) => m.month === 6);
    expect(june).toEqual({ month: 6, amount: 2000, isOverride: true });
  });

  it('updates existing override (upsert)', async () => {
    const { accessToken } = await registerUser(app);
    const create = await request(app)
      .post('/api/v1/anticipated-budget')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(baseEntry);
    const id = (create.body as { id: string }).id;

    await request(app)
      .put(`/api/v1/anticipated-budget/${id}/months/6`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: '2000.00' });

    await request(app)
      .put(`/api/v1/anticipated-budget/${id}/months/6`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: '2500.00' });

    const list = await request(app)
      .get('/api/v1/anticipated-budget?year=2025')
      .set('Authorization', `Bearer ${accessToken}`);
    const entry = list.body[0] as {
      months: { month: number; amount: string; isOverride: boolean }[];
    };
    const june = entry.months.find((m) => m.month === 6);
    expect(june?.amount).toBe(2500);
  });

  it('returns 404 when entry does not belong to user', async () => {
    const { accessToken: accessTokenA } = await registerUser(
      app,
      'a@example.com'
    );
    const { accessToken: accessTokenB } = await registerUser(
      app,
      'b@example.com'
    );

    const create = await request(app)
      .post('/api/v1/anticipated-budget')
      .set('Authorization', `Bearer ${accessTokenA}`)
      .send(baseEntry);
    const id = (create.body as { id: string }).id;

    const res = await request(app)
      .put(`/api/v1/anticipated-budget/${id}/months/1`)
      .set('Authorization', `Bearer ${accessTokenB}`)
      .send({ amount: '999.00' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/v1/anticipated-budget/:id/months/:month', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).delete(
      '/api/v1/anticipated-budget/00000000-0000-0000-0000-000000000000/months/1'
    );
    expect(res.status).toBe(401);
  });

  it('removes override and GET reverts to default amount', async () => {
    const { accessToken } = await registerUser(app);
    const create = await request(app)
      .post('/api/v1/anticipated-budget')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(baseEntry);
    const id = (create.body as { id: string }).id;

    await request(app)
      .put(`/api/v1/anticipated-budget/${id}/months/3`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: '1800.00' });

    await request(app)
      .delete(`/api/v1/anticipated-budget/${id}/months/3`)
      .set('Authorization', `Bearer ${accessToken}`);

    const list = await request(app)
      .get('/api/v1/anticipated-budget?year=2025')
      .set('Authorization', `Bearer ${accessToken}`);
    const entry = list.body[0] as {
      months: { month: number; amount: string; isOverride: boolean }[];
    };
    const march = entry.months.find((m) => m.month === 3);
    expect(march).toEqual({ month: 3, amount: 1500, isOverride: false });
  });
});
