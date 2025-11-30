CREATE TABLE "ticket_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"created_by" uuid,
	"is_archived" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "group_id" integer;--> statement-breakpoint
ALTER TABLE "ticket_groups" ADD CONSTRAINT "ticket_groups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ticket_groups_created_by" ON "ticket_groups" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_ticket_groups_archived" ON "ticket_groups" USING btree ("is_archived");--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_group_id_ticket_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."ticket_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_tickets_group" ON "tickets" USING btree ("group_id");