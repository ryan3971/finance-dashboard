import { eq } from 'drizzle-orm';
import { userConfig } from '@/db/schema';
import { db } from '@/db';

export async function getUserConfig(userId: string) {
  const [existing] = await db
    .select()
    .from(userConfig)
    .where(eq(userConfig.userId, userId))
    .limit(1);

  if (existing) return existing;

  const [created] = await db.insert(userConfig).values({ userId }).returning();

  return created;
}

export async function updateUserConfig(
  userId: string,
  _input: Record<string, never>
) {
  return getUserConfig(userId);
}
