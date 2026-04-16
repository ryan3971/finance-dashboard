import { beforeEach, describe, expect, it } from 'vitest';
import { cleanDatabase, registerUser } from '@/testing/test-helpers';
import { MALFORMED_ID, UNKNOWN_ID } from '@/testing/constants';
import { createApp } from '@/app';
import request from 'supertest';

const app = createApp();

beforeEach(async () => {
  await cleanDatabase();
});

// Shared response shape — used as a cast target throughout the file so the
// inline type annotation is not duplicated across every test.
interface ResolvedMonth {
  month: number;
  amount: number;
  isOverride: boolean;
}

interface AnticipatedBudgetEntry {
  id: string;
  name: string;
  months: ResolvedMonth[];
}

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

  it('returns 400 for a non-numeric year param', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .get('/api/v1/anticipated-budget?year=abc')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 400 for a year below the allowed range', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .get('/api/v1/anticipated-budget?year=1999')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 400 for a year above the allowed range', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .get('/api/v1/anticipated-budget?year=2101')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(400);
  });

  it('returns entries with all 12 resolved months at default amount', async () => {
    const { accessToken } = await registerUser(app);
    const create = await request(app)
      .post('/api/v1/anticipated-budget')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(baseEntry);
    expect(create.status).toBe(201);

    const res = await request(app)
      .get('/api/v1/anticipated-budget?year=2025')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);

    const [entry] = res.body as [AnticipatedBudgetEntry];
    expect(entry.months).toHaveLength(12);
    expect(entry.months[0]).toMatchObject({ month: 1, amount: 1500, isOverride: false });
    expect(entry.months[11]).toMatchObject({ month: 12, amount: 1500, isOverride: false });
  });

  it('reflects month overrides in resolved months', async () => {
    const { accessToken } = await registerUser(app);
    const create = await request(app)
      .post('/api/v1/anticipated-budget')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(baseEntry);
    expect(create.status).toBe(201);
    const { id } = create.body as { id: string };

    const override = await request(app)
      .put(`/api/v1/anticipated-budget/${id}/months/3`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: '1800.00' });
    expect(override.status).toBe(204);

    const res = await request(app)
      .get('/api/v1/anticipated-budget?year=2025')
      .set('Authorization', `Bearer ${accessToken}`);

    const [entry] = res.body as [AnticipatedBudgetEntry];
    const march = entry.months.find((m) => m.month === 3);
    expect(march).toMatchObject({ month: 3, amount: 1800, isOverride: true });

    const jan = entry.months.find((m) => m.month === 1);
    expect(jan).toMatchObject({ month: 1, amount: 1500, isOverride: false });
  });

  it('only returns entries for the requested year', async () => {
    const { accessToken } = await registerUser(app);
    const create2024 = await request(app)
      .post('/api/v1/anticipated-budget')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ ...baseEntry, name: 'Rent 2024', effectiveYear: 2024 });
    expect(create2024.status).toBe(201);

    const create2025 = await request(app)
      .post('/api/v1/anticipated-budget')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ ...baseEntry, name: 'Rent 2025', effectiveYear: 2025 });
    expect(create2025.status).toBe(201);

    const res = await request(app)
      .get('/api/v1/anticipated-budget?year=2025')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject([{ name: 'Rent 2025' }]);
  });

  it('resolves months without overrides as zero for entries with no default amount', async () => {
    const { accessToken } = await registerUser(app);
    const create = await request(app)
      .post('/api/v1/anticipated-budget')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ ...baseEntry, name: 'Car Insurance', monthlyAmount: null });
    expect(create.status).toBe(201);
    const { id } = create.body as { id: string };

    const override = await request(app)
      .put(`/api/v1/anticipated-budget/${id}/months/6`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: '800.00' });
    expect(override.status).toBe(204);

    const res = await request(app)
      .get('/api/v1/anticipated-budget?year=2025')
      .set('Authorization', `Bearer ${accessToken}`);

    const [entry] = res.body as [AnticipatedBudgetEntry];
    const june = entry.months.find((m) => m.month === 6);
    expect(june).toMatchObject({ month: 6, amount: 800, isOverride: true });

    const jan = entry.months.find((m) => m.month === 1);
    expect(jan).toMatchObject({ month: 1, amount: 0, isOverride: false });
  });

  it('isolates entries between users', async () => {
    const [{ accessToken: accessTokenA }, { accessToken: accessTokenB }] =
      await Promise.all([
        registerUser(app, 'a@example.com'),
        registerUser(app, 'b@example.com'),
      ]);

    const create = await request(app)
      .post('/api/v1/anticipated-budget')
      .set('Authorization', `Bearer ${accessTokenA}`)
      .send(baseEntry);
    expect(create.status).toBe(201);

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
    expect(res.body).toMatchObject({
      id: expect.any(String) as string,
      name: 'Rent',
      needWant: 'Need',
      isIncome: false,
      monthlyAmount: 1500,
    });
    expect((res.body as AnticipatedBudgetEntry).months).toHaveLength(12);
  });

  it('returns 400 when isIncome is true and needWant is non-null', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/anticipated-budget')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ ...baseEntry, isIncome: true, needWant: 'Need' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation error' });
  });

  it('returns 400 for invalid input', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/anticipated-budget')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: '', isIncome: false, effectiveYear: 2025 });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation error' });
  });
});

