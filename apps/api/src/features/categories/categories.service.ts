import { eq, isNull, or } from 'drizzle-orm';
import { categories } from '@/db/schema';
import { db } from '@/db';

export async function getCategoryTree(userId: string) {
  const allCategories = await db
    .select({
      id: categories.id,
      name: categories.name,
      isIncome: categories.isIncome,
      icon: categories.icon,
      userId: categories.userId,
      parentId: categories.parentId,
    })
    .from(categories)
    .where(or(isNull(categories.userId), eq(categories.userId, userId)))
    .orderBy(categories.name);

  const subcategoryMap = new Map<string, typeof allCategories>();
  const topLevel: typeof allCategories = [];

  for (const category of allCategories) {
    if (category.parentId === null) {
      topLevel.push(category);
    } else {
      const siblings = subcategoryMap.get(category.parentId) ?? [];
      siblings.push(category);
      subcategoryMap.set(category.parentId, siblings);
    }
  }

  return topLevel.map((parent) => ({
    id: parent.id,
    name: parent.name,
    isIncome: parent.isIncome,
    icon: parent.icon,
    userId: parent.userId,
    subcategories: (subcategoryMap.get(parent.id) ?? []).map((sub) => ({
      id: sub.id,
      name: sub.name,
      isIncome: sub.isIncome,
      icon: sub.icon,
      userId: sub.userId,
    })),
  }));
}
