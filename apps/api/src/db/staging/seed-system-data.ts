/* eslint-disable no-console */
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { and, eq, isNull } from 'drizzle-orm';
import { assertDefined } from '@/lib/assert';
import { db } from '@/db';
import { categories, categorizationRules } from '@/db/schema';
import { seedUserRules } from '@/db/seed-rules';
import { STAGING_CATEGORIES } from '../seeds/staging/categories';
import { STAGING_RULES } from '../seeds/staging/rules';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getCategoryId(
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
      console.warn(
        `  ⚠ Subcategory not found: "${name}" under "${parentName}"`
      );
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

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function seedStagingSystemData(): Promise<void> {
  console.log('Seeding staging categories...');
  let catInserted = 0;
  let catSkipped = 0;

  for (const cat of STAGING_CATEGORIES) {
    const [existing] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          isNull(categories.userId),
          isNull(categories.parentId),
          eq(categories.name, cat.name)
        )
      )
      .limit(1);

    let parentId: string;

    if (existing) {
      parentId = existing.id;
      catSkipped++;
    } else {
      const [inserted] = await db
        .insert(categories)
        .values({
          userId: null,
          name: cat.name,
          isIncome: cat.isIncome,
          icon: cat.icon,
          parentId: null,
        })
        .returning({ id: categories.id });
      assertDefined(inserted, `Expected insert for category "${cat.name}"`);
      parentId = inserted.id;
      catInserted++;
    }

    for (const subName of cat.subcategories) {
      const [existingSub] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(
          and(
            isNull(categories.userId),
            eq(categories.parentId, parentId),
            eq(categories.name, subName)
          )
        )
        .limit(1);

      if (existingSub) {
        catSkipped++;
        continue;
      }

      await db.insert(categories).values({
        userId: null,
        name: subName,
        isIncome: cat.isIncome,
        icon: null,
        parentId,
      });
      catInserted++;
    }
  }

  console.log(`Categories — inserted: ${catInserted}, skipped: ${catSkipped}`);

  console.log('Seeding staging rules...');
  let ruleInserted = 0;
  let ruleSkipped = 0;

  for (const rule of STAGING_RULES) {
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
      ruleSkipped++;
      continue;
    }

    const categoryId = rule.category
      ? await getCategoryId(rule.category)
      : null;

    const subcategoryId =
      rule.subcategory && rule.category
        ? await getCategoryId(rule.subcategory, rule.category)
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

    ruleInserted++;
  }

  console.log(`Rules — inserted: ${ruleInserted}, skipped: ${ruleSkipped}`);
}

async function main() {
  await seedStagingSystemData();

  // Backfill any users who don't yet have their own rule copies
  const { users } = await import('@/db/schema');
  const { isNotNull } = await import('drizzle-orm');

  const allUsers = await db.select({ id: users.id }).from(users);

  if (allUsers.length > 0) {
    const usersWithRules = await db
      .selectDistinct({ userId: categorizationRules.userId })
      .from(categorizationRules)
      .where(isNotNull(categorizationRules.userId));

    const seededIds = new Set(usersWithRules.map((r) => r.userId));
    const unseeded = allUsers.filter((u) => !seededIds.has(u.id));

    for (const u of unseeded) {
      console.log(`Backfilling rules for user ${u.id}...`);
      await seedUserRules(u.id, db);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Staging system seed failed:', err);
  process.exit(1);
});
