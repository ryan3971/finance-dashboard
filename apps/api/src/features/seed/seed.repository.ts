import Decimal from 'decimal.js';
import { eq, isNull } from 'drizzle-orm';
import { assertDefined } from '@/lib/assert';
import { db as defaultDb, type DbTransaction } from '@/db';
import {
  accounts,
  anticipatedBudget,
  anticipatedBudgetMonths,
  categories,
  rebalancingGroupTransactions,
  rebalancingGroups,
  transactions,
} from '@/db/schema';
import { STAGING_ACCOUNTS } from '@/db/seeds/staging/accounts';
import {
  STAGING_ANTICIPATED_BUDGET,
  STAGING_ANTICIPATED_BUDGET_MONTHS,
} from '@/db/seeds/staging/anticipated-budget';
import { STAGING_REBALANCING_GROUPS } from '@/db/seeds/staging/rebalancing-groups';
import { STAGING_TRANSACTIONS } from '@/db/seeds/staging/transactions';
import { categorize, type LoadedRule } from '@/pipelines/categorization/pipeline';
import { TRANSACTION_SOURCE } from '@/lib/constants';
import type { AccountType, Institution } from '@finance/shared/constants';

export async function hasAccounts(userId: string): Promise<boolean> {
  const [row] = await defaultDb
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);
  return !!row;
}

export async function insertSeedAccounts(
  userId: string,
  tx: DbTransaction
): Promise<Record<string, string>> {
  const rows = await tx
    .insert(accounts)
    .values(
      STAGING_ACCOUNTS.map((def) => ({
        userId,
        name: def.name,
        type: def.type as AccountType,
        institution: def.institution as Institution,
        currency: 'CAD',
        isCredit: def.isCredit,
      }))
    )
    .returning({ id: accounts.id, name: accounts.name });

  return Object.fromEntries(rows.map((r) => [r.name, r.id]));
}

export async function insertSeedTransactions(
  userId: string,
  accountIds: Record<string, string>,
  rules: LoadedRule[],
  tx: DbTransaction
): Promise<{ txIdByKey: Map<string, string>; transactionIds: string[] }> {
  const categorizedValues = await Promise.all(
    STAGING_TRANSACTIONS.map(async (def, i) => {
      const accountId = accountIds[def.accountName];
      assertDefined(accountId, `No account found for name '${def.accountName}'`);

      const amount = new Decimal(def.amount).toNumber();
      const result = await categorize(def.description, userId, amount, 'CAD', rules);

      return {
        accountId,
        date: def.date,
        description: def.description,
        rawDescription: def.description,
        amount: def.amount,
        isIncome: def.isIncome,
        source: TRANSACTION_SOURCE.SEED,
        compositeKey: `seed-${accountId}-${i}`,
        currency: 'CAD',
        categoryId: result.categoryId,
        subcategoryId: result.subcategoryId,
        needWant: result.needWant,
        categorySource: result.categorySource,
        categoryConfidence: String(result.categoryConfidence),
        sourceName: result.sourceName,
        flaggedForReview: result.flaggedForReview,
      };
    })
  );

  const inserted = await tx
    .insert(transactions)
    .values(categorizedValues)
    .returning({
      id: transactions.id,
      accountId: transactions.accountId,
      description: transactions.description,
    });

  const accountNameById = new Map(
    Object.entries(accountIds).map(([name, id]) => [id, name])
  );

  const txIdByKey = new Map<string, string>();
  for (const row of inserted) {
    const accountName = accountNameById.get(row.accountId);
    if (accountName) {
      txIdByKey.set(`${accountName}::${row.description}`, row.id);
    }
  }

  return { txIdByKey, transactionIds: inserted.map((r) => r.id) };
}

export async function insertSeedBudgetEntries(
  userId: string,
  tx: DbTransaction
): Promise<void> {
  const categoryRows = await tx
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(isNull(categories.userId));

  const categoryIdByName = new Map(categoryRows.map((r) => [r.name, r.id]));

  const entryRows = await tx
    .insert(anticipatedBudget)
    .values(
      STAGING_ANTICIPATED_BUDGET.map((entry) => ({
        userId,
        categoryId: entry.category
          ? (categoryIdByName.get(entry.category) ?? null)
          : null,
        name: entry.name,
        needWant: entry.needWant,
        isIncome: entry.isIncome,
        monthlyAmount: entry.monthlyAmount,
        notes: entry.notes,
        effectiveYear: entry.effectiveYear,
      }))
    )
    .returning({ id: anticipatedBudget.id, name: anticipatedBudget.name });

  const entryIdByName = new Map(entryRows.map((r) => [r.name, r.id]));

  const monthValues = STAGING_ANTICIPATED_BUDGET_MONTHS.map((override) => {
    const entryId = entryIdByName.get(override.entryName);
    assertDefined(
      entryId,
      `No budget entry found for month override '${override.entryName}'`
    );
    return {
      anticipatedBudgetId: entryId,
      month: override.month,
      amount: override.amount,
    };
  });

  if (monthValues.length > 0) {
    await tx.insert(anticipatedBudgetMonths).values(monthValues);
  }
}

export async function insertSeedRebalancingGroups(
  userId: string,
  txIdByKey: Map<string, string>,
  tx: DbTransaction
): Promise<void> {
  for (const group of STAGING_REBALANCING_GROUPS) {
    const resolvedIds: { id: string; role: 'source' | 'offset' }[] = [];

    for (const txDef of group.transactions) {
      const key = `${txDef.accountName}::${txDef.description}`;
      const transactionId = txIdByKey.get(key);
      assertDefined(
        transactionId,
        `No transaction found: account '${txDef.accountName}', description '${txDef.description}'`
      );
      resolvedIds.push({ id: transactionId, role: txDef.role });
    }

    const [inserted] = await tx
      .insert(rebalancingGroups)
      .values({
        userId,
        label: group.label,
        status: group.status,
        myShareOverride:
          group.myShareOverride !== null ? String(group.myShareOverride) : null,
        flaggedForReview: group.flaggedForReview,
      })
      .returning({ id: rebalancingGroups.id });

    assertDefined(
      inserted,
      `Expected insert for group '${group.label}' to return a row`
    );

    await tx.insert(rebalancingGroupTransactions).values(
      resolvedIds.map(({ id: transactionId, role }) => ({
        groupId: inserted.id,
        transactionId,
        role,
      }))
    );
  }
}
