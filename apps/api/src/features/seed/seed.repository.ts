import Decimal from 'decimal.js';
import { and, eq, isNull, or } from 'drizzle-orm';
import { assertDefined } from '@/lib/assert';
import { db as defaultDb, type DbTransaction } from '@/db';
import {
  accounts,
  anticipatedBudget,
  anticipatedBudgetMonths,
  categories,
  categorizationRules,
  contributionRecords,
  investmentTransactions,
  rebalancingGroupTransactions,
  rebalancingGroups,
  tags,
  transactionTags,
  transactions,
  userConfig,
} from '@/db/schema';
import { STAGING_ACCOUNTS } from '@/db/seeds/staging/accounts';
import {
  STAGING_ANTICIPATED_BUDGET,
  STAGING_ANTICIPATED_BUDGET_MONTHS,
} from '@/db/seeds/staging/anticipated-budget';
import { STAGING_CATEGORIES } from '@/db/seeds/staging/categories';
import { STAGING_CONTRIBUTION_RECORDS } from '@/db/seeds/staging/contribution-records';
import { STAGING_INVESTMENT_TRANSACTIONS } from '@/db/seeds/staging/investment-transactions';
import { STAGING_REBALANCING_GROUPS } from '@/db/seeds/staging/rebalancing-groups';
import { STAGING_RULES } from '@/db/seeds/staging/rules';
import { STAGING_TAG_APPLICATIONS, STAGING_TAGS } from '@/db/seeds/staging/tags';
import { STAGING_TRANSACTIONS } from '@/db/seeds/staging/transactions';
import { STAGING_USER_CONFIG } from '@/db/seeds/staging/user-config';
import { categorize, type LoadedRule } from '@/pipelines/categorization/pipeline';
import { TRANSACTION_SOURCE } from '@/lib/constants';
import type { AccountType, Institution } from '@finance/shared/constants';

// Resolves a relative (monthsAgo, day) pair to a YYYY-MM-DD date string using
// the local clock at seed time. This keeps sample data aligned with the current
// month regardless of when the seed endpoint is called.
function resolveDate(monthsAgo: number, day: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, day);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Inserts staging categories as user-level categories (idempotent).
// Must be committed before insertSeedRules so the categories exist for lookup.
export async function insertSeedCategories(userId: string): Promise<void> {
  for (const cat of STAGING_CATEGORIES) {
    const [existing] = await defaultDb
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          eq(categories.userId, userId),
          isNull(categories.parentId),
          eq(categories.name, cat.name)
        )
      )
      .limit(1);

    let parentId: string;
    if (existing) {
      parentId = existing.id;
    } else {
      const [row] = await defaultDb
        .insert(categories)
        .values({ userId, name: cat.name, isIncome: cat.isIncome, icon: cat.icon, parentId: null })
        .returning({ id: categories.id });
      assertDefined(row, `Expected insert for category '${cat.name}'`);
      parentId = row.id;
    }

    for (const subName of cat.subcategories) {
      const [existingSub] = await defaultDb
        .select({ id: categories.id })
        .from(categories)
        .where(
          and(
            eq(categories.userId, userId),
            eq(categories.parentId, parentId),
            eq(categories.name, subName)
          )
        )
        .limit(1);

      if (!existingSub) {
        await defaultDb.insert(categories).values({
          userId,
          name: subName,
          isIncome: cat.isIncome,
          icon: null,
          parentId,
        });
      }
    }
  }
}

// Inserts staging rules as user-level rules (idempotent).
// Category IDs are resolved against system categories (userId IS NULL) first,
// falling back to user-created categories from insertSeedCategories. This ensures
// the endpoint works in both pre-seeded environments and fresh installs.
export async function insertSeedRules(userId: string): Promise<void> {
  const allCategoryRows = await defaultDb
    .select({ id: categories.id, name: categories.name, parentId: categories.parentId, isSystem: isNull(categories.userId) })
    .from(categories)
    .where(or(isNull(categories.userId), eq(categories.userId, userId)));

  // Build parent map preferring system categories over user categories when both exist.
  const parentMap = new Map<string, string>();
  // Process user categories first so system categories overwrite them (system takes precedence).
  for (const row of allCategoryRows) {
    if (row.parentId !== null) continue;
    if (!parentMap.has(row.name) || row.isSystem) {
      parentMap.set(row.name, row.id);
    }
  }

  function resolveCategoryId(name: string): string | null {
    return parentMap.get(name) ?? null;
  }

  function resolveSubcategoryId(subName: string, parentName: string): string | null {
    const parentId = parentMap.get(parentName);
    if (!parentId) return null;
    const sub = allCategoryRows.find(
      (r) => r.name === subName && r.parentId === parentId
    );
    return sub?.id ?? null;
  }

  for (const rule of STAGING_RULES) {
    const [existing] = await defaultDb
      .select({ id: categorizationRules.id })
      .from(categorizationRules)
      .where(
        and(
          eq(categorizationRules.userId, userId),
          eq(categorizationRules.keyword, rule.keyword)
        )
      )
      .limit(1);

    if (existing) continue;

    const categoryId = rule.category ? resolveCategoryId(rule.category) : null;
    const subcategoryId =
      rule.subcategory && rule.category
        ? resolveSubcategoryId(rule.subcategory, rule.category)
        : null;

    await defaultDb.insert(categorizationRules).values({
      userId,
      keyword: rule.keyword,
      sourceName: rule.sourceName,
      categoryId,
      subcategoryId,
      needWant: rule.needWant,
      priority: rule.priority,
    });
  }

}

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
        date: resolveDate(def.monthsAgo, def.day),
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
  const effectiveYear = new Date().getFullYear();

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
        effectiveYear,
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

