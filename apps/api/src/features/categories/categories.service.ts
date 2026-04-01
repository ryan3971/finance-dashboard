import { eq, isNull, or } from 'drizzle-orm';
import { categories } from '@/db/schema';
import { db } from '@/db';

export async function getCategoryTree(userId: string) {
  const allCategories = await db
    .select()
    .from(categories)
    .where(or(isNull(categories.userId), eq(categories.userId, userId)))
    .orderBy(categories.name);

  const topLevel = allCategories.filter((c) => c.parentId === null);
  const subcategories = allCategories.filter((c) => c.parentId !== null);

  return topLevel.map((parent) => ({
    id: parent.id,
    name: parent.name,
    isIncome: parent.isIncome,
    icon: parent.icon,
    userId: parent.userId,
    subcategories: subcategories
      .filter((sub) => sub.parentId === parent.id)
      .map((sub) => ({
        id: sub.id,
        name: sub.name,
        isIncome: sub.isIncome,
        icon: sub.icon,
        userId: sub.userId,
      })),
  }));
}