describe('PATCH /api/v1/anticipated-budget/:id', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app)
      .patch(`/api/v1/anticipated-budget/${UNKNOWN_ID}`)
      .send({ name: 'Updated' });
    expect(res.status).toBe(401);
  });

  it('updates an entry and returns updated data', async () => {
    const { accessToken } = await registerUser(app);
    const create = await request(app)
      .post('/api/v1/anticipated-budget')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(baseEntry);
    expect(create.status).toBe(201);
    const { id } = create.body as { id: string };

    const res = await request(app)
      .patch(`/api/v1/anticipated-budget/${id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Updated Rent', monthlyAmount: '1600.00' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Updated Rent', monthlyAmount: 1600 });
  });

  it('returns 404 for non-existent entry', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .patch(`/api/v1/anticipated-budget/${UNKNOWN_ID}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'X' });
    expect(res.status).toBe(404);
  });

  it('returns 400 for a malformed id', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .patch(`/api/v1/anticipated-budget/${MALFORMED_ID}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'X' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation error' });
  });

  it('returns 404 when user does not own the entry', async () => {
    const [{ accessToken: accessTokenA }, { accessToken: accessTokenB }] =
      await Promise.all([
        registerUser(app, 'a@example.com'),
        registerUser(app, 'b@example.com'),
      ]);

    const create = await request(app)
      .post('/api/v1/anticipated-budget')
      .set('Authorization', `Bearer ${accessTokenA}`)
      .send(baseEntry);
    expect(create.status).toBe(201);
    const { id } = create.body as { id: string };

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
      `/api/v1/anticipated-budget/${UNKNOWN_ID}`
    );
    expect(res.status).toBe(401);
  });

  it('deletes an entry and returns 204', async () => {
    const { accessToken } = await registerUser(app);
    const create = await request(app)
      .post('/api/v1/anticipated-budget')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(baseEntry);
    expect(create.status).toBe(201);
    const { id } = create.body as { id: string };

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
      .delete(`/api/v1/anticipated-budget/${UNKNOWN_ID}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 for a malformed id', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .delete(`/api/v1/anticipated-budget/${MALFORMED_ID}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation error' });
  });

  it('returns 404 when user does not own the entry', async () => {
    const [{ accessToken: accessTokenA }, { accessToken: accessTokenB }] =
      await Promise.all([
        registerUser(app, 'a@example.com'),
        registerUser(app, 'b@example.com'),
      ]);

    const create = await request(app)
      .post('/api/v1/anticipated-budget')
      .set('Authorization', `Bearer ${accessTokenA}`)
      .send(baseEntry);
    expect(create.status).toBe(201);
    const { id } = create.body as { id: string };

    const res = await request(app)
      .delete(`/api/v1/anticipated-budget/${id}`)
      .set('Authorization', `Bearer ${accessTokenB}`);
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/v1/anticipated-budget/:id/months/:month', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app)
      .put(`/api/v1/anticipated-budget/${UNKNOWN_ID}/months/1`)
      .send({ amount: '100.00' });
    expect(res.status).toBe(401);
  });

  it('adds a month override and returns 204', async () => {
    const { accessToken } = await registerUser(app);
    const create = await request(app)
      .post('/api/v1/anticipated-budget')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(baseEntry);
    expect(create.status).toBe(201);
    const { id } = create.body as { id: string };

    const put = await request(app)
      .put(`/api/v1/anticipated-budget/${id}/months/6`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: '2000.00' });
    expect(put.status).toBe(204);

    const list = await request(app)
      .get('/api/v1/anticipated-budget?year=2025')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    const [entry] = list.body as [AnticipatedBudgetEntry];
    const june = entry.months.find((m) => m.month === 6);
    expect(june).toMatchObject({ month: 6, amount: 2000, isOverride: true });
  });

  it('updates existing override (upsert)', async () => {
    const { accessToken } = await registerUser(app);
    const create = await request(app)
      .post('/api/v1/anticipated-budget')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(baseEntry);
    expect(create.status).toBe(201);
    const { id } = create.body as { id: string };

    const first = await request(app)
      .put(`/api/v1/anticipated-budget/${id}/months/6`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: '2000.00' });
    expect(first.status).toBe(204);

    const second = await request(app)
      .put(`/api/v1/anticipated-budget/${id}/months/6`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: '2500.00' });
    expect(second.status).toBe(204);

    const list = await request(app)
      .get('/api/v1/anticipated-budget?year=2025')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    const [entry] = list.body as [AnticipatedBudgetEntry];
    const june = entry.months.find((m) => m.month === 6);
    expect(june).toMatchObject({ month: 6, amount: 2500, isOverride: true });
  });

  it('returns 400 for a month below the allowed range', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .put(`/api/v1/anticipated-budget/${UNKNOWN_ID}/months/0`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: '100.00' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation error' });
  });

  it('returns 400 for a month above the allowed range', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .put(`/api/v1/anticipated-budget/${UNKNOWN_ID}/months/13`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: '100.00' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation error' });
  });

  it('returns 400 for a malformed entry id', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .put(`/api/v1/anticipated-budget/${MALFORMED_ID}/months/1`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: '100.00' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation error' });
  });

  it('returns 404 when entry does not belong to user', async () => {
    const [{ accessToken: accessTokenA }, { accessToken: accessTokenB }] =
      await Promise.all([
        registerUser(app, 'a@example.com'),
        registerUser(app, 'b@example.com'),
      ]);

    const create = await request(app)
      .post('/api/v1/anticipated-budget')
      .set('Authorization', `Bearer ${accessTokenA}`)
      .send(baseEntry);
    expect(create.status).toBe(201);
    const { id } = create.body as { id: string };

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
      `/api/v1/anticipated-budget/${UNKNOWN_ID}/months/1`
    );
    expect(res.status).toBe(401);
  });

  it('removes override and returns 204; GET reverts to default amount', async () => {
    const { accessToken } = await registerUser(app);
    const create = await request(app)
      .post('/api/v1/anticipated-budget')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(baseEntry);
    expect(create.status).toBe(201);
    const { id } = create.body as { id: string };

    const put = await request(app)
      .put(`/api/v1/anticipated-budget/${id}/months/3`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: '1800.00' });
    expect(put.status).toBe(204);

    const del = await request(app)
      .delete(`/api/v1/anticipated-budget/${id}/months/3`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(del.status).toBe(204);

    const list = await request(app)
      .get('/api/v1/anticipated-budget?year=2025')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    const [entry] = list.body as [AnticipatedBudgetEntry];
    const march = entry.months.find((m) => m.month === 3);
    expect(march).toMatchObject({ month: 3, amount: 1500, isOverride: false });
  });

  it('returns 404 when the override does not exist', async () => {
    const { accessToken } = await registerUser(app);
    const create = await request(app)
      .post('/api/v1/anticipated-budget')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(baseEntry);
    expect(create.status).toBe(201);
    const { id } = create.body as { id: string };

    const res = await request(app)
      .delete(`/api/v1/anticipated-budget/${id}/months/6`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 for a month below the allowed range', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .delete(`/api/v1/anticipated-budget/${UNKNOWN_ID}/months/0`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation error' });
  });

  it('returns 400 for a month above the allowed range', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .delete(`/api/v1/anticipated-budget/${UNKNOWN_ID}/months/13`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation error' });
  });

  it('returns 400 for a malformed entry id', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .delete(`/api/v1/anticipated-budget/${MALFORMED_ID}/months/1`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Validation error' });
  });

  it('returns 404 when entry does not belong to user', async () => {
    const [{ accessToken: accessTokenA }, { accessToken: accessTokenB }] =
      await Promise.all([
        registerUser(app, 'a@example.com'),
        registerUser(app, 'b@example.com'),
      ]);

    const create = await request(app)
      .post('/api/v1/anticipated-budget')
      .set('Authorization', `Bearer ${accessTokenA}`)
      .send(baseEntry);
    expect(create.status).toBe(201);
    const { id } = create.body as { id: string };

    const res = await request(app)
      .delete(`/api/v1/anticipated-budget/${id}/months/1`)
      .set('Authorization', `Bearer ${accessTokenB}`);
    expect(res.status).toBe(404);
  });
});
