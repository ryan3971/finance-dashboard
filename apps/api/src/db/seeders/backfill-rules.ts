/* eslint-disable no-console */
import { isNotNull } from 'drizzle-orm';
import { db as defaultDb } from '@/db';
import { categorizationRules, users } from '@/db/schema';
import { seedUserRules } from './user-rules';

export async function backfillRulesToAllUsers(
  db: typeof defaultDb = defaultDb
): Promise<void> {
  const allUsers = await db.select({ id: users.id }).from(users);

  if (allUsers.length === 0) {
    console.log('No users found — nothing to backfill');
    return;
  }

  const usersWithRules = await db
    .selectDistinct({ userId: categorizationRules.userId })
    .from(categorizationRules)
    .where(isNotNull(categorizationRules.userId));

  const seededIds = new Set(usersWithRules.map((r) => r.userId));
  const unseeded = allUsers.filter((u) => !seededIds.has(u.id));

  if (unseeded.length === 0) {
    console.log('All users already have rules — nothing to backfill');
    return;
  }

  for (const u of unseeded) {
    console.log(`Backfilling rules for user ${u.id}...`);
    await seedUserRules(u.id, db);
  }

  console.log(`Backfilled rules for ${unseeded.length} user(s)`);
}
