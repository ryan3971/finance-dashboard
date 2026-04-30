/* eslint-disable no-console */
import { and, eq, isNull } from 'drizzle-orm';
import { db as defaultDb } from '@/db';
import { categories, categorizationRules } from '@/db/schema';
import { RULES } from '@/db/seeds/system/rules';
import { STAGING_RULES } from '@/db/seeds/staging/rules';
import { TEST_RULES } from '@/db/seeds/test/rules';
import type { SeedEnv } from './system-categories';

type DbLike = typeof defaultDb;

function getRulesData(env: SeedEnv) {
  if (env === 'system') return RULES;
  if (env === 'staging') return STAGING_RULES;
  return TEST_RULES;
}

async function getCategoryId(
  db: DbLike,
  name: string,
  parentName?: string
): Promise<string | null> {
  if (parentName) {
    const [parent] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          isNull(categories.userId),
          isNull(categories.parentId),
          eq(categories.name, parentName)
        )
      )
      .limit(1);

    if (!parent) {
      console.warn(`  ⚠ Parent category not found: "${parentName}"`);
      return null;
    }

    const [sub] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          isNull(categories.userId),
          eq(categories.parentId, parent.id),
          eq(categories.name, name)
        )
      )
      .limit(1);

    if (!sub) {
      console.warn(`  ⚠ Subcategory not found: "${name}" under "${parentName}"`);
      return null;
    }

    return sub.id;
  }

  const [result] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        isNull(categories.userId),
        isNull(categories.parentId),
        eq(categories.name, name)
      )
    )
    .limit(1);

  if (!result) {
    console.warn(`  ⚠ Category not found: "${name}"`);
    return null;
  }

  return result.id;
}

export async function addSystemRules(
  env: SeedEnv,
  db: DbLike = defaultDb
): Promise<void> {
  const data = getRulesData(env);
  let inserted = 0;
  let skipped = 0;

  for (const rule of data) {
    const [existing] = await db
      .select({ id: categorizationRules.id })
      .from(categorizationRules)
      .where(
        and(
          isNull(categorizationRules.userId),
          eq(categorizationRules.keyword, rule.keyword)
        )
      )
      .limit(1);

    if (existing) {
      skipped++;
      continue;
    }

    const categoryId = rule.category
      ? await getCategoryId(db, rule.category)
      : null;

    const subcategoryId =
      rule.subcategory && rule.category
        ? await getCategoryId(db, rule.subcategory, rule.category)
        : null;

    await db.insert(categorizationRules).values({
      userId: null,
      keyword: rule.keyword,
      sourceName: rule.sourceName,
      categoryId,
      subcategoryId,
      needWant: rule.needWant,
      priority: rule.priority,
    });

    inserted++;
  }

  console.log(`Rules — inserted: ${inserted}, skipped: ${skipped}`);
}

export async function removeSystemRules(db: DbLike = defaultDb): Promise<void> {
  const { rowCount } = await db
    .delete(categorizationRules)
    .where(isNull(categorizationRules.userId));

  console.log(`Deleted ${rowCount ?? 0} system rule(s)`);
}
