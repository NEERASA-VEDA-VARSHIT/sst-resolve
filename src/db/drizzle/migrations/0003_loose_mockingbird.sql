CREATE TABLE "escalation_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"domain" varchar NOT NULL,
	"scope" varchar,
	"level" varchar NOT NULL,
	"staff_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" varchar,
	"full_name" varchar NOT NULL,
	"email" varchar,
	"slack_user_id" varchar,
	"whatsapp_number" varchar,
	"role" varchar NOT NULL,
	"domain" varchar NOT NULL,
	"scope" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
