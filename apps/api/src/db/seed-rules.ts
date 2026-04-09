/* eslint-disable no-console */
import { and, eq, isNull } from 'drizzle-orm';
import { categories, categorizationRules } from './schema';
import { db } from './index';
import { RULES } from './seeds/rules';

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

    const sub = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          isNull(categories.userId),
          eq(categories.parentId, parent[0].id),
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
    return sub[0].id;
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
  return result[0].id;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
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
  process.exit(0);
}

main().catch((err) => {
  console.error('Rules seed failed:', err);
  process.exit(1);
});
