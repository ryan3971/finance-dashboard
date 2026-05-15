CREATE TABLE "rule_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"suggested_keyword" text NOT NULL,
	"category_id" uuid,
	"subcategory_id" uuid,
	"need_want" text,
	"confidence" numeric(4, 3) NOT NULL,
	"transaction_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rule_suggestions_need_want_check" CHECK ("rule_suggestions"."need_want" IS NULL OR "rule_suggestions"."need_want" IN ('Need', 'Want', 'NA')),
	CONSTRAINT "rule_suggestions_status_check" CHECK ("rule_suggestions"."status" IN ('pending', 'accepted', 'dismissed'))
);
--> statement-breakpoint
ALTER TABLE "rule_suggestions" ADD CONSTRAINT "rule_suggestions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_suggestions" ADD CONSTRAINT "rule_suggestions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_suggestions" ADD CONSTRAINT "rule_suggestions_subcategory_id_categories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_suggestions" ADD CONSTRAINT "rule_suggestions_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rule_suggestions_user_keyword_unique" ON "rule_suggestions" (user_id, lower(suggested_keyword)) WHERE status = 'pending';
