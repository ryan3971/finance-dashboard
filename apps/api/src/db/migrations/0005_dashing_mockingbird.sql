CREATE TABLE "rebalancing_group_transactions" (
	"group_id" uuid NOT NULL,
	"transaction_id" uuid NOT NULL,
	"role" text NOT NULL,
	CONSTRAINT "rebalancing_group_transactions_group_id_transaction_id_pk" PRIMARY KEY("group_id","transaction_id"),
	CONSTRAINT "rebalancing_group_transactions_role_check" CHECK ("rebalancing_group_transactions"."role" IN ('source', 'offset'))
);
--> statement-breakpoint
CREATE TABLE "rebalancing_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"my_share_override" numeric(12, 2),
	"flagged_for_review" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rebalancing_groups_status_check" CHECK ("rebalancing_groups"."status" IN ('open', 'resolved'))
);
--> statement-breakpoint
ALTER TABLE "rebalancing_group_transactions" ADD CONSTRAINT "rebalancing_group_transactions_group_id_rebalancing_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."rebalancing_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebalancing_group_transactions" ADD CONSTRAINT "rebalancing_group_transactions_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebalancing_groups" ADD CONSTRAINT "rebalancing_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;