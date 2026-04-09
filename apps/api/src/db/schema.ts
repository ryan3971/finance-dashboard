import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { DEFAULT_CURRENCY, NEED_WANT_OPTIONS } from '@finance/shared';
import { relations } from 'drizzle-orm';

// ─── Auth ────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  tokenHash: text('token_hash').unique().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Accounts ────────────────────────────────────────────────────────────────

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  institution: text('institution').notNull(),
  currency: text('currency').notNull().default(DEFAULT_CURRENCY),
  isActive: boolean('is_active').notNull().default(true),
  isCredit: boolean('is_credit').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Categories ──────────────────────────────────────────────────────────────

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  name: text('name').notNull(),
  parentId: uuid('parent_id'),
  isIncome: boolean('is_income').notNull().default(false),
  icon: text('icon'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Categorization Rules ────────────────────────────────────────────────────

export const categorizationRules = pgTable('categorization_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  keyword: text('keyword').notNull(),
  sourceName: text('source_name'),
  categoryId: uuid('category_id').references(() => categories.id),
  subcategoryId: uuid('subcategory_id').references(() => categories.id),
  needWant: text('need_want', { enum: [...NEED_WANT_OPTIONS, 'ADD'] }),
  priority: integer('priority').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Tags ────────────────────────────────────────────────────────────────────

export const tags = pgTable(
  'tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    name: text('name').notNull(),
    color: text('color'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    uniqUserName: unique().on(t.userId, t.name),
  })
);

// ─── Imports ─────────────────────────────────────────────────────────────────

export const imports = pgTable('imports', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  accountId: uuid('account_id')
    .references(() => accounts.id)
    .notNull(),
  filename: text('filename').notNull(),
  s3Key: text('s3_key').notNull(),
  status: text('status').notNull().default('pending'),
  rowCount: integer('row_count'),
  importedCount: integer('imported_count'),
  duplicateCount: integer('duplicate_count'),
  flaggedCount: integer('flagged_count'),
  errorCount: integer('error_count'),
  errorDetail: jsonb('error_detail'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Transactions ─────────────────────────────────────────────────────────────

export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id')
    .references(() => accounts.id)
    .notNull(),
  importId: uuid('import_id').references(() => imports.id),
  date: date('date').notNull(),
  description: text('description').notNull(),
  rawDescription: text('raw_description').notNull(),
  sourceName: text('source_name'),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  currency: text('currency').notNull().default(DEFAULT_CURRENCY),
  categoryId: uuid('category_id').references(() => categories.id),
  subcategoryId: uuid('subcategory_id').references(() => categories.id),
  needWant: text('need_want'),
  categorySource: text('category_source'),
  categoryConfidence: numeric('category_confidence', {
    precision: 4,
    scale: 3,
  }),
  isTransfer: boolean('is_transfer').notNull().default(false),
  transferPairId: uuid('transfer_pair_id'),
  isIncome: boolean('is_income').notNull().default(false),
  flaggedForReview: boolean('flagged_for_review').notNull().default(false),
  compositeKey: text('composite_key').unique().notNull(),
  note: text('note'),
  source: text('source').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const transactionTags = pgTable(
  'transaction_tags',
  {
    transactionId: uuid('transaction_id')
      .references(() => transactions.id, { onDelete: 'cascade' })
      .notNull(),
    tagId: uuid('tag_id')
      .references(() => tags.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.transactionId, table.tagId] }),
  })
);

// ─── Investment Tracking ──────────────────────────────────────────────────────

export const investmentTransactions = pgTable('investment_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id')
    .references(() => accounts.id)
    .notNull(),
  importId: uuid('import_id').references(() => imports.id),
  date: date('date').notNull(),
  action: text('action').notNull(),
  rawAction: text('raw_action').notNull(),
  symbol: text('symbol'),
  description: text('description'),
  quantity: numeric('quantity', { precision: 16, scale: 6 }),
  price: numeric('price', { precision: 14, scale: 4 }),
  grossAmount: numeric('gross_amount', { precision: 14, scale: 2 }),
  commission: numeric('commission', { precision: 10, scale: 2 }),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  currency: text('currency').notNull().default(DEFAULT_CURRENCY),
  riskLevel: text('risk_level'),
  activityType: text('activity_type'),
  compositeKey: text('composite_key').unique().notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const investmentSnapshots = pgTable('investment_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id')
    .references(() => accounts.id)
    .notNull(),
  snapshotDate: date('snapshot_date').notNull(),
  balance: numeric('balance', { precision: 14, scale: 2 }).notNull(),
  currency: text('currency').notNull().default(DEFAULT_CURRENCY),
  source: text('source').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const contributionRecords = pgTable('contribution_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id')
    .references(() => accounts.id)
    .notNull(),
  taxYear: integer('tax_year').notNull(),
  annualLimit: numeric('annual_limit', { precision: 12, scale: 2 }),
  contributions: numeric('contributions', { precision: 12, scale: 2 })
    .notNull()
    .default('0'),
  withdrawals: numeric('withdrawals', { precision: 12, scale: 2 })
    .notNull()
    .default('0'),
  roomCarried: numeric('room_carried', { precision: 12, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Config ───────────────────────────────────────────────────────────────────

export const userConfig = pgTable('user_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id)
    .unique()
    .notNull(),
  emergencyFundTarget: numeric('emergency_fund_target', {
    precision: 12,
    scale: 2,
  }),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Relations ───────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many, one }) => ({
  accounts: many(accounts),
  refreshTokens: many(refreshTokens),
  tags: many(tags),
  config: one(userConfig),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
  transactions: many(transactions),
  imports: many(imports),
  investmentTransactions: many(investmentTransactions),
  investmentSnapshots: many(investmentSnapshots),
  contributionRecords: many(contributionRecords),
}));

export const transactionsRelations = relations(
  transactions,
  ({ one, many }) => ({
    account: one(accounts, {
      fields: [transactions.accountId],
      references: [accounts.id],
    }),
    import: one(imports, {
      fields: [transactions.importId],
      references: [imports.id],
    }),
    category: one(categories, {
      fields: [transactions.categoryId],
      references: [categories.id],
    }),
    subcategory: one(categories, {
      fields: [transactions.subcategoryId],
      references: [categories.id],
    }),
    transactionTags: many(transactionTags),
  })
);
