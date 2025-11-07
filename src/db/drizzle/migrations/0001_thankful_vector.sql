ALTER TABLE "students" ADD COLUMN "whatsapp_number" varchar;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "tickets_this_week" text DEFAULT '0';--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "last_ticket_date" timestamp;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "escalation_count" text DEFAULT '0';--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "escalated_at" timestamp;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "escalated_to" text;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "rating" text;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "rating_submitted" timestamp;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "rating_required" text DEFAULT 'false';--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "updated_at" timestamp DEFAULT now();