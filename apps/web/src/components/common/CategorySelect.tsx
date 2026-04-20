import { useState } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { FIELD_LIMITS } from '@finance/shared/constants';
import { useCategories } from '@/hooks/useCategories';
import {
  useCreateCategory,
  useCreateSubcategory,
} from '@/hooks/useCategoryMutations';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/Command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/Popover';
import { cn } from '@/lib/utils';

interface Props {
  readonly categoryId: string;
  readonly subcategoryId: string;
  readonly onCategoryChange: (id: string) => void;
  readonly onSubcategoryChange: (id: string) => void;
  readonly isIncome?: boolean;
}

export function CategorySelect({
  categoryId,
  subcategoryId,
  onCategoryChange,
  onSubcategoryChange,
  isIncome = false,
}: Props) {
  const { data: categories } = useCategories();
  const createCategory = useCreateCategory();
  const createSubcategory = useCreateSubcategory();

  const [categoryOpen, setCategoryOpen] = useState(false);
  const [subcategoryOpen, setSubcategoryOpen] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState('');
  const [subcategoryQuery, setSubcategoryQuery] = useState('');

  const selectedCategory = categories?.find((c) => c.id === categoryId);
  const selectedSubcategory = selectedCategory?.subcategories.find(
    (s) => s.id === subcategoryId
  );

  const trimmedCategoryQuery = categoryQuery.trim();
  const trimmedSubcategoryQuery = subcategoryQuery.trim();

  const showCreateCategory =
    trimmedCategoryQuery.length > 0 &&
    !categories?.some(
      (c) => c.name.toLowerCase() === trimmedCategoryQuery.toLowerCase()
    );

  const showCreateSubcategory =
    trimmedSubcategoryQuery.length > 0 &&
    !selectedCategory?.subcategories.some(
      (s) => s.name.toLowerCase() === trimmedSubcategoryQuery.toLowerCase()
    );

  const filteredCategories =
    categories?.filter((c) =>
      c.name.toLowerCase().includes(trimmedCategoryQuery.toLowerCase())
    ) ?? [];

  const filteredSubcategories =
    selectedCategory?.subcategories.filter((s) =>
      s.name.toLowerCase().includes(trimmedSubcategoryQuery.toLowerCase())
    ) ?? [];

  const isPending = createCategory.isPending || createSubcategory.isPending;

  async function handleCreateCategory() {
    const name = trimmedCategoryQuery;
    setCategoryOpen(false);
    setCategoryQuery('');
    const newCat = await createCategory.mutateAsync({ name, isIncome });
    onCategoryChange(newCat.id);
    onSubcategoryChange('');
  }

  async function handleCreateSubcategory() {
    const name = trimmedSubcategoryQuery;
    setSubcategoryOpen(false);
    setSubcategoryQuery('');
    const newSub = await createSubcategory.mutateAsync({
      name,
      parentId: categoryId,
    });
    onSubcategoryChange(newSub.id);
  }

  const triggerClass = cn(
    'flex flex-1 items-center justify-between',
    'px-2 py-1.5 border border-border-strong rounded text-sm text-left',
    isPending && 'opacity-50 cursor-not-allowed'
  );

  return (
    <div className="flex gap-2">
      <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={isPending}
            className={cn(
              triggerClass,
              !selectedCategory && 'text-content-muted'
            )}
          >
            <span className="truncate">
              {selectedCategory ? selectedCategory.name : 'Select category'}
            </span>
            <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 text-content-muted" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0"
          align="start"
          style={{ width: 'var(--radix-popover-trigger-width)' }}
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search or create…"
              value={categoryQuery}
              onValueChange={setCategoryQuery}
              maxLength={FIELD_LIMITS.SUBCATEGORY_NAME_MAX}
            />
            <CommandList>
              {filteredCategories.length === 0 && !showCreateCategory && (
                <CommandEmpty>No categories found.</CommandEmpty>
              )}
              <CommandGroup>
                {filteredCategories.map((cat) => (
                  <CommandItem
                    key={cat.id}
                    value={cat.id}
                    onSelect={() => {
                      onCategoryChange(cat.id);
                      onSubcategoryChange('');
                      setCategoryQuery('');
                      setCategoryOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        cat.id === categoryId ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {cat.name}
                  </CommandItem>
                ))}
                {showCreateCategory && (
                  <CommandItem
                    value="__create__"
                    onSelect={() => {
                      void handleCreateCategory();
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create &ldquo;{trimmedCategoryQuery}&rdquo;
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedCategory && (
        <Popover open={subcategoryOpen} onOpenChange={setSubcategoryOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={isPending}
              className={cn(
                triggerClass,
                !selectedSubcategory && 'text-content-muted'
              )}
            >
              <span className="truncate">
                {selectedSubcategory
                  ? selectedSubcategory.name
                  : 'No subcategory'}
              </span>
              <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 text-content-muted" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="p-0"
            align="start"
            style={{ width: 'var(--radix-popover-trigger-width)' }}
          >
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Search or create…"
                value={subcategoryQuery}
                onValueChange={setSubcategoryQuery}
                maxLength={FIELD_LIMITS.SUBCATEGORY_NAME_MAX}
              />
              <CommandList>
                {filteredSubcategories.length === 0 &&
                  !showCreateSubcategory && (
                    <CommandEmpty>No subcategories found.</CommandEmpty>
                  )}
                <CommandGroup>
                  {subcategoryId && (
                    <CommandItem
                      value="__none__"
                      onSelect={() => {
                        onSubcategoryChange('');
                        setSubcategoryQuery('');
                        setSubcategoryOpen(false);
                      }}
                    >
                      <Check className="mr-2 h-4 w-4 opacity-0" />
                      No subcategory
                    </CommandItem>
                  )}
                  {filteredSubcategories.map((sub) => (
                    <CommandItem
                      key={sub.id}
                      value={sub.id}
                      onSelect={() => {
                        onSubcategoryChange(sub.id);
                        setSubcategoryQuery('');
                        setSubcategoryOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          sub.id === subcategoryId ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      {sub.name}
                    </CommandItem>
                  ))}
                  {showCreateSubcategory && (
                    <CommandItem
                      value="__create__"
                      onSelect={() => {
                        void handleCreateSubcategory();
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Create &ldquo;{trimmedSubcategoryQuery}&rdquo;
                    </CommandItem>
                  )}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
