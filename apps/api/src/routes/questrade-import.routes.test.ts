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
import {
  createAccount,
  type ImportSummaryResponse,
  registerAndLogin,
} from './test-helpers';
import { createApp } from '@/app';
import { createQuestradeFixtureBuffer } from '@/services/imports/adapters/__fixtures__/questrade-fixture';
import { db } from '@/db';
import { eq } from 'drizzle-orm';
import request from 'supertest';

const app = createApp();

let accessToken: string;
let tfsaAccountId: string;
//let rrspAccountId: string;

beforeEach(async () => {
  await db.delete(transactions);
  await db.delete(investmentTransactions);
  await db.delete(imports);
  await db.delete(accounts);
  await db.delete(refreshTokens);
  await db.delete(categorizationRules);
  await db.delete(users);

  accessToken = await registerAndLogin(app, 'questrade-test@example.com');
  tfsaAccountId = await createAccount(app, accessToken, {
    name: 'Questrade TFSA',
    type: 'tfsa',
    institution: 'questrade',
    // Account number must match the fixture: 53481057
    // Store it as metadata — future enhancement; for now the import
    // service routes by accountId passed in the request
  });

  // const rrsp = await request(app)
  //   .post('/api/v1/accounts')
  //   .set('Authorization', `Bearer ${accessToken}`)
  //   .send({
  //     name: 'Questrade RRSP',
  //     type: 'rrsp',
  //     institution: 'questrade',
  //   });
  // rrspAccountId = rrsp.body.id;
});

describe('Questrade XLSX import end-to-end', () => {
  it('imports all rows from the fixture', async () => {
    const buffer = createQuestradeFixtureBuffer();

    const res = await request(app)
      .post('/api/v1/imports/upload')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', buffer, {
        filename: 'questrade.xlsx',
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .field('accountId', tfsaAccountId);

    const body = res.body as ImportSummaryResponse;
    expect(res.status).toBe(201);
    // All 3 rows should be imported (the RRSP row is imported under tfsaAccountId
    // because the current import service uses the passed accountId for all rows)
    expect(body.importedCount).toBe(3);
    expect(body.errorCount).toBe(0);
  });

  it('stores rows in investment_transactions, not transactions', async () => {
    const buffer = createQuestradeFixtureBuffer();

    await request(app)
      .post('/api/v1/imports/upload')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', buffer, {
        filename: 'questrade.xlsx',
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .field('accountId', tfsaAccountId);

    const invTxns = await db
      .select()
      .from(investmentTransactions)
      .where(eq(investmentTransactions.accountId, tfsaAccountId));

    expect(invTxns.length).toBe(3);

    // Regular transactions table should have no new rows
    const regTxns = await db
      .select()
      .from(transactions)
      .where(eq(transactions.accountId, tfsaAccountId));

    expect(regTxns.length).toBe(0);
  });

  it('maps action codes correctly', async () => {
    const buffer = createQuestradeFixtureBuffer();

    await request(app)
      .post('/api/v1/imports/upload')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', buffer, {
        filename: 'questrade.xlsx',
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .field('accountId', tfsaAccountId);

    const invTxns = await db
      .select({
        action: investmentTransactions.action,
        rawAction: investmentTransactions.rawAction,
      })
      .from(investmentTransactions)
      .where(eq(investmentTransactions.accountId, tfsaAccountId));

    const dividends = invTxns.filter((t) => t.rawAction === 'DIV');
    const transfers = invTxns.filter((t) => t.rawAction === 'TF6');

    expect(dividends.length).toBe(2);
    expect(dividends[0].action).toBe('dividend');
    expect(transfers.length).toBe(1);
    expect(transfers[0].action).toBe('transfer');
  });

  it('risk_level is null on all imported rows', async () => {
    const buffer = createQuestradeFixtureBuffer();

    await request(app)
      .post('/api/v1/imports/upload')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', buffer, {
        filename: 'questrade.xlsx',
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .field('accountId', tfsaAccountId);

    const invTxns = await db
      .select({
        riskLevel: investmentTransactions.riskLevel,
      })
      .from(investmentTransactions);

    invTxns.forEach((t) => expect(t.riskLevel).toBeNull());
  });

  it('deduplicates on re-upload', async () => {
    const buffer = createQuestradeFixtureBuffer();

    await request(app)
      .post('/api/v1/imports/upload')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', buffer, {
        filename: 'questrade.xlsx',
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .field('accountId', tfsaAccountId);

    const res = await request(app)
      .post('/api/v1/imports/upload')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', buffer, {
        filename: 'questrade.xlsx',
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .field('accountId', tfsaAccountId);

    const body = res.body as ImportSummaryResponse;
    expect(body.importedCount).toBe(0);
    expect(body.duplicateCount).toBe(3);
  });
});
