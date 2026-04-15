// ─── Auth Test Types ──────────────────────────────────────────────

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
  };
}

// ─── Account Test Types ──────────────────────────────────────────────

export interface AccountRequest {
  name: string;
  type: string;
  institution: string;
  currency: string;
  isCredit: boolean;
}

// isCredit is omitted from PATCH — the service derives it from type.
export interface PatchAccountRequest {
  name?: string;
  type?: string;
  institution?: string;
  currency?: string;
}

export interface AccountResponse {
  id: string;
  name: string;
  type: string;
  institution: string;
  currency: string;
  isCredit: boolean;
  isActive: boolean;
  createdAt: string;
}

// .send() accepts `any`; these wrappers give TypeScript a surface to type-check
// test inputs against the declared request shape without importing schema files.
export const accountRequest = (body: AccountRequest): AccountRequest => body;
export const patchAccountRequest = (
  body: PatchAccountRequest
): PatchAccountRequest => body;

// ─── Category Test Types ──────────────────────────────────────────────
export interface CategoryRequest {
  name: string;
  isIncome?: boolean;
  parentId?: string;
}

export interface PatchCategoryRequest {
  name: string;
}

export const categoryRequest = (body: CategoryRequest): CategoryRequest => body;
export const patchCategoryRequest = (
  body: PatchCategoryRequest
): PatchCategoryRequest => body;

// ─── Transaction Test Types ──────────────────────────────────────────────

export interface TransactionResponse {
  id: string;
  date: string;
  description: string;
  sourceName: string | null;
  amount: string;
  currency: string;
  needWant: string | null;
  isTransfer: boolean;
  isIncome: boolean;
  flaggedForReview: boolean;
  categorySource: string | null;
  note: string | null;
  accountId: string;
  accountName: string;
  accountInstitution: string;
  source: string;
  categoryId: string | null;
  categoryName: string | null;
  subcategoryId: string | null;
  subcategoryName: string | null;
  tags: { id: string; name: string; color: string | null }[];
}

// ─── Categorization Rule Test Types ──────────────────────────────────────────────

export interface RuleResponse {
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

// ─── Transaction Pagination Test Types ──────────────────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ── Tag Test Types ──────────────────────────────────────────────
export interface TagResponse {
  id: string;
  name: string;
  color: string | null;
  createdAt: string;
}