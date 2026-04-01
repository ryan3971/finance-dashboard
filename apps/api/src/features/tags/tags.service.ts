import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { tags } from '@/db/schema';

export interface CreateTagInput {
  name: string;
  color?: string;
}

export async function listTags(userId: string) {
  return db.select().from(tags).where(eq(tags.userId, userId)).orderBy(tags.name);
}

export async function createTag(userId: string, input: CreateTagInput) {
  const [tag] = await db
    .insert(tags)
    .values({ ...input, userId })
    .returning();
  return tag;
}

/**
 * Returns false if the tag was not found (or doesn't belong to the user).
 * The transactionTags rows are removed automatically via ON DELETE CASCADE.
 */
export async function deleteTag(id: string, userId: string): Promise<boolean> {
  const [tag] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.id, id), eq(tags.userId, userId)))
    .limit(1);

  if (!tag) return false;

  await db.delete(tags).where(eq(tags.id, id));
  return true;
}
