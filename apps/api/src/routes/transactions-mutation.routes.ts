import {
  accounts,
  categorizationRules,
  tags,
  transactions,
  transactionTags,
} from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import type { NextFunction, Request, Response } from 'express';
import { db } from '@/db';
import { requireAuth } from '@/middleware/auth';
import { Router } from 'express';
import { z } from 'zod';

const router = Router();

// ─── Schemas ─────────────────────────────────────────────────────────────────

const patchTransactionSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  subcategoryId: z.string().uuid().nullable().optional(),
  needWant: z.enum(['Need', 'Want', 'NA']).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  // If true, create a categorization_rule from this override
  createRule: z.boolean().optional().default(false),
});

const createTransactionSchema = z.object({
  accountId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  description: z.string().min(1).max(500),
  amount: z.number(),
  currency: z.string().length(3).default('CAD'),
  categoryId: z.string().uuid().nullable().optional(),
  subcategoryId: z.string().uuid().nullable().optional(),
  needWant: z.enum(['Need', 'Want', 'NA']).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  isIncome: z.boolean().optional(),
});

// ─── Helper — verify transaction ownership ───────────────────────────────────

async function getOwnedTransaction(transactionId: string, userId: string) {
  const [txn] = await db
    .select({
      id: transactions.id,
      description: transactions.description,
      accountId: transactions.accountId,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(and(eq(transactions.id, transactionId), eq(accounts.userId, userId)))
    .limit(1);
  return txn ?? null;
}

// ─── PATCH /api/v1/transactions/:id ──────────────────────────────────────────

router.patch(
  '/:id',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const txn = await getOwnedTransaction(req.params.id, req.user!.id);
      if (!txn) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }

      const input = patchTransactionSchema.parse(req.body);

      // Build update payload — only include fields that were provided
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (input.categoryId !== undefined) {
        updateData.categoryId = input.categoryId;
        updateData.categorySource = 'manual';
        updateData.categoryConfidence = '1.000';
        updateData.flaggedForReview = false;
      }
      if (input.subcategoryId !== undefined)
        updateData.subcategoryId = input.subcategoryId;
      if (input.needWant !== undefined) updateData.needWant = input.needWant;
      if (input.note !== undefined) updateData.note = input.note;

      await db
        .update(transactions)
        .set(updateData)
        .where(eq(transactions.id, req.params.id));

      // Optionally create a categorization rule from this override
      if (input.createRule && input.categoryId) {
        // Derive a keyword from the transaction description (first 40 chars, lowercased)
        const keyword = txn.description.slice(0, 40).toLowerCase().trim();

        // Check if a rule with this keyword already exists for this user
        const existing = await db
          .select({ id: categorizationRules.id })
          .from(categorizationRules)
          .where(
            and(
              eq(categorizationRules.userId, req.user!.id),
              eq(categorizationRules.keyword, keyword)
            )
          )
          .limit(1);

        if (existing.length === 0) {
          await db.insert(categorizationRules).values({
            userId: req.user!.id,
            keyword,
            categoryId: input.categoryId,
            subcategoryId: input.subcategoryId ?? null,
            needWant: input.needWant ?? null,
            priority: 5, // User rules outrank system rules
          });
        }
      }

      // Return the updated transaction
      const [updated] = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, req.params.id))
        .limit(1);

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/v1/transactions (manual entry) ────────────────────────────────

router.post(
  '/',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = createTransactionSchema.parse(req.body);

      // Verify the account belongs to this user
      const [account] = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(
          and(
            eq(accounts.id, input.accountId),
            eq(accounts.userId, req.user!.id)
          )
        )
        .limit(1);

      if (!account) {
        res.status(404).json({ error: 'Account not found' });
        return;
      }

      // Build composite key for deduplication
      const normDesc = input.description
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-');
      const compositeKey = `${input.accountId}-${input.date}-${normDesc}-${input.amount}`;

      const isIncome = input.isIncome ?? input.amount > 0;

      const [created] = await db
        .insert(transactions)
        .values({
          accountId: input.accountId,
          importId: null,
          date: input.date,
          description: input.description.toLowerCase().trim(),
          rawDescription: input.description,
          amount: String(input.amount),
          currency: input.currency,
          categoryId: input.categoryId ?? null,
          subcategoryId: input.subcategoryId ?? null,
          needWant: input.needWant ?? null,
          categorySource: input.categoryId ? 'manual' : 'default',
          categoryConfidence: input.categoryId ? '1.000' : null,
          isTransfer: false,
          isIncome,
          flaggedForReview: !input.categoryId,
          compositeKey,
          note: input.note ?? null,
          source: 'manual',
        })
        .returning();

      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/v1/transactions/:id/tags ──────────────────────────────────────

router.post(
  '/:id/tags',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const txn = await getOwnedTransaction(req.params.id, req.user!.id);
      if (!txn) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }

      const { tagId } = z.object({ tagId: z.string().uuid() }).parse(req.body);

      // Verify tag belongs to this user
      const [tag] = await db
        .select({ id: tags.id })
        .from(tags)
        .where(and(eq(tags.id, tagId), eq(tags.userId, req.user!.id)))
        .limit(1);

      if (!tag) {
        res.status(404).json({ error: 'Tag not found' });
        return;
      }

      // Insert — ignore if already attached (idempotent)
      await db
        .insert(transactionTags)
        .values({ transactionId: req.params.id, tagId })
        .onConflictDoNothing();

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

// ─── DELETE /api/v1/transactions/:id/tags/:tagId ─────────────────────────────

router.delete(
  '/:id/tags/:tagId',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const txn = await getOwnedTransaction(req.params.id, req.user!.id);
      if (!txn) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }

      await db
        .delete(transactionTags)
        .where(
          and(
            eq(transactionTags.transactionId, req.params.id),
            eq(transactionTags.tagId, req.params.tagId)
          )
        );

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

export default router;
