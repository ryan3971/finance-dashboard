import type { ExpenseCategoryRow } from '@finance/shared/types/dashboard';

export interface ExpenseCategoryTreeRow {
  key: string;
  label: string;
  total: number;
  /** Fraction of the grand total (category rows) or parent category total (subcategory rows). Range: 0–1. */
  share: number;
  subRows?: ExpenseCategoryTreeRow[];
}

// Use a sentinel key for null-category rows to avoid collision with a real
// category that happens to be named "Uncategorized".
function groupByCategoryKey(
  filtered: ExpenseCategoryRow[],
): Map<string, { label: string; rows: ExpenseCategoryRow[] }> {
  const categoryMap = new Map<string, { label: string; rows: ExpenseCategoryRow[] }>();
  for (const row of filtered) {
    const catKey = row.category ?? '__null_category__';
    const catLabel = row.category ?? 'Uncategorized';
    let entry = categoryMap.get(catKey);
    if (!entry) {
      entry = { label: catLabel, rows: [] };
      categoryMap.set(catKey, entry);
    }
    entry.rows.push(row);
  }
  return categoryMap;
}

// Separate named subcategory rows from null-subcategory transactions.
// Null-subcategory totals are absorbed into a dedicated "Uncategorized" child
// rather than silently inflating the parent row only.
function buildSubRows(
  catKey: string,
  catRows: ExpenseCategoryRow[],
  categoryTotal: number,
): ExpenseCategoryTreeRow[] {
  const subcategoryMap = new Map<string, number>();
  let uncategorizedSubtotal = 0;

  for (const row of catRows) {
    if (row.subcategory === null) {
      uncategorizedSubtotal += row.total;
    } else {
      subcategoryMap.set(row.subcategory, (subcategoryMap.get(row.subcategory) ?? 0) + row.total);
    }
  }

  const subRows: ExpenseCategoryTreeRow[] = Array.from(subcategoryMap.entries())
    .map(([label, total]) => ({
      key: `${catKey}::${label}`,
      label,
      total,
      share: categoryTotal > 0 ? total / categoryTotal : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // Always append the "Uncategorized" child last when null-subcategory transactions exist.
  if (uncategorizedSubtotal > 0) {
    subRows.push({
      key: `${catKey}::__null_sub__`,
      label: 'Uncategorized',
      total: uncategorizedSubtotal,
      share: categoryTotal > 0 ? uncategorizedSubtotal / categoryTotal : 0,
    });
  }

  return subRows;
}

export function buildCategoryTree(
  rows: ExpenseCategoryRow[],
  monthFilter: number | null,
): ExpenseCategoryTreeRow[] {
  const filtered =
    monthFilter === null ? rows : rows.filter((r) => r.month === monthFilter);

  const grandTotal = filtered.reduce((sum, r) => sum + r.total, 0);
  if (grandTotal === 0) return [];

  const categoryMap = groupByCategoryKey(filtered);
  const treeRows: ExpenseCategoryTreeRow[] = [];

  for (const [catKey, { label: catLabel, rows: catRows }] of categoryMap) {
    const categoryTotal = catRows.reduce((sum, r) => sum + r.total, 0);
    const subRows = buildSubRows(catKey, catRows, categoryTotal);
    treeRows.push({
      key: catKey,
      label: catLabel,
      total: categoryTotal,
      share: grandTotal > 0 ? categoryTotal / grandTotal : 0,
      // subRows is always non-empty here: every category has at least one named
      // subcategory or an "Uncategorized" child from null-subcategory transactions.
      subRows: subRows.length > 0 ? subRows : undefined,
    });
  }

  // Sort: null-category ("Uncategorized") always last; named categories by total desc.
  treeRows.sort((a, b) => {
    if (a.key === '__null_category__') return 1;
    if (b.key === '__null_category__') return -1;
    return b.total - a.total;
  });

  return treeRows;
}
