/* eslint-disable no-console */
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

import { isNotNull } from 'drizzle-orm';
import { db } from './index';
import { categories, categorizationRules, users } from './schema';
import { seedSystemCategories, seedUserCategories } from './seed-categories';
import { seedUserRules } from './seed-rules';

async function main() {
  await seedSystemCategories();

  // Backfill any users who registered before per-user category seeding was added
  const allUsers = await db.select({ id: users.id }).from(users);

  if (allUsers.length > 0) {
    const usersWithCategories = await db
      .selectDistinct({ userId: categories.userId })
      .from(categories)
      .where(isNotNull(categories.userId));

    const seededIds = new Set(usersWithCategories.map((r) => r.userId));
    const unseeded = allUsers.filter((u) => !seededIds.has(u.id));

    for (const u of unseeded) {
      console.log(`Backfilling categories for user ${u.id}...`);
      await seedUserCategories(u.id, db);
    }

    const usersWithRules = await db
      .selectDistinct({ userId: categorizationRules.userId })
      .from(categorizationRules)
      .where(isNotNull(categorizationRules.userId));

    const seededRuleIds = new Set(usersWithRules.map((r) => r.userId));
    const unseededRules = allUsers.filter((u) => !seededRuleIds.has(u.id));

    for (const u of unseededRules) {
      console.log(`Backfilling rules for user ${u.id}...`);
      await seedUserRules(u.id, db);
    }
  }

  console.log('All seeds complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
