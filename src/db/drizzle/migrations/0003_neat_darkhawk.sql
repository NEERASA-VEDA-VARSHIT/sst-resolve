CREATE TABLE "notification_channels" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_type" varchar(32) NOT NULL,
	"owner_id" varchar(255) NOT NULL,
	"channel_type" varchar(32) DEFAULT 'slack' NOT NULL,
	"slack_channel_id" varchar(255),
	"slack_thread" varchar(255),
	"slack_user_id" varchar(128),
	"priority" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notification_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer,
	"subcategory_id" integer,
	"enable_slack" boolean DEFAULT true,
	"enable_email" boolean DEFAULT true,
	"slack_channel" varchar(255),
	"slack_cc_user_ids" jsonb,
	"email_recipients" jsonb,
	"priority" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "ticket_groups" ADD COLUMN "committee_id" integer;--> statement-breakpoint
ALTER TABLE "notification_config" ADD CONSTRAINT "notification_config_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_config" ADD CONSTRAINT "notification_config_subcategory_id_subcategories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."subcategories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_notification_channels_owner" ON "notification_channels" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "idx_notification_channels_active" ON "notification_channels" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_notification_channels_type" ON "notification_channels" USING btree ("channel_type");--> statement-breakpoint
CREATE INDEX "idx_notification_channels_priority" ON "notification_channels" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_notification_config_category" ON "notification_config" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_notification_config_subcategory" ON "notification_config" USING btree ("subcategory_id");--> statement-breakpoint
CREATE INDEX "idx_notification_config_active" ON "notification_config" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_notification_config_priority" ON "notification_config" USING btree ("priority");--> statement-breakpoint
ALTER TABLE "ticket_groups" ADD CONSTRAINT "ticket_groups_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "public"."committees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ticket_groups_committee" ON "ticket_groups" USING btree ("committee_id");