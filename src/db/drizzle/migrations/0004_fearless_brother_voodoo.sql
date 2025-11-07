CREATE TABLE "committee_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"committee_id" text NOT NULL,
	"clerk_user_id" varchar NOT NULL,
	"role" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "committees" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "acknowledged_at" timestamp;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "acknowledged_by" text;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "acknowledgement_tat" text;