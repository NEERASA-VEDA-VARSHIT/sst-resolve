import {
	pgEnum,
	pgTable,
	serial,
	uuid,
	varchar,
	text,
	timestamp,
	integer,
	boolean,
	jsonb,
	index,
	unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/* ---------- ENUMS ---------- */

// PRD v3.0 Status Flow: New → In Progress → Awaiting Student Response → Reopened → Escalated → Resolved
// NOTE: ticketStatus enum is DEPRECATED - will be replaced with ticket_statuses table for dynamic configuration
// Kept temporarily for backward compatibility during migration
export const ticketStatus = pgEnum("ticket_status", [
	"OPEN", // New (initial status)
	"IN_PROGRESS", // POC is working on it
	"AWAITING_STUDENT", // Awaiting Student Response (admin asked a question)
	"REOPENED", // Student reopened a closed ticket (PRD v3.0)
	"ESCALATED", // Ticket has been escalated
	"FORWARDED", // Ticket has been forwarded to next level
	"RESOLVED", // Resolved successfully
]);

// NOTE: hostelEnum and classEnum removed - replaced with dynamic master tables (hostels, class_sections)

/* ---------- TICKET STATUSES (Dynamic status configuration - SuperAdmin controlled) ---------- */
export const ticket_statuses = pgTable(
	"ticket_statuses",
	{
		id: serial("id").primaryKey(),
		value: varchar("value", { length: 50 }).notNull().unique(), // Enum value (OPEN, IN_PROGRESS, etc.)
		label: varchar("label", { length: 100 }).notNull(), // Display label (Open, In Progress, etc.)
		description: text("description"), // Optional description
		progress_percent: integer("progress_percent").default(0).notNull(), // Progress percentage (0-100)
		badge_color: varchar("badge_color", { length: 50 }).default("default"), // Tailwind badge variant (default, secondary, destructive, outline)
		is_active: boolean("is_active").default(true).notNull(), // Whether status is active
		is_final: boolean("is_final").default(false).notNull(), // Whether this is a final state (RESOLVED, CLOSED)
		display_order: integer("display_order").default(0).notNull(), // Sort order in UI
		created_at: timestamp("created_at").defaultNow(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(table) => ({
		valueIdx: index("idx_ticket_statuses_value").on(table.value),
		isActiveIdx: index("idx_ticket_statuses_is_active").on(table.is_active),
		displayOrderIdx: index("idx_ticket_statuses_display_order").on(table.display_order),
	}),
);


/* ---------- ROLES (single source of truth for role definitions) ---------- */
export const roles = pgTable(
	"roles",
	{
		id: serial("id").primaryKey(),
		name: varchar("name", { length: 64 }).notNull().unique(),
		description: text("description"),
		created_at: timestamp("created_at").defaultNow(),
	},
	(table) => ({
		nameIdx: index("idx_roles_name").on(table.name),
	}),
);

/* ---------- USERS (auth identity from Clerk) ---------- */
export const users = pgTable(
	"users",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		clerk_id: varchar("clerk_id", { length: 255 }).notNull().unique(),
		email: varchar("email", { length: 256 }).notNull().unique(),
		name: varchar("name", { length: 120 }),
		phone: varchar("phone", { length: 30 }),
		// NOTE: role_id removed - use user_roles table for multi-role support
		created_at: timestamp("created_at").defaultNow(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(table) => ({
		clerkIdIdx: index("idx_users_clerk_id").on(table.clerk_id),
		emailIdx: index("idx_users_email").on(table.email),
		createdAtIdx: index("idx_users_created_at").on(table.created_at),
	}),
);

/* ---------- USER ROLES (multi-role support with scoping) ---------- */
// Supports: multi-role, scoped roles, time-bound roles, flexible RBAC
export const user_roles = pgTable(
	"user_roles",
	{
		id: serial("id").primaryKey(),
		user_id: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
		role_id: integer("role_id").references(() => roles.id).notNull(),
		domain: varchar("domain", { length: 64 }), // Optional: scope role to domain (Hostel, College)
		scope: varchar("scope", { length: 128 }), // Optional: scope role to specific scope (Neeladri, Velankani, etc.)
		granted_by: uuid("granted_by").references(() => users.id, { onDelete: "set null" }), // Who granted this role
		created_at: timestamp("created_at").defaultNow(),
	},
	(table) => ({
		userIdx: index("idx_user_roles_user_id").on(table.user_id),
		roleIdx: index("idx_user_roles_role_id").on(table.role_id),
		domainScopeIdx: index("idx_user_roles_domain_scope").on(table.domain, table.scope),
		uniqueRoleScope: unique("unique_user_role_scope").on(
			table.user_id,
			table.role_id,
			table.domain,
			table.scope,
		),
	}),
);

/* ---------- MASTER TABLES (Admin-Controlled Data) ---------- */

/* Hostels - Dynamic hostel list controlled by admin */
export const hostels = pgTable(
	"hostels",
	{
		id: serial("id").primaryKey(),
		name: varchar("name", { length: 100 }).notNull().unique(),
		code: varchar("code", { length: 20 }).unique(),
		capacity: integer("capacity"),
		is_active: boolean("is_active").default(true).notNull(),
		created_at: timestamp("created_at").defaultNow(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(table) => ({
		nameIdx: index("idx_hostels_name").on(table.name),
		isActiveIdx: index("idx_hostels_is_active").on(table.is_active),
	}),
);

/* Batches - Graduation years (2024, 2025, 2026, etc.) */
export const batches = pgTable(
	"batches",
	{
		id: serial("id").primaryKey(),
		batch_year: integer("batch_year").notNull().unique(),
		display_name: varchar("display_name", { length: 50 }),
		is_active: boolean("is_active").default(true).notNull(),
		created_at: timestamp("created_at").defaultNow(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(table) => ({
		batchYearIdx: index("idx_batches_batch_year").on(table.batch_year),
		isActiveIdx: index("idx_batches_is_active").on(table.is_active),
	}),
);

/* Class Sections - Sections like A, B, C, AI-1, AI-2, etc. */
export const class_sections = pgTable(
	"class_sections",
	{
		id: serial("id").primaryKey(),
		name: varchar("name", { length: 20 }).notNull().unique(),
		is_active: boolean("is_active").default(true).notNull(),
		created_at: timestamp("created_at").defaultNow(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(table) => ({
		nameIdx: index("idx_class_sections_name").on(table.name),
		isActiveIdx: index("idx_class_sections_is_active").on(table.is_active),
	}),
);

/* ---------- STUDENTS (profile + rate-limits) ---------- */
export const students = pgTable(
	"students",
	{
		id: serial("id").primaryKey(),
		student_uid: uuid("student_uid").defaultRandom().notNull().unique(), // Stable internal identifier
		user_id: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(), // Required: every student must have a user
		roll_no: varchar("roll_no", { length: 32 }).notNull().unique(), // Required: roll number format xxbcsxxxxx
		room_no: varchar("room_no", { length: 16 }), // Optional: room number

		// Foreign keys to master tables (instead of hardcoded enums)
		hostel_id: integer("hostel_id").references(() => hostels.id), // FK to hostels table
		class_section_id: integer("class_section_id").references(() => class_sections.id), // FK to class_sections table
		batch_id: integer("batch_id").references(() => batches.id), // FK to batches table

		batch_year: integer("batch_year"), // Optional: batch year e.g., 2027
		department: varchar("department", { length: 120 }), // Optional: department

		// Status tracking
		active: boolean("active").default(true).notNull(), // Track active/inactive (graduated, expelled, temporarily inactive)

		// Sync tracking
		source: varchar("source", { length: 20 }).default("csv").notNull(), // Track data origin: 'csv' | 'manual' | 'api' | 'import'
		last_synced_at: timestamp("last_synced_at"), // Track when last updated via sync

		// Rate limiting
		tickets_this_week: integer("tickets_this_week").default(0).notNull(),
		last_ticket_date: timestamp("last_ticket_date"),

		created_at: timestamp("created_at").defaultNow(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(table) => ({
		userIdIdx: index("idx_students_user_id").on(table.user_id),
		rollNoIdx: index("idx_students_roll_no").on(table.roll_no),
		batchYearIdx: index("idx_students_batch_year").on(table.batch_year),
		hostelIdIdx: index("idx_students_hostel_id").on(table.hostel_id),
		batchIdIdx: index("idx_students_batch_id").on(table.batch_id),
		classSectionIdIdx: index("idx_students_class_section_id").on(table.class_section_id),
		activeIdx: index("idx_students_active").on(table.active),
		studentUidIdx: index("idx_students_student_uid").on(table.student_uid),
	}),
);

/* ---------- STUDENT PROFILE FIELD DEFINITIONS (SuperAdmin-controlled) ---------- */
// Defines which fields exist in student profiles and their editability
export const student_profile_fields = pgTable(
	"student_profile_fields",
	{
		id: serial("id").primaryKey(),
		field_name: varchar("field_name", { length: 64 }).notNull().unique(), // e.g., 'mobile', 'blood_group'
		field_label: varchar("field_label", { length: 128 }).notNull(), // Display name
		field_type: varchar("field_type", { length: 32 }).notNull(), // 'text', 'number', 'email', 'select'
		is_required: boolean("is_required").default(false).notNull(),
		is_editable_by_student: boolean("is_editable_by_student").default(false).notNull(),
		is_system_field: boolean("is_system_field").default(false).notNull(), // Cannot be deleted (roll_no, email, etc.)
		display_order: integer("display_order").default(0).notNull(),
		validation_rules: jsonb("validation_rules"), // JSON: { min, max, pattern, options: [] }
		default_value: text("default_value"),
		help_text: text("help_text"),
		created_at: timestamp("created_at").defaultNow(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(table) => ({
		fieldNameIdx: index("idx_profile_fields_name").on(table.field_name),
		displayOrderIdx: index("idx_profile_fields_order").on(table.display_order),
	}),
);

/* ---------- STAFF (admins/super_admins/SPOCs) ---------- */
// IMPORTANT: Staff role comes from user_roles table via user_id FK
// There is NO separate role field here - roles are unified in the user_roles table
export const staff = pgTable(
	"staff",
	{
		id: serial("id").primaryKey(),
		user_id: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(), // FK to users - staff identity is bound to users
		// @deprecated Legacy field - kept for backward compatibility during migration
		// Use user_id → users.clerk_id instead
		// Made nullable to allow graceful removal later
		clerk_user_id: varchar("clerk_user_id", { length: 255 }).unique(),
		full_name: varchar("full_name", { length: 120 }).notNull(),
		email: varchar("email", { length: 256 }),
		slack_user_id: varchar("slack_user_id", { length: 128 }),
		phone: varchar("phone", { length: 30 }),
		domain: varchar("domain", { length: 64 }).notNull(), // 'Hostel' | 'College'
		scope: varchar("scope", { length: 128 }), // e.g., 'Neeladri', 'Velankani', or specific department
		created_at: timestamp("created_at").defaultNow(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(table) => ({
		userIdIdx: index("idx_staff_user_id").on(table.user_id),
		clerkUserIdIdx: index("idx_staff_clerk_user_id").on(table.clerk_user_id), // Legacy index
		domainScopeIdx: index("idx_staff_domain_scope").on(table.domain, table.scope),
		domainIdx: index("idx_staff_domain").on(table.domain),
	}),
);

/* ---------- ESCALATION RULES (ordered chain) ---------- */
export const escalation_rules = pgTable(
	"escalation_rules",
	{
		id: serial("id").primaryKey(),
		domain: varchar("domain", { length: 64 }).notNull(), // Hostel | College
		scope: varchar("scope", { length: 128 }), // e.g., Neeladri or null for all
		level: integer("level").notNull(), // 1,2,3... escalation level
		staff_id: integer("staff_id").references(() => staff.id), // Staff member to escalate to
		notify_channel: varchar("notify_channel", { length: 32 }).default("slack").notNull(), // slack|email
		created_at: timestamp("created_at").defaultNow(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(table) => ({
		domainScopeLevelIdx: index("idx_escalation_rules_domain_scope_level").on(
			table.domain,
			table.scope,
			table.level,
		),
		domainLevelIdx: index("idx_escalation_rules_domain_level").on(table.domain, table.level),
		uniqueRule: unique("unique_escalation_rule").on(table.domain, table.scope, table.level),
	}),
);

/* ---------- COMMITTEES & MEMBERS ---------- */
export const committees = pgTable(
	"committees",
	{
		id: serial("id").primaryKey(),
		name: varchar("name", { length: 140 }).notNull().unique(),
		description: text("description"),
		contact_email: varchar("contact_email", { length: 256 }), // Primary contact email for the committee
		created_at: timestamp("created_at").defaultNow(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(table) => ({
		nameIdx: index("idx_committees_name").on(table.name),
	}),
);

export const committee_members = pgTable(
	"committee_members",
	{
		id: serial("id").primaryKey(),
		committee_id: integer("committee_id")
			.references(() => committees.id, { onDelete: "cascade" })
			.notNull(),
		user_id: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(), // FK to users - unified identity
		role: varchar("role", { length: 64 }), // 'chair', 'member', etc. (committee-specific role, not app role)
		created_at: timestamp("created_at").defaultNow(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(table) => ({
		committeeIdx: index("idx_committee_members_committee_id").on(table.committee_id),
		userIdIdx: index("idx_committee_members_user_id").on(table.user_id),
		uniqueMember: unique("unique_committee_member").on(table.committee_id, table.user_id),
	}),
);

/* ---------- CATEGORIES (hierarchical, POC, committee) ---------- */
// @ts-expect-error - Self-reference in parent_category_id causes circular type inference
export const categories = pgTable("categories", {
	id: serial("id").primaryKey(),
	name: varchar("name", { length: 140 }).notNull(),
	slug: varchar("slug", { length: 140 }).notNull().unique(),
	description: text("description"),
	icon: varchar("icon", { length: 64 }), // Icon name (e.g., "home", "wifi", "utensils")
	color: varchar("color", { length: 20 }), // Color hex or name (e.g., "#3B82F6", "blue")
	sla_hours: integer("sla_hours").default(48).notNull(),
	default_authority: integer("default_authority").references(() => staff.id), // Default staff SPOC for this category
	poc_name: varchar("poc_name", { length: 120 }),
	poc_slack_id: varchar("poc_slack_id", { length: 128 }),
	committee_id: integer("committee_id").references(() => committees.id),
	// @ts-expect-error - Self-reference causes circular type inference
	parent_category_id: integer("parent_category_id").references(() => categories.id),
	active: boolean("active").default(true).notNull(),
	display_order: integer("display_order").default(0).notNull(), // For ordering in UI
	created_at: timestamp("created_at").defaultNow(),
	updated_at: timestamp("updated_at").defaultNow(),
},
	(table) => ({
		slugIdx: index("idx_categories_slug").on(table.slug),
		parentIdx: index("idx_categories_parent_category_id").on(table.parent_category_id),
		activeIdx: index("idx_categories_active").on(table.active),
		// Temporarily commented out - index already exists in DB, but Drizzle cache issue
		// defaultAuthorityIdx: index("idx_categories_default_authority").on(table.default_authority),
		displayOrderIdx: index("idx_categories_display_order").on(table.display_order),
	}),
);

/* ---------- CATEGORY PROFILE FIELDS (Configure which profile fields to collect per category) ---------- */
export const category_profile_fields = pgTable("category_profile_fields", {
	id: serial("id").primaryKey(),
	category_id: integer("category_id").references(() => categories.id, { onDelete: "cascade" }).notNull(),
	field_name: varchar("field_name", { length: 64 }).notNull(), // "rollNo", "name", "email", "phone", "hostel", "roomNumber", "batchYear", "classSection"
	required: boolean("required").default(false).notNull(), // Whether this field is required for tickets in this category
	editable: boolean("editable").default(true).notNull(), // Whether this field can be edited when creating a ticket
	display_order: integer("display_order").default(0).notNull(), // Order in which fields appear
	created_at: timestamp("created_at").defaultNow(),
	updated_at: timestamp("updated_at").defaultNow(),
},
	(table) => ({
		categoryIdx: index("idx_category_profile_fields_category_id").on(table.category_id),
		fieldNameIdx: index("idx_category_profile_fields_field_name").on(table.field_name),
		uniqueCategoryField: unique("unique_category_profile_field").on(table.category_id, table.field_name),
		displayOrderIdx: index("idx_category_profile_fields_display_order").on(table.display_order),
	}),
);

/* ---------- SUBCATEGORIES (Dynamic subcategories for categories) ---------- */
export const subcategories = pgTable("subcategories", {
	id: serial("id").primaryKey(),
	category_id: integer("category_id").references(() => categories.id, { onDelete: "cascade" }).notNull(),
	name: varchar("name", { length: 140 }).notNull(),
	slug: varchar("slug", { length: 140 }).notNull(),
	description: text("description"),
	assigned_admin_id: integer("assigned_admin_id").references(() => staff.id), // Inline admin assignment (overrides category default)
	active: boolean("active").default(true).notNull(),
	display_order: integer("display_order").default(0).notNull(),
	created_at: timestamp("created_at").defaultNow(),
	updated_at: timestamp("updated_at").defaultNow(),
},
	(table) => ({
		categoryIdx: index("idx_subcategories_category_id").on(table.category_id),
		slugIdx: index("idx_subcategories_slug").on(table.slug),
		activeIdx: index("idx_subcategories_active").on(table.active),
		displayOrderIdx: index("idx_subcategories_display_order").on(table.display_order),
		// Temporarily commented out - index already exists in DB, but Drizzle cache issue
		// assignedAdminIdx: index("idx_subcategories_assigned_admin_id").on(table.assigned_admin_id),
		uniqueCategorySlug: unique("unique_subcategory_category_slug").on(table.category_id, table.slug),
	}),
);

/* ---------- SUB-SUBCATEGORIES (Nested subcategories, e.g., Food > Complaint Category > Food Quality) ---------- */
export const sub_subcategories = pgTable("sub_subcategories", {
	id: serial("id").primaryKey(),
	subcategory_id: integer("subcategory_id").references(() => subcategories.id, { onDelete: "cascade" }).notNull(),
	name: varchar("name", { length: 140 }).notNull(),
	slug: varchar("slug", { length: 140 }).notNull(),
	description: text("description"),
	active: boolean("active").default(true).notNull(),
	display_order: integer("display_order").default(0).notNull(),
	created_at: timestamp("created_at").defaultNow(),
	updated_at: timestamp("updated_at").defaultNow(),
},
	(table) => ({
		subcategoryIdx: index("idx_sub_subcategories_subcategory_id").on(table.subcategory_id),
		slugIdx: index("idx_sub_subcategories_slug").on(table.slug),
		activeIdx: index("idx_sub_subcategories_active").on(table.active),
		displayOrderIdx: index("idx_sub_subcategories_display_order").on(table.display_order),
		uniqueSubcategorySlug: unique("unique_sub_subcategory_subcategory_slug").on(table.subcategory_id, table.slug),
	}),
);

/* ---------- CATEGORY FIELDS (Dynamic form fields for subcategories) ---------- */
export const category_fields = pgTable("category_fields", {
	id: serial("id").primaryKey(),
	subcategory_id: integer("subcategory_id").references(() => subcategories.id, { onDelete: "cascade" }).notNull(),
	name: varchar("name", { length: 140 }).notNull(), // Field label (e.g., "Vendor", "Date", "Room Type")
	slug: varchar("slug", { length: 140 }).notNull(), // Field identifier (e.g., "vendor", "date", "room_type")
	field_type: varchar("field_type", { length: 50 }).notNull(), // "text", "select", "date", "number", "boolean", "upload", "textarea"
	required: boolean("required").default(false).notNull(),
	placeholder: varchar("placeholder", { length: 255 }),
	help_text: text("help_text"), // Helper text shown below the field
	validation_rules: jsonb("validation_rules"), // JSON: { min: 0, max: 100, pattern: "...", etc. }
	assigned_admin_id: integer("assigned_admin_id").references(() => staff.id), // Inline admin assignment (overrides subcategory/category default)
	display_order: integer("display_order").default(0).notNull(),
	active: boolean("active").default(true).notNull(),
	created_at: timestamp("created_at").defaultNow(),
	updated_at: timestamp("updated_at").defaultNow(),
},
	(table) => ({
		subcategoryIdx: index("idx_category_fields_subcategory_id").on(table.subcategory_id),
		slugIdx: index("idx_category_fields_slug").on(table.slug),
		activeIdx: index("idx_category_fields_active").on(table.active),
		displayOrderIdx: index("idx_category_fields_display_order").on(table.display_order),
		// Temporarily commented out - index already exists in DB, but Drizzle cache issue
		// assignedAdminIdx: index("idx_category_fields_assigned_admin_id").on(table.assigned_admin_id),
		uniqueSubcategorySlug: unique("unique_category_field_subcategory_slug").on(table.subcategory_id, table.slug),
	}),
);

/* ---------- FIELD OPTIONS (Options for select/dropdown fields) ---------- */
export const field_options = pgTable("field_options", {
	id: serial("id").primaryKey(),
	field_id: integer("field_id").references(() => category_fields.id, { onDelete: "cascade" }).notNull(),
	label: varchar("label", { length: 255 }).notNull(), // Display label
	value: varchar("value", { length: 255 }).notNull(), // Option value
	display_order: integer("display_order").default(0).notNull(),
	active: boolean("active").default(true).notNull(),
	created_at: timestamp("created_at").defaultNow(),
},
	(table) => ({
		fieldIdx: index("idx_field_options_field_id").on(table.field_id),
		displayOrderIdx: index("idx_field_options_display_order").on(table.display_order),
		activeIdx: index("idx_field_options_active").on(table.active),
	}),
);

/* ---------- TICKET GROUPS (for admin bulk operations) ---------- */
export const ticket_groups = pgTable(
	"ticket_groups",
	{
		id: serial("id").primaryKey(),
		name: varchar("name", { length: 255 }).notNull(),
		description: text("description"),
		created_by: uuid("created_by").references(() => users.id, { onDelete: "set null" }).notNull(),
		created_at: timestamp("created_at").defaultNow(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(table) => ({
		createdByIdx: index("idx_ticket_groups_created_by").on(table.created_by),
		createdAtIdx: index("idx_ticket_groups_created_at").on(table.created_at),
	}),
);

/* ---------- TICKETS (production-ready, PRD v3.0) ---------- */
export const tickets = pgTable(
	"tickets",
	{
		id: serial("id").primaryKey(),

		// Core ticket information (authoritative)
		title: varchar("title", { length: 255 }), // Optional: can be derived from description
		description: text("description"), // Ticket description
		location: varchar("location", { length: 255 }), // Location (hostel name, room, etc.)

		// Status
		status: ticketStatus("status").default("OPEN").notNull(),

		// Relationships (authoritative)
		category_id: integer("category_id").references(() => categories.id), // FK to categories table (authoritative)
		created_by: uuid("created_by").references(() => users.id, { onDelete: "set null" }).notNull(), // FK to users table (authoritative - replaces user_number)
		assigned_to: integer("assigned_to").references(() => staff.id), // FK to staff table (assigned SPOC/admin)
		acknowledged_by: integer("acknowledged_by").references(() => staff.id), // FK to staff table (who acknowledged)
		group_id: integer("group_id").references(() => ticket_groups.id, { onDelete: "set null" }), // FK to ticket_groups (nullable)

		// Escalation tracking
		escalation_level: integer("escalation_level").default(0).notNull(), // Current escalation level
		tat_extended_count: integer("tat_extended_count").default(0).notNull(), // PRD v3.0 - auto-escalate after 3 extensions
		last_escalation_at: timestamp("last_escalation_at"), // Last escalation timestamp

		// TAT (Turnaround Time)
		due_at: timestamp("due_at"), // TAT due date
		acknowledgement_tat: varchar("acknowledgement_tat", { length: 50 }), // Acknowledgement TAT text
		acknowledged_at: timestamp("acknowledged_at"), // When ticket was acknowledged
		reopened_at: timestamp("reopened_at"), // When ticket was reopened (PRD v3.0)
		sla_breached_at: timestamp("sla_breached_at"), // When SLA was breached (for reporting and escalation analytics)

		// Rating and feedback
		rating: integer("rating"), // Rating 1-5 (stored as integer)
		rating_submitted: timestamp("rating_submitted"), // When rating was submitted
		feedback: text("feedback"), // Student feedback text

		// Visibility and links
		is_public: boolean("is_public").default(false).notNull(), // Public visibility flag
		admin_link: varchar("admin_link", { length: 512 }),
		student_link: varchar("student_link", { length: 512 }),

		// External integrations
		slack_thread_id: varchar("slack_thread_id", { length: 255 }), // Slack thread ID for this ticket
		external_ref: varchar("external_ref", { length: 64 }).unique(), // Optional external reference ID

		// Metadata and attachments (JSONB for better performance)
		metadata: jsonb("metadata"), // Structured metadata (TAT extensions, email threading, browser info, etc.) - AUTHORITATIVE
		attachments: jsonb("attachments"), // Array of attachment objects {url, storage_key, mime, size} - AUTHORITATIVE

		// ⚠️ LEGACY FIELDS (deprecated, for backward compatibility only - non-authoritative)
		// These fields are kept for backward compatibility but should NOT be used in new code
		// Migration path:
		// - user_number → use created_by → users.id instead
		// - category → use category_id instead
		// - subcategory → store in metadata or categories table
		// - details → use metadata (JSONB) instead
		// Made nullable to allow graceful migration without blocking forward progress
		user_number: varchar("user_number", { length: 64 }), // @deprecated Use created_by → users.id instead
		category: varchar("category", { length: 64 }), // @deprecated Use category_id instead
		subcategory: varchar("subcategory", { length: 140 }), // @deprecated Store in metadata or categories table
		details: text("details"), // @deprecated Use metadata (JSONB) instead - Legacy JSON string

		// Timestamps
		created_at: timestamp("created_at").defaultNow().notNull(),
		updated_at: timestamp("updated_at").defaultNow().notNull(),
		resolved_at: timestamp("resolved_at"), // When ticket was resolved
	},
	(table) => ({
		statusIdx: index("idx_tickets_status").on(table.status),
		categoryIdIdx: index("idx_tickets_category_id").on(table.category_id), // Authoritative index
		categoryIdx: index("idx_tickets_category").on(table.category), // Legacy index
		assignedToIdx: index("idx_tickets_assigned_to").on(table.assigned_to),
		createdByIdx: index("idx_tickets_created_by").on(table.created_by), // Authoritative index
		userNumberIdx: index("idx_tickets_user_number").on(table.user_number), // Legacy index
		createdAtIdx: index("idx_tickets_created_at").on(table.created_at),
		groupIdIdx: index("idx_tickets_group_id").on(table.group_id),
		escalationLevelIdx: index("idx_tickets_escalation_level").on(table.escalation_level),
		statusCreatedIdx: index("idx_tickets_status_created").on(table.status, table.created_at),
		// JSONB indexes for metadata queries
		metadataIdx: index("idx_tickets_metadata").using("gin", table.metadata),
		// NOTE: Partial index for open tickets should be created manually via migration:
		// CREATE INDEX idx_tickets_open ON tickets(created_at) WHERE status != 'RESOLVED';
		// This provides massive speedup for common query: WHERE status != 'RESOLVED' ORDER BY created_at DESC
	}),
);

/* ---------- TICKET COMMITTEE TAGS (for admin tagging) ---------- */
export const ticket_committee_tags = pgTable(
	"ticket_committee_tags",
	{
		id: serial("id").primaryKey(),
		ticket_id: integer("ticket_id").references(() => tickets.id, { onDelete: "cascade" }).notNull(),
		committee_id: integer("committee_id").references(() => committees.id, { onDelete: "cascade" }).notNull(),
		tagged_by: uuid("tagged_by").references(() => users.id, { onDelete: "set null" }).notNull(), // Admin who tagged this ticket
		reason: text("reason"), // Optional reason for tagging
		created_at: timestamp("created_at").defaultNow(),
	},
	(table) => ({
		ticketIdx: index("idx_ticket_committee_tags_ticket_id").on(table.ticket_id),
		committeeIdx: index("idx_ticket_committee_tags_committee_id").on(table.committee_id),
		taggedByIdx: index("idx_ticket_committee_tags_tagged_by").on(table.tagged_by),
		uniqueTicketCommittee: unique("unique_ticket_committee_tag").on(table.ticket_id, table.committee_id),
	}),
);

/* ---------- COMMENTS ---------- */
export const comments = pgTable(
	"comments",
	{
		id: serial("id").primaryKey(),
		ticket_id: integer("ticket_id").references(() => tickets.id, { onDelete: "cascade" }).notNull(),
		author_id: uuid("author_id").references(() => users.id, { onDelete: "set null" }).notNull(),
		body: text("body").notNull(),
		comment_type: varchar("comment_type", { length: 32 }).default("student_visible").notNull(), // 'student_visible' | 'internal_note' | 'super_admin_note'
		is_internal: boolean("is_internal").default(false).notNull(),
		slack_message_id: varchar("slack_message_id", { length: 255 }),
		created_at: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => ({
		ticketIdx: index("idx_comments_ticket_id").on(table.ticket_id),
		authorIdx: index("idx_comments_author_id").on(table.author_id),
		ticketCreatedIdx: index("idx_comments_ticket_created").on(table.ticket_id, table.created_at),
	}),
);

/* ---------- ESCALATIONS (history) ---------- */
export const escalations = pgTable(
	"escalations",
	{
		id: serial("id").primaryKey(),
		ticket_id: integer("ticket_id").references(() => tickets.id, { onDelete: "cascade" }).notNull(),
		escalated_by: uuid("escalated_by").references(() => users.id, { onDelete: "set null" }), // User who escalated (student or admin)
		escalated_to: integer("escalated_to").references(() => staff.id), // Staff member escalated to
		reason: text("reason"), // Reason for escalation
		level: integer("level").default(1).notNull(), // Escalation level
		created_at: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => ({
		ticketIdx: index("idx_escalations_ticket_id").on(table.ticket_id),
		levelIdx: index("idx_escalations_level").on(table.level),
		ticketLevelIdx: index("idx_escalations_ticket_level").on(table.ticket_id, table.level),
	}),
);

/* ---------- NOTIFICATIONS ---------- */
export const notifications = pgTable(
	"notifications",
	{
		id: serial("id").primaryKey(),
		user_id: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
		ticket_id: integer("ticket_id").references(() => tickets.id, { onDelete: "cascade" }),
		channel: varchar("channel", { length: 32 }).notNull(), // 'email' | 'slack' | 'in_app'
		payload: jsonb("payload"), // Raw payload for debugging (JSONB for better performance)
		status: varchar("status", { length: 32 }).default("pending").notNull(), // 'pending' | 'sent' | 'failed'
		slack_message_id: varchar("slack_message_id", { length: 255 }),
		email_message_id: varchar("email_message_id", { length: 255 }),
		attempt_count: integer("attempt_count").default(0).notNull(),
		created_at: timestamp("created_at").defaultNow().notNull(),
		sent_at: timestamp("sent_at"),
	},
	(table) => ({
		userIdx: index("idx_notifications_user_id").on(table.user_id),
		ticketIdx: index("idx_notifications_ticket_id").on(table.ticket_id),
		statusIdx: index("idx_notifications_status").on(table.status),
		userStatusIdx: index("idx_notifications_user_status").on(table.user_id, table.status),
	}),
);

/* ---------- ACTIVITY LOGS (audit trail) ---------- */
export const activity_logs = pgTable(
	"activity_logs",
	{
		id: serial("id").primaryKey(),
		ticket_id: integer("ticket_id").references(() => tickets.id, { onDelete: "cascade" }),
		user_id: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
		action: varchar("action", { length: 80 }).notNull(), // 'create_ticket', 'assign', 'status_change', 'escalate', 'reopen', etc.
		details: jsonb("details"), // Old/new values, extra context (JSONB for better performance)
		created_at: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => ({
		ticketIdx: index("idx_activity_logs_ticket_id").on(table.ticket_id),
		userIdx: index("idx_activity_logs_user_id").on(table.user_id),
		ticketCreatedIdx: index("idx_activity_logs_ticket_created").on(table.ticket_id, table.created_at),
	}),
);

/* ---------- OUTBOX ---------- */
export const outbox = pgTable("outbox", {
	id: serial("id").primaryKey(),
	event_type: text("event_type").notNull(),
	payload: jsonb("payload").$type<any>().notNull(),
	attempts: integer("attempts").default(0).notNull(),
	next_retry_at: timestamp("next_retry_at", { mode: "date" }),
	processed_at: timestamp("processed_at", { mode: "date" }),
	created_at: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

/* ---------- DELETED FIELDS ARCHIVE (snapshot on delete) ---------- */
export const deleted_category_fields = pgTable("deleted_category_fields", {
	id: serial("id").primaryKey(),
	original_field_id: integer("original_field_id").notNull().unique(), // Original field ID from category_fields
	field_data: jsonb("field_data").notNull(), // Complete field definition
	options_data: jsonb("options_data"), // All options if field_type was 'select'
	deleted_by: uuid("deleted_by").references(() => users.id).notNull(),
	deleted_at: timestamp("deleted_at").defaultNow().notNull(),
	deletion_reason: text("deletion_reason"), // Optional: why was it deleted
	ticket_count: integer("ticket_count").default(0), // How many tickets used this field
}, (table) => ({
	fieldIdIdx: index("idx_deleted_fields_original_id").on(table.original_field_id),
	deletedAtIdx: index("idx_deleted_fields_deleted_at").on(table.deleted_at),
	deletedByIdx: index("idx_deleted_fields_deleted_by").on(table.deleted_by),
}));

/* ---------- CATEGORY ASSIGNMENTS (Many-to-Many: Categories ↔ Staff) ---------- */
export const category_assignments = pgTable(
	"category_assignments",
	{
		id: serial("id").primaryKey(),
		category_id: integer("category_id")
			.references(() => categories.id, { onDelete: "cascade" })
			.notNull(),
		staff_id: integer("staff_id")
			.references(() => staff.id, { onDelete: "cascade" })
			.notNull(),
		is_primary: boolean("is_primary").default(false).notNull(), // Primary admin for this category
		priority: integer("priority").default(0).notNull(), // Higher = more priority for assignment
		created_at: timestamp("created_at").defaultNow(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(table) => ({
		categoryIdx: index("idx_category_assignments_category").on(table.category_id),
		staffIdx: index("idx_category_assignments_staff").on(table.staff_id),
		primaryIdx: index("idx_category_assignments_primary").on(
			table.category_id,
			table.is_primary
		),
		uniqueAssignment: unique("unique_category_staff").on(
			table.category_id,
			table.staff_id
		),
	})
);

/* ---------- AUDIT LOG (optional, for compliance) ---------- */
export const audit_log = pgTable("audit_log", {
	id: serial("id").primaryKey(),
	table_name: varchar("table_name", { length: 100 }).notNull(),
	record_id: integer("record_id").notNull(),
	action: varchar("action", { length: 20 }).notNull(), // 'created', 'updated', 'deleted'
	old_data: jsonb("old_data"),
	new_data: jsonb("new_data"),
	performed_by: uuid("performed_by").references(() => users.id),
	performed_at: timestamp("performed_at").defaultNow().notNull(),
	ip_address: varchar("ip_address", { length: 45 }),
	user_agent: text("user_agent"),
}, (table) => ({
	tableRecordIdx: index("idx_audit_log_table_record").on(table.table_name, table.record_id),
	performedByIdx: index("idx_audit_log_performed_by").on(table.performed_by),
	performedAtIdx: index("idx_audit_log_performed_at").on(table.performed_at),
	actionIdx: index("idx_audit_log_action").on(table.action),
}));



/* ---------- NOTIFICATION SETTINGS (Singleton configuration) ---------- */
export const notification_settings = pgTable("notification_settings", {
	id: serial("id").primaryKey(),
	// Toggles
	slack_enabled: boolean("slack_enabled").default(true).notNull(),
	email_enabled: boolean("email_enabled").default(true).notNull(),
	tat_reminders_enabled: boolean("tat_reminders_enabled").default(true).notNull(),
	committee_notifications_enabled: boolean("committee_notifications_enabled").default(true).notNull(),

	// Slack Channel Configuration (JSONB for flexibility)
	// Structure: { "Hostel": "#tickets-hostel", "College": "#tickets-college", ... }
	slack_config: jsonb("slack_config").default({}).notNull(),

	updated_by: uuid("updated_by").references(() => users.id),
	updated_at: timestamp("updated_at").defaultNow(),
});
