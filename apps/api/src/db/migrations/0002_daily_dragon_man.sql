CREATE TABLE IF NOT EXISTS "anticipated_budget" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category_id" uuid,
	"name" text NOT NULL,
	"need_want" text,
	"is_income" boolean DEFAULT false NOT NULL,
	"monthly_amount" numeric(12, 2),
	"notes" text,
	"effective_year" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "anticipated_budget_months" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"anticipated_budget_id" uuid NOT NULL,
	"month" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	CONSTRAINT "anticipated_budget_months_anticipated_budget_id_month_unique" UNIQUE("anticipated_budget_id","month")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anticipated_budget" ADD CONSTRAINT "anticipated_budget_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anticipated_budget" ADD CONSTRAINT "anticipated_budget_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anticipated_budget_months" ADD CONSTRAINT "anticipated_budget_months_anticipated_budget_id_anticipated_budget_id_fk" FOREIGN KEY ("anticipated_budget_id") REFERENCES "public"."anticipated_budget"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
