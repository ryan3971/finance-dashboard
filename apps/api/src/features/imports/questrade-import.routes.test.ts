import * as fs from 'fs';
import * as path from 'path';
import { investmentTransactions, transactions } from '@/db/schema';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  cleanDatabase,
  createAccount,
  type ImportSummaryResponse,
  registerAndGetToken,
} from '../../testing/test-helpers';
import { createApp } from '@/app';
import { db } from '@/db';
import { assertDefined } from '@/lib/assert';
import { eq } from 'drizzle-orm';
import request from 'supertest';

const app = createApp();

const FIXTURE = path.join(__dirname, './adapters/__fixtures__/questrade.csv');

let accessToken: string;
let tfsaAccountId: string;

beforeEach(async () => {
  await cleanDatabase();

  accessToken = await registerAndGetToken(app, 'questrade-test@example.com');
  tfsaAccountId = await createAccount(app, accessToken, {
    name: 'Questrade TFSA',
    type: 'tfsa',
    institution: 'questrade',
  });
});

async function uploadQuestrade(token: string, accountId: string) {
  const buffer = fs.readFileSync(FIXTURE);
  return request(app)
    .post('/api/v1/imports/upload')
    .set('Authorization', `Bearer ${token}`)
    .attach('file', buffer, {
      filename: 'questrade.csv',
      contentType: 'text/csv',
    })
    .field('accountId', accountId);
}

describe('Questrade CSV import end-to-end', () => {
  it('imports all 20 rows from the fixture', async () => {
    const res = await uploadQuestrade(accessToken, tfsaAccountId);

    const body = res.body as ImportSummaryResponse;
    expect(res.status).toBe(201);
    expect(body.importedCount).toBe(20);
    expect(body.errorCount).toBe(0);
  });

  it('stores rows in investment_transactions, not transactions', async () => {
    await uploadQuestrade(accessToken, tfsaAccountId);

    const invTxns = await db
      .select()
      .from(investmentTransactions)
      .where(eq(investmentTransactions.accountId, tfsaAccountId));

    expect(invTxns.length).toBe(20);

    const regTxns = await db
      .select()
      .from(transactions)
      .where(eq(transactions.accountId, tfsaAccountId));

    expect(regTxns.length).toBe(0);
  });

  it('maps action codes correctly', async () => {
    await uploadQuestrade(accessToken, tfsaAccountId);

    const invTxns = await db
      .select({
        action: investmentTransactions.action,
        rawAction: investmentTransactions.rawAction,
      })
      .from(investmentTransactions)
      .where(eq(investmentTransactions.accountId, tfsaAccountId));

    const dividends = invTxns.filter((t) => t.rawAction === 'DIV');
    expect(dividends.length).toBe(2);
    const firstDividend = dividends[0];
    assertDefined(firstDividend, 'Expected at least one dividend transaction');
    expect(firstDividend.action).toBe('dividend');

    const deposits = invTxns.filter((t) => t.rawAction === 'CON');
    expect(deposits.length).toBeGreaterThan(0);
    const firstDeposit = deposits[0];
    assertDefined(firstDeposit, 'Expected at least one deposit transaction');
    expect(firstDeposit.action).toBe('deposit');

    const transfers = invTxns.filter((t) => t.rawAction === 'TF6');
    expect(transfers.length).toBe(1);
    const firstTransfer = transfers[0];
    assertDefined(firstTransfer, 'Expected at least one transfer transaction');
    expect(firstTransfer.action).toBe('transfer');
  });

  it('maps empty-action distribution rows to dividend via Activity Type fallback', async () => {
    await uploadQuestrade(accessToken, tfsaAccountId);

    const invTxns = await db
      .select({
        action: investmentTransactions.action,
        rawAction: investmentTransactions.rawAction,
      })
      .from(investmentTransactions)
      .where(eq(investmentTransactions.accountId, tfsaAccountId));

    const emptyAction = invTxns.filter((t) => t.rawAction === '');
    expect(emptyAction.length).toBeGreaterThan(0);
    emptyAction.forEach((t) => expect(t.action).toBe('dividend'));
  });

  it('risk_level is null on all imported rows', async () => {
    await uploadQuestrade(accessToken, tfsaAccountId);

    const invTxns = await db
      .select({ riskLevel: investmentTransactions.riskLevel })
      .from(investmentTransactions);

    invTxns.forEach((t) => expect(t.riskLevel).toBeNull());
  });

  it('deduplicates on re-upload', async () => {
    await uploadQuestrade(accessToken, tfsaAccountId);

    const res = await uploadQuestrade(accessToken, tfsaAccountId);

    const body = res.body as ImportSummaryResponse;
    expect(body.importedCount).toBe(0);
    expect(body.duplicateCount).toBe(20);
  });
});
