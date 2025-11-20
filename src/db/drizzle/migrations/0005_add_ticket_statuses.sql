-- Create ticket_statuses table for dynamic status configuration
CREATE TABLE "ticket_statuses" (
	"id" serial PRIMARY KEY NOT NULL,
	"value" varchar(50) NOT NULL UNIQUE,
	"label" varchar(100) NOT NULL,
	"description" text,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"badge_color" varchar(50) DEFAULT 'default',
	"is_active" boolean DEFAULT true NOT NULL,
	"is_final" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint

-- Create indexes
CREATE INDEX "idx_ticket_statuses_value" ON "ticket_statuses" ("value");
--> statement-breakpoint
CREATE INDEX "idx_ticket_statuses_is_active" ON "ticket_statuses" ("is_active");
--> statement-breakpoint
CREATE INDEX "idx_ticket_statuses_display_order" ON "ticket_statuses" ("display_order");
--> statement-breakpoint

-- Seed initial status values
INSERT INTO "ticket_statuses" ("value", "label", "description", "progress_percent", "badge_color", "is_active", "is_final", "display_order") VALUES
('OPEN', 'Open', 'New ticket, not yet assigned', 10, 'default', true, false, 1),
('IN_PROGRESS', 'In Progress', 'POC is actively working on the ticket', 50, 'secondary', true, false, 2),
('AWAITING_STUDENT', 'Awaiting Student', 'Waiting for student response', 70, 'outline', true, false, 3),
('REOPENED', 'Reopened', 'Ticket was reopened by student', 30, 'destructive', true, false, 4),
('ESCALATED', 'Escalated', 'Ticket has been escalated', 60, 'destructive', true, false, 5),
('RESOLVED', 'Resolved', 'Ticket has been resolved', 100, 'default', true, true, 6);
