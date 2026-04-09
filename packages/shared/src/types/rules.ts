import type { NeedWant } from '../constants';

export interface Rule {
  id: string;
  keyword: string;
  sourceName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  subcategoryId: string | null;
  subcategoryName: string | null;
  needWant: NeedWant | null;
  priority: number;
  createdAt: string;
}
