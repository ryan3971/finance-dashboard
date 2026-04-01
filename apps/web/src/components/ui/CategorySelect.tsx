import { useCategories } from '@/hooks/useCategories';

interface Props {
  categoryId: string;
  subcategoryId: string;
  onCategoryChange: (id: string) => void;
  onSubcategoryChange: (id: string) => void;
}

export function CategorySelect({
  categoryId,
  subcategoryId,
  onCategoryChange,
  onSubcategoryChange,
}: Props) {
  const { data: categories } = useCategories();

  const selectedCategory = categories?.find(c => c.id === categoryId);

  return (
    <div className="flex gap-2">
      <select
        value={categoryId}
        onChange={e => {
          onCategoryChange(e.target.value);
          onSubcategoryChange(''); // reset subcategory when category changes
        }}
        className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
      >
        <option value="">Select category</option>
        {categories?.map(cat => (
          <option key={cat.id} value={cat.id}>{cat.name}</option>
        ))}
      </select>

      {selectedCategory && selectedCategory.subcategories.length > 0 && (
        <select
          value={subcategoryId}
          onChange={e => onSubcategoryChange(e.target.value)}
          className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
        >
          <option value="">No subcategory</option>
          {selectedCategory.subcategories.map(sub => (
            <option key={sub.id} value={sub.id}>{sub.name}</option>
          ))}
        </select>
      )}
    </div>
  );
}