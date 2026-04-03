import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { tags } from '@/db/schema';
import { TagError, TagErrorCode } from './tags.errors';

export interface CreateTagInput {
  name: string;
  color?: string;
}

const TAG_COLUMNS = {
  id: tags.id,
  name: tags.name,
  color: tags.color,
  createdAt: tags.createdAt,
};

export async function listTags(userId: string) {
  return db
    .select(TAG_COLUMNS)
    .from(tags)
    .where(eq(tags.userId, userId))
    .orderBy(tags.name);
}

export async function createTag(userId: string, input: CreateTagInput) {
  const [existing] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.userId, userId), eq(tags.name, input.name)))
    .limit(1);

  if (existing) throw new TagError(TagErrorCode.NAME_TAKEN);

  const [tag] = await db
    .insert(tags)
    .values({ ...input, userId })
    .returning(TAG_COLUMNS);

  return tag;
}

/**
 * Returns null if the tag was not found (or doesn't belong to the user).
 * The transactionTags rows are removed automatically via ON DELETE CASCADE.
 */
export async function deleteTag(id: string, userId: string): Promise<{ id: string } | null> {
  const [deleted] = await db
    .delete(tags)
    .where(and(eq(tags.id, id), eq(tags.userId, userId)))
    .returning({ id: tags.id });

  return deleted ?? null;
}
