export interface Category {
  id: string;
  name: string;
  isIncome: boolean;
  icon: string | null;
  userId: string | null;
  subcategories: Subcategory[];
}

export interface Subcategory {
  id: string;
  name: string;
  isIncome: boolean;
  icon: string | null;
  userId: string | null;
}