CREATE TYPE "public"."user_type" AS ENUM('human', 'system', 'bot');--> statement-breakpoint
CREATE TABLE "admin_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"domain_id" integer NOT NULL,
	"scope_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_admin_assignment" UNIQUE("user_id","domain_id","scope_id")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"table_name" varchar(100) NOT NULL,
	"record_id" integer NOT NULL,
	"action" varchar(20) NOT NULL,
	" old_data" jsonb,
	"new_data" jsonb,
	"performed_by" uuid,
	"performed_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"batch_year" integer NOT NULL,
	"display_name" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "batches_batch_year_unique" UNIQUE("batch_year")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(140) NOT NULL,
	"slug" varchar(140) NOT NULL,
	"description" text,
	"icon" varchar(64),
	"color" varchar(20),
	"domain_id" integer NOT NULL,
	"scope_id" integer,
	"default_admin_id" uuid,
	"committee_id" integer,
	"parent_category_id" integer,
	"sla_hours" integer DEFAULT 48 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "category_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_category_user" UNIQUE("category_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "category_fields" (
	"id" serial PRIMARY KEY NOT NULL,
	"subcategory_id" integer NOT NULL,
	"name" varchar(140) NOT NULL,
	"slug" varchar(140) NOT NULL,
	"field_type" varchar(50) NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"placeholder" varchar(255),
	"help_text" text,
	"validation_rules" jsonb,
	"assigned_admin_id" uuid,
	"display_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_category_field_subcategory_slug" UNIQUE("subcategory_id","slug")
);
--> statement-breakpoint
CREATE TABLE "category_profile_fields" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"field_name" varchar(64) NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"editable" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_category_profile_field" UNIQUE("category_id","field_name")
);
--> statement-breakpoint
CREATE TABLE "class_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(20) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "class_sections_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"comment_type" varchar(32) DEFAULT 'student_visible' NOT NULL,
	"is_internal" boolean DEFAULT false NOT NULL,
	"slack_message_id" varchar(255),
	"email_thread_id" varchar(255),
	"in_reply_to" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "committee_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"committee_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(64),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_committee_member" UNIQUE("committee_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "committees" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(140) NOT NULL,
	"description" text,
	"contact_email" varchar(256),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "committees_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "deleted_category_fields" (
	"id" serial PRIMARY KEY NOT NULL,
	"original_field_id" integer NOT NULL,
	"field_data" jsonb NOT NULL,
	"options_data" jsonb,
	"deleted_by" uuid NOT NULL,
	"deleted_at" timestamp DEFAULT now() NOT NULL,
	"deletion_reason" text,
	"ticket_count" integer DEFAULT 0,
	CONSTRAINT "deleted_category_fields_original_field_id_unique" UNIQUE("original_field_id")
);
--> statement-breakpoint
CREATE TABLE "domains" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "domains_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "escalation_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"domain_id" integer NOT NULL,
	"scope_id" integer,
	"level" integer NOT NULL,
	"user_id" uuid,
	"notify_channel" varchar(32) DEFAULT 'slack' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_escalation_rule" UNIQUE("domain_id","scope_id","level")
);
--> statement-breakpoint
CREATE TABLE "escalations" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"escalated_by" uuid,
	"escalated_to" uuid,
	"reason" text,
	"level" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "field_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"field_id" integer NOT NULL,
	"label" varchar(255) NOT NULL,
	"value" varchar(255) NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "hostels" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(20),
	"capacity" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "hostels_name_unique" UNIQUE("name"),
	CONSTRAINT "hostels_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "notification_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"slack_enabled" boolean DEFAULT true NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"tat_reminders_enabled" boolean DEFAULT true NOT NULL,
	"committee_notifications_enabled" boolean DEFAULT true NOT NULL,
	"slack_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"ticket_id" integer,
	"channel" varchar(32) NOT NULL,
	"notification_type" varchar(50) NOT NULL,
	"priority" varchar(20) DEFAULT 'normal' NOT NULL,
	"payload" jsonb,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"slack_message_id" varchar(255),
	"email_message_id" varchar(255),
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "scopes" (
	"id" serial PRIMARY KEY NOT NULL,
	"domain_id" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_domain_scope" UNIQUE("domain_id","name")
);
--> statement-breakpoint
CREATE TABLE "student_profile_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"field_id" integer NOT NULL,
	"value" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_student_profile_data" UNIQUE("student_id","field_id")
);
--> statement-breakpoint
CREATE TABLE "student_profile_fields" (
	"id" serial PRIMARY KEY NOT NULL,
	"field_name" varchar(64) NOT NULL,
	"field_label" varchar(128) NOT NULL,
	"field_type" varchar(32) NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"is_editable_by_student" boolean DEFAULT false NOT NULL,
	"is_system_field" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"validation_rules" jsonb,
	"default_value" text,
	"help_text" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "student_profile_fields_field_name_unique" UNIQUE("field_name")
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_uid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"roll_no" varchar(32) NOT NULL,
	"room_no" varchar(16),
	"hostel_id" integer,
	"class_section_id" integer,
	"batch_id" integer,
	"batch_year" integer,
	"department" varchar(120),
	"active" boolean DEFAULT true NOT NULL,
	"source" varchar(20) DEFAULT 'csv' NOT NULL,
	"last_synced_at" timestamp,
	"tickets_this_week" integer DEFAULT 0 NOT NULL,
	"last_ticket_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "students_student_uid_unique" UNIQUE("student_uid"),
	CONSTRAINT "students_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "students_roll_no_unique" UNIQUE("roll_no")
);
--> statement-breakpoint
CREATE TABLE "sub_subcategories" (
	"id" serial PRIMARY KEY NOT NULL,
	"subcategory_id" integer NOT NULL,
	"name" varchar(140) NOT NULL,
	"slug" varchar(140) NOT NULL,
	"description" text,
	"assigned_admin_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_sub_subcategory_subcategory_slug" UNIQUE("subcategory_id","slug")
);
--> statement-breakpoint
CREATE TABLE "subcategories" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"name" varchar(140) NOT NULL,
	"slug" varchar(140) NOT NULL,
	"description" text,
	"assigned_admin_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_subcategory_category_slug" UNIQUE("category_id","slug")
);
--> statement-breakpoint
CREATE TABLE "ticket_activity" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer,
	"user_id" uuid,
	"action" varchar(80) NOT NULL,
	"details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ticket_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"storage_key" varchar(512) NOT NULL,
	"file_size" integer,
	"mime_type" varchar(100),
	"storage_url" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"deleted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ticket_committee_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"committee_id" integer NOT NULL,
	"tagged_by" uuid NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_ticket_committee_tag" UNIQUE("ticket_id","committee_id")
);
--> statement-breakpoint
CREATE TABLE "ticket_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ticket_statuses" (
	"id" serial PRIMARY KEY NOT NULL,
	"value" varchar(50) NOT NULL,
	"label" varchar(100) NOT NULL,
	"description" text,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"badge_color" varchar(50) DEFAULT 'default',
	"is_active" boolean DEFAULT true NOT NULL,
	"is_final" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "ticket_statuses_value_unique" UNIQUE("value")
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255),
	"description" text,
	"location" varchar(255),
	"status_id" integer NOT NULL,
	"category_id" integer,
	"subcategory_id" integer,
	"sub_subcategory_id" integer,
	"created_by" uuid NOT NULL,
	"assigned_to" uuid,
	"acknowledged_by" uuid,
	"group_id" integer,
	"escalation_level" integer DEFAULT 0 NOT NULL,
	"tat_extended_count" integer DEFAULT 0 NOT NULL,
	"last_escalation_at" timestamp,
	"acknowledgement_tat_hours" integer,
	"resolution_tat_hours" integer,
	"acknowledgement_due_at" timestamp,
	"resolution_due_at" timestamp,
	"acknowledged_at" timestamp,
	"reopened_at" timestamp,
	"sla_breached_at" timestamp,
	"reopen_count" integer DEFAULT 0 NOT NULL,
	"rating" integer,
	"feedback_type" varchar(20),
	"rating_submitted" timestamp,
	"feedback" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"admin_link" varchar(512),
	"student_link" varchar(512),
	"slack_thread_id" varchar(255),
	"external_ref" varchar(64),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	CONSTRAINT "tickets_external_ref_unique" UNIQUE("external_ref")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_id" varchar(255) NOT NULL,
	"email" varchar(256) NOT NULL,
	"phone" varchar(30),
	"first_name" varchar(120),
	"last_name" varchar(120),
	"avatar_url" varchar(512),
	"role_id" integer NOT NULL,
	"user_type" "user_type" DEFAULT 'human' NOT NULL,
	"primary_domain_id" integer,
	"primary_scope_id" integer,
	"slack_user_id" varchar(128),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "admin_assignments" ADD CONSTRAINT "admin_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_assignments" ADD CONSTRAINT "admin_assignments_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_assignments" ADD CONSTRAINT "admin_assignments_scope_id_scopes_id_fk" FOREIGN KEY ("scope_id") REFERENCES "public"."scopes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_scope_id_scopes_id_fk" FOREIGN KEY ("scope_id") REFERENCES "public"."scopes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_default_admin_id_users_id_fk" FOREIGN KEY ("default_admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "public"."committees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_category_id_categories_id_fk" FOREIGN KEY ("parent_category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_assignments" ADD CONSTRAINT "category_assignments_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_assignments" ADD CONSTRAINT "category_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_fields" ADD CONSTRAINT "category_fields_subcategory_id_subcategories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."subcategories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_fields" ADD CONSTRAINT "category_fields_assigned_admin_id_users_id_fk" FOREIGN KEY ("assigned_admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_profile_fields" ADD CONSTRAINT "category_profile_fields_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committee_members" ADD CONSTRAINT "committee_members_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "public"."committees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committee_members" ADD CONSTRAINT "committee_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deleted_category_fields" ADD CONSTRAINT "deleted_category_fields_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_rules" ADD CONSTRAINT "escalation_rules_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_rules" ADD CONSTRAINT "escalation_rules_scope_id_scopes_id_fk" FOREIGN KEY ("scope_id") REFERENCES "public"."scopes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_rules" ADD CONSTRAINT "escalation_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_escalated_by_users_id_fk" FOREIGN KEY ("escalated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_escalated_to_users_id_fk" FOREIGN KEY ("escalated_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_options" ADD CONSTRAINT "field_options_field_id_category_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."category_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scopes" ADD CONSTRAINT "scopes_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profile_data" ADD CONSTRAINT "student_profile_data_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profile_data" ADD CONSTRAINT "student_profile_data_field_id_student_profile_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."student_profile_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_hostel_id_hostels_id_fk" FOREIGN KEY ("hostel_id") REFERENCES "public"."hostels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_class_section_id_class_sections_id_fk" FOREIGN KEY ("class_section_id") REFERENCES "public"."class_sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_subcategories" ADD CONSTRAINT "sub_subcategories_subcategory_id_subcategories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."subcategories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_subcategories" ADD CONSTRAINT "sub_subcategories_assigned_admin_id_users_id_fk" FOREIGN KEY ("assigned_admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcategories" ADD CONSTRAINT "subcategories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcategories" ADD CONSTRAINT "subcategories_assigned_admin_id_users_id_fk" FOREIGN KEY ("assigned_admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_activity" ADD CONSTRAINT "ticket_activity_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_activity" ADD CONSTRAINT "ticket_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_committee_tags" ADD CONSTRAINT "ticket_committee_tags_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_committee_tags" ADD CONSTRAINT "ticket_committee_tags_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "public"."committees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_committee_tags" ADD CONSTRAINT "ticket_committee_tags_tagged_by_users_id_fk" FOREIGN KEY ("tagged_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_groups" ADD CONSTRAINT "ticket_groups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_status_id_ticket_statuses_id_fk" FOREIGN KEY ("status_id") REFERENCES "public"."ticket_statuses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_subcategory_id_subcategories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."subcategories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_sub_subcategory_id_sub_subcategories_id_fk" FOREIGN KEY ("sub_subcategory_id") REFERENCES "public"."sub_subcategories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_group_id_ticket_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."ticket_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_primary_domain_id_domains_id_fk" FOREIGN KEY ("primary_domain_id") REFERENCES "public"."domains"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_primary_scope_id_scopes_id_fk" FOREIGN KEY ("primary_scope_id") REFERENCES "public"."scopes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_admin_assignments_user_id" ON "admin_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_admin_assignments_domain_id" ON "admin_assignments" USING btree ("domain_id");--> statement-breakpoint
CREATE INDEX "idx_audit_log_table_record" ON "audit_log" USING btree ("table_name","record_id");--> statement-breakpoint
CREATE INDEX "idx_audit_log_performed_by" ON "audit_log" USING btree ("performed_by");--> statement-breakpoint
CREATE INDEX "idx_audit_log_performed_at" ON "audit_log" USING btree ("performed_at");--> statement-breakpoint
CREATE INDEX "idx_audit_log_action" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_batches_batch_year" ON "batches" USING btree ("batch_year");--> statement-breakpoint
CREATE INDEX "idx_batches_is_active" ON "batches" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_categories_slug" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_categories_domain_id" ON "categories" USING btree ("domain_id");--> statement-breakpoint
CREATE INDEX "idx_categories_parent_category_id" ON "categories" USING btree ("parent_category_id");--> statement-breakpoint
CREATE INDEX "idx_categories_active" ON "categories" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_categories_display_order" ON "categories" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "idx_category_assignments_category" ON "category_assignments" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_category_assignments_user" ON "category_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_category_assignments_primary" ON "category_assignments" USING btree ("category_id","is_primary");--> statement-breakpoint
CREATE INDEX "idx_category_fields_subcategory_id" ON "category_fields" USING btree ("subcategory_id");--> statement-breakpoint
CREATE INDEX "idx_category_fields_slug" ON "category_fields" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_category_fields_active" ON "category_fields" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_category_fields_display_order" ON "category_fields" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "idx_category_profile_fields_category_id" ON "category_profile_fields" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_category_profile_fields_field_name" ON "category_profile_fields" USING btree ("field_name");--> statement-breakpoint
CREATE INDEX "idx_category_profile_fields_display_order" ON "category_profile_fields" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "idx_class_sections_name" ON "class_sections" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_class_sections_is_active" ON "class_sections" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_comments_ticket_id" ON "comments" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "idx_comments_author_id" ON "comments" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "idx_comments_ticket_created" ON "comments" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_committee_members_committee_id" ON "committee_members" USING btree ("committee_id");--> statement-breakpoint
CREATE INDEX "idx_committee_members_user_id" ON "committee_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_committees_name" ON "committees" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_deleted_fields_original_id" ON "deleted_category_fields" USING btree ("original_field_id");--> statement-breakpoint
CREATE INDEX "idx_deleted_fields_deleted_at" ON "deleted_category_fields" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_deleted_fields_deleted_by" ON "deleted_category_fields" USING btree ("deleted_by");--> statement-breakpoint
CREATE INDEX "idx_domains_name" ON "domains" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_domains_is_active" ON "domains" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_escalation_rules_domain_scope_level" ON "escalation_rules" USING btree ("domain_id","scope_id","level");--> statement-breakpoint
CREATE INDEX "idx_escalation_rules_domain_level" ON "escalation_rules" USING btree ("domain_id","level");--> statement-breakpoint
CREATE INDEX "idx_escalations_ticket_id" ON "escalations" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "idx_escalations_level" ON "escalations" USING btree ("level");--> statement-breakpoint
CREATE INDEX "idx_escalations_ticket_level" ON "escalations" USING btree ("ticket_id","level");--> statement-breakpoint
CREATE INDEX "idx_field_options_field_id" ON "field_options" USING btree ("field_id");--> statement-breakpoint
CREATE INDEX "idx_field_options_display_order" ON "field_options" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "idx_field_options_active" ON "field_options" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_hostels_name" ON "hostels" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_hostels_is_active" ON "hostels" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_id" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_ticket_id" ON "notifications" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_status" ON "notifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_status" ON "notifications" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_notifications_type" ON "notifications" USING btree ("notification_type");--> statement-breakpoint
CREATE INDEX "idx_roles_name" ON "roles" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_scopes_domain_id" ON "scopes" USING btree ("domain_id");--> statement-breakpoint
CREATE INDEX "idx_scopes_name" ON "scopes" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_scopes_is_active" ON "scopes" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_student_profile_data_student_field" ON "student_profile_data" USING btree ("student_id","field_id");--> statement-breakpoint
CREATE INDEX "idx_profile_fields_name" ON "student_profile_fields" USING btree ("field_name");--> statement-breakpoint
CREATE INDEX "idx_profile_fields_order" ON "student_profile_fields" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "idx_students_user_id" ON "students" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_students_roll_no" ON "students" USING btree ("roll_no");--> statement-breakpoint
CREATE INDEX "idx_students_batch_year" ON "students" USING btree ("batch_year");--> statement-breakpoint
CREATE INDEX "idx_students_hostel_id" ON "students" USING btree ("hostel_id");--> statement-breakpoint
CREATE INDEX "idx_students_batch_id" ON "students" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_students_class_section_id" ON "students" USING btree ("class_section_id");--> statement-breakpoint
CREATE INDEX "idx_students_active" ON "students" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_students_student_uid" ON "students" USING btree ("student_uid");--> statement-breakpoint
CREATE INDEX "idx_sub_subcategories_subcategory_id" ON "sub_subcategories" USING btree ("subcategory_id");--> statement-breakpoint
CREATE INDEX "idx_sub_subcategories_slug" ON "sub_subcategories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_sub_subcategories_active" ON "sub_subcategories" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_sub_subcategories_display_order" ON "sub_subcategories" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "idx_subcategories_category_id" ON "subcategories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_subcategories_slug" ON "subcategories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_subcategories_active" ON "subcategories" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_subcategories_display_order" ON "subcategories" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "idx_ticket_activity_ticket_id" ON "ticket_activity" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "idx_ticket_activity_user_id" ON "ticket_activity" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ticket_activity_ticket_created" ON "ticket_activity" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_ticket_attachments_ticket_id" ON "ticket_attachments" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "idx_ticket_attachments_uploaded_by" ON "ticket_attachments" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "idx_ticket_attachments_is_deleted" ON "ticket_attachments" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "idx_ticket_committee_tags_ticket_id" ON "ticket_committee_tags" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "idx_ticket_committee_tags_committee_id" ON "ticket_committee_tags" USING btree ("committee_id");--> statement-breakpoint
CREATE INDEX "idx_ticket_committee_tags_tagged_by" ON "ticket_committee_tags" USING btree ("tagged_by");--> statement-breakpoint
CREATE INDEX "idx_ticket_groups_created_by" ON "ticket_groups" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_ticket_groups_created_at" ON "ticket_groups" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_ticket_statuses_value" ON "ticket_statuses" USING btree ("value");--> statement-breakpoint
CREATE INDEX "idx_ticket_statuses_is_active" ON "ticket_statuses" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_ticket_statuses_display_order" ON "ticket_statuses" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "idx_tickets_status_id" ON "tickets" USING btree ("status_id");--> statement-breakpoint
CREATE INDEX "idx_tickets_category_id" ON "tickets" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_tickets_subcategory_id" ON "tickets" USING btree ("subcategory_id");--> statement-breakpoint
CREATE INDEX "idx_tickets_created_by" ON "tickets" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_tickets_assigned_to" ON "tickets" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_tickets_group_id" ON "tickets" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "idx_tickets_escalation_level" ON "tickets" USING btree ("escalation_level");--> statement-breakpoint
CREATE INDEX "idx_tickets_status_created" ON "tickets" USING btree ("status_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_tickets_metadata" ON "tickets" USING gin ("metadata");--> statement-breakpoint
CREATE INDEX "idx_users_clerk_id" ON "users" USING btree ("clerk_id");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_role_id" ON "users" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "idx_users_user_type" ON "users" USING btree ("user_type");--> statement-breakpoint
CREATE INDEX "idx_users_primary_domain_id" ON "users" USING btree ("primary_domain_id");