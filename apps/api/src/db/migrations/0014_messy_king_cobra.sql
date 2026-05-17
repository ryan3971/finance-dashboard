ALTER TABLE "contribution_records" ADD COLUMN "room_carried_confirmed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "contribution_records" DROP COLUMN "contributions";--> statement-breakpoint
ALTER TABLE "contribution_records" DROP COLUMN "withdrawals";--> statement-breakpoint
ALTER TABLE "contribution_records" ADD CONSTRAINT "contribution_records_account_id_tax_year_unique" UNIQUE("account_id","tax_year");