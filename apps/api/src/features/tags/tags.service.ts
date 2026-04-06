import { and, eq } from 'drizzle-orm';
import { DatabaseError } from 'pg';
import { db } from '@/db';
import { tags } from '@/db/schema';
import { TagError, TagErrorCode } from './tags.errors';
import type { CreateTagInput } from '@finance/shared';

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
  // Fast-path: avoids hitting the DB constraint in the common case and gives a
  // clean domain error without catching a pg exception. A concurrent insert can
  // still bypass this check; the unique constraint + catch below is the
  // correctness guarantee.
  const [existing] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.userId, userId), eq(tags.name, input.name)))
    .limit(1);

  if (existing) throw new TagError(TagErrorCode.NAME_TAKEN);

  try {
    const [tag] = await db
      .insert(tags)
      .values({ ...input, userId })
      .returning(TAG_COLUMNS);

    // Drizzle never returns an empty array for a successful insert; if it does
    // the DB or ORM has behaved unexpectedly. Not a domain error — let the
    // error handler log it and return 500.
    if (!tag) throw new Error('Insert returned no rows');
    return tag;
  } catch (err) {
    // Concurrent insert slipped past the pre-check and hit the unique constraint.
    if (err instanceof DatabaseError && err.code === '23505') {
      throw new TagError(TagErrorCode.NAME_TAKEN);
    }
    throw err;
  }
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
