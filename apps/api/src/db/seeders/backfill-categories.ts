/* eslint-disable no-console */
import { isNotNull } from 'drizzle-orm';
import { db as defaultDb } from '@/db';
import { categories, users } from '@/db/schema';
import { seedUserCategories } from './user-categories';

export async function backfillCategoriesToAllUsers(
  db: typeof defaultDb = defaultDb
): Promise<void> {
  const allUsers = await db.select({ id: users.id }).from(users);

  if (allUsers.length === 0) {
    console.log('No users found — nothing to backfill');
    return;
  }

  const usersWithCategories = await db
    .selectDistinct({ userId: categories.userId })
    .from(categories)
    .where(isNotNull(categories.userId));

  const seededIds = new Set(usersWithCategories.map((r) => r.userId));
  const unseeded = allUsers.filter((u) => !seededIds.has(u.id));

  if (unseeded.length === 0) {
    console.log('All users already have categories — nothing to backfill');
    return;
  }

  for (const u of unseeded) {
    console.log(`Backfilling categories for user ${u.id}...`);
    await seedUserCategories(u.id, db);
  }

  console.log(`Backfilled categories for ${unseeded.length} user(s)`);
}