export async function insertSeedUserConfig(
  userId: string,
  tx: DbTransaction
): Promise<void> {
  await tx
    .insert(userConfig)
    .values({
      userId,
      needsPercentage: STAGING_USER_CONFIG.needsPercentage,
      wantsPercentage: STAGING_USER_CONFIG.wantsPercentage,
      investmentsPercentage: STAGING_USER_CONFIG.investmentsPercentage,
      emergencyFundTarget: STAGING_USER_CONFIG.emergencyFundTarget,
    })
    .onConflictDoUpdate({
      target: userConfig.userId,
      set: {
        needsPercentage: STAGING_USER_CONFIG.needsPercentage,
        wantsPercentage: STAGING_USER_CONFIG.wantsPercentage,
        investmentsPercentage: STAGING_USER_CONFIG.investmentsPercentage,
        emergencyFundTarget: STAGING_USER_CONFIG.emergencyFundTarget,
      },
    });
}

export async function insertSeedTags(
  userId: string,
  txIdByKey: Map<string, string>,
  tx: DbTransaction
): Promise<void> {
  const tagRows = await tx
    .insert(tags)
    .values(
      STAGING_TAGS.map((t) => ({
        userId,
        name: t.name,
        color: t.color,
      }))
    )
    .returning({ id: tags.id, name: tags.name });

  const tagIdByName = new Map(tagRows.map((r) => [r.name, r.id]));

  const applicationValues = STAGING_TAG_APPLICATIONS.flatMap((app) => {
    const tagId = tagIdByName.get(app.tagName);
    const transactionId = txIdByKey.get(`${app.accountName}::${app.description}`);

    if (!tagId || !transactionId) return [];

    return [{ tagId, transactionId }];
  });

  if (applicationValues.length > 0) {
    await tx.insert(transactionTags).values(applicationValues);
  }
}

export async function insertSeedInvestmentTransactions(
  accountIds: Record<string, string>,
  tx: DbTransaction
): Promise<void> {
  const values = STAGING_INVESTMENT_TRANSACTIONS.map((def, i) => {
    const accountId = accountIds[def.accountName];
    assertDefined(accountId, `No account found for investment seed name '${def.accountName}'`);
    return {
      accountId,
      date: resolveDate(def.monthsAgo, def.day),
      action: def.action,
      rawAction: def.rawAction,
      symbol: def.symbol ?? null,
      description: def.description,
      quantity: def.quantity ?? null,
      price: def.price ?? null,
      grossAmount: def.grossAmount ?? null,
      commission: def.commission ?? null,
      amount: def.amount,
      currency: def.currency,
      activityType: def.activityType ?? null,
      compositeKey: `seed-inv-${def.accountName}-${i}`,
    };
  });

  await tx.insert(investmentTransactions).values(values);
}

export async function insertSeedContributionRecords(
  accountIds: Record<string, string>,
  tx: DbTransaction
): Promise<void> {
  const currentYear = new Date().getFullYear();
  const values = STAGING_CONTRIBUTION_RECORDS.map((def) => {
    const accountId = accountIds[def.accountName];
    assertDefined(accountId, `No account found for contribution record seed name '${def.accountName}'`);
    return {
      accountId,
      taxYear: currentYear - def.yearsAgo,
      annualLimit: def.annualLimit,
      roomCarried: def.roomCarried,
      roomCarriedConfirmed: def.roomCarriedConfirmed,
    };
  });

  await tx.insert(contributionRecords).values(values).onConflictDoNothing();
}
