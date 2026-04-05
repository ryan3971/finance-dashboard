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
