// TODO: this may be where I also have any keys with dashboard refresh, since a change in transactions, accounts, or anticipated budget should trigger a dashboard refresh. For now, I'm just relying on the fact that the dashboard queries are all set to refetchOnWindowFocus: true, so they'll refresh when the user navigates back to the dashboard after making changes elsewhere. But if I want more real-time updates to the dashboard while the user is still on it, I may need to add some shared keys here and use queryClient.invalidateQueries(dashboardKeys.all()) after any relevant mutations.
// This also may be something that is done in the mutation
export const transactionKeys = {
  all: () => ['transactions'] as const,
  list: (filters?: object) => ['transactions', 'list', filters] as const,
};

export const accountKeys = {
  all: () => ['accounts'] as const,
  allWithInactive: () => ['accounts', 'all'] as const,
};

export const categoryKeys = {
  all: () => ['categories'] as const,
};

export const tagKeys = {
  all: () => ['tags'] as const,
};

export const ruleKeys = {
  all: () => ['rules'] as const,
};

export const userConfigKeys = {
  all: () => ['user-config'] as const,
};

export const anticipatedBudgetKeys = {
  all: () => ['anticipated-budget'] as const,
  byYear: (year: number) => ['anticipated-budget', year] as const,
};

export const dashboardKeys = {
  all: () => ['dashboard'] as const,
  income: (year: number) => ['dashboard', 'income', year] as const,
  expenses: (year: number) => ['dashboard', 'expenses', year] as const,
  expensesCategories: (year: number) =>
    ['dashboard', 'expenses', 'categories', year] as const,
  snapshot: () => ['dashboard', 'snapshot'] as const,
  ytd: (year: number) => ['dashboard', 'ytd', year] as const,
};
