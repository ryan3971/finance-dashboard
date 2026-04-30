/* eslint-disable no-console */
import { and, eq, isNull, isNotNull } from 'drizzle-orm';
import { categories, categorizationRules, users } from './schema';
import { db } from './index';
import { seedSystemCategories } from './seed-categories';
import { seedUserRules } from './seed-rules';
import { RULES } from './seeds/rules';
import { assertDefined } from '@/lib/assert';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getCategoryId(
  name: string,
  parentName?: string
): Promise<string | null> {
  if (!name) return null;

  if (parentName) {
    const parent = await db
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

    if (parent.length === 0) {
      console.warn(`  ⚠ Parent category not found: "${parentName}"`);
      return null;
    }

    const parentRow = parent[0];
    assertDefined(parentRow, 'Expected parent category row after length check');

    const sub = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          isNull(categories.userId),
          eq(categories.parentId, parentRow.id),
          eq(categories.name, name)
        )
      )
      .limit(1);

    if (sub.length === 0) {
      console.warn(
        `  ⚠ Subcategory not found: "${name}" under "${parentName}"`
      );
      return null;
    }
    const subRow = sub[0];
    assertDefined(subRow, 'Expected subcategory row after length check');
    return subRow.id;
  }

  const result = await db
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

  if (result.length === 0) {
    console.warn(`  ⚠ Category not found: "${name}"`);
    return null;
  }
  const resultRow = result[0];
  assertDefined(resultRow, 'Expected category row after length check');
  return resultRow.id;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  await seedSystemCategories();
  console.log('Seeding categorization rules...');
  let inserted = 0;
  let skipped = 0;

  for (const rule of RULES) {
    const categoryId = rule.category
      ? await getCategoryId(rule.category)
      : null;

    const subcategoryId =
      rule.subcategory && rule.category
        ? await getCategoryId(rule.subcategory, rule.category)
        : null;

    const existing = await db
      .select({ id: categorizationRules.id })
      .from(categorizationRules)
      .where(
        and(
          isNull(categorizationRules.userId),
          eq(categorizationRules.keyword, rule.keyword)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      skipped++;
      continue;
    }

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

  console.log(
    `Done. Inserted: ${inserted}, Skipped (already exist): ${skipped}`
  );

  // Backfill any users who don't yet have their own rule copies
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
  console.error('Rules seed failed:', err);
  process.exit(1);
});
