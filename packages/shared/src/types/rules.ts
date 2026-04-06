export interface Rule {
  id: string;
  keyword: string;
  sourceName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  subcategoryId: string | null;
  subcategoryName: string | null;
  needWant: string | null;
  priority: number;
  createdAt: string;
}
