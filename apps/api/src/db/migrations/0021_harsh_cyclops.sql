ALTER TABLE "rebalancing_groups" ADD COLUMN "type" text DEFAULT 'rebalancing' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_config" ADD COLUMN "transfer_detection_window_days" integer;--> statement-breakpoint
ALTER TABLE "user_config" ADD COLUMN "refund_detection_window_days" integer;--> statement-breakpoint
ALTER TABLE "rebalancing_groups" ADD CONSTRAINT "rebalancing_groups_type_check" CHECK ("rebalancing_groups"."type" IN ('rebalancing', 'refund'));