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
