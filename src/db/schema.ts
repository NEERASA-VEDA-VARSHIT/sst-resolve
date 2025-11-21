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

/* -------------------------------------------------------------------------- */
/* ENUMS                                                                      */
/* -------------------------------------------------------------------------- */

// Actor type (how the system sees this user)
export const userTypeEnum = pgEnum("user_type", [
	"human",  // normal users (students, admins, etc.)
	"system", // backend jobs, workers
	"bot",    // chatbots, integrations
]);

/* -------------------------------------------------------------------------- */
/* ROLES (business roles: student, admin, super_admin, committee_head, ...)   */
/* -------------------------------------------------------------------------- */

export const roles = pgTable(
	"roles",
	{
		id: serial("id").primaryKey(),
		name: varchar("name", { length: 64 }).notNull().unique(),
		// Example values: 'student', 'admin', 'super_admin', 'committee_head'
		description: text("description"),
		created_at: timestamp("created_at").defaultNow(),
	},
	(table) => ({
		nameIdx: index("idx_roles_name").on(table.name),
	}),
);

/* -------------------------------------------------------------------------- */
/* DOMAINS & SCOPES (operational routing layer)                               */
/* -------------------------------------------------------------------------- */

export const domains = pgTable(
	"domains",
	{
		id: serial("id").primaryKey(),
		name: varchar("name", { length: 120 }).notNull().unique(), // Hostel, Mess, College, General, Global...
		description: text("description"),
		is_active: boolean("is_active").default(true).notNull(),
		created_at: timestamp("created_at").defaultNow(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(table) => ({
		nameIdx: index("idx_domains_name").on(table.name),
		activeIdx: index("idx_domains_is_active").on(table.is_active),
	}),
);

export const scopes = pgTable(
	"scopes",
	{
		id: serial("id").primaryKey(),
		domain_id: integer("domain_id")
			.references(() => domains.id, { onDelete: "cascade" })
			.notNull(),
		name: varchar("name", { length: 120 }).notNull(), // Neeladri, Velankani, etc.
		description: text("description"),
		is_active: boolean("is_active").default(true).notNull(),
		created_at: timestamp("created_at").defaultNow(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(table) => ({
		domainIdx: index("idx_scopes_domain_id").on(table.domain_id),
		nameIdx: index("idx_scopes_name").on(table.name),
		activeIdx: index("idx_scopes_is_active").on(table.is_active),
		uniqueDomainScope: unique("unique_domain_scope").on(
			table.domain_id,
			table.name,
		),
	}),
);

/* -------------------------------------------------------------------------- */
/* USERS (auth identity + business role + actor type + home domain/scope)     */
/* -------------------------------------------------------------------------- */

export const users = pgTable(
	"users",
	{
		id: uuid("id").defaultRandom().primaryKey(),

		// Auth from Clerk
		clerk_id: varchar("clerk_id", { length: 255 }).notNull().unique(),

		// Identifiers
		email: varchar("email", { length: 256 }).notNull().unique(),
		phone: varchar("phone", { length: 30 }),

		// Names
		first_name: varchar("first_name", { length: 120 }),
		last_name: varchar("last_name", { length: 120 }),

		avatar_url: varchar("avatar_url", { length: 512 }),

		// Business role
		role_id: integer("role_id")
			.references(() => roles.id)
			.notNull(),

		// Actor type
		user_type: userTypeEnum("user_type").default("human").notNull(),

		// Home base for admins/committee (primary domain/scope)
		primary_domain_id: integer("primary_domain_id").references(
			() => domains.id,
		),
		primary_scope_id: integer("primary_scope_id").references(() => scopes.id),

		// Slack integration (for admins)
		slack_user_id: varchar("slack_user_id", { length: 128 }),

		created_at: timestamp("created_at").defaultNow(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(table) => ({
		clerkIdIdx: index("idx_users_clerk_id").on(table.clerk_id),
		emailIdx: index("idx_users_email").on(table.email),
		roleIdx: index("idx_users_role_id").on(table.role_id),
		userTypeIdx: index("idx_users_user_type").on(table.user_type),
		primaryDomainIdx: index("idx_users_primary_domain_id").on(
			table.primary_domain_id,
		),
	}),
);

/* -------------------------------------------------------------------------- */
/* ADMIN ASSIGNMENTS (extra domains/scopes for admins)                        */
/* -------------------------------------------------------------------------- */

export const admin_assignments = pgTable(
	"admin_assignments",
	{
		id: serial("id").primaryKey(),

		user_id: uuid("user_id")
			.references(() => users.id, { onDelete: "cascade" })
			.notNull(),

		domain_id: integer("domain_id")
			.references(() => domains.id, { onDelete: "cascade" })
			.notNull(),

		scope_id: integer("scope_id").references(() => scopes.id),

		created_at: timestamp("created_at").defaultNow(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(table) => ({
		userIdx: index("idx_admin_assignments_user_id").on(table.user_id),
		domainIdx: index("idx_admin_assignments_domain_id").on(table.domain_id),
		uniqueAssignment: unique("unique_admin_assignment").on(
			table.user_id,
			table.domain_id,
			table.scope_id,
		),
	}),
);

/* -------------------------------------------------------------------------- */
/* MASTER DATA: HOSTELS / BATCHES / CLASS SECTIONS                            */
/* -------------------------------------------------------------------------- */

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

export const batches = pgTable(
	"batches",
	{
		id: serial("id").primaryKey(),
		batch_year: integer("batch_year").notNull().unique(), // 2024, 2025...
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

export const class_sections = pgTable(
	"class_sections",
	{
		id: serial("id").primaryKey(),
		name: varchar("name", { length: 20 }).notNull().unique(), // A, B, AI-1...
		is_active: boolean("is_active").default(true).notNull(),
		created_at: timestamp("created_at").defaultNow(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(table) => ({
		nameIdx: index("idx_class_sections_name").on(table.name),
		isActiveIdx: index("idx_class_sections_is_active").on(table.is_active),
	}),
);

/* -------------------------------------------------------------------------- */
/* STUDENTS                                                                   */
/* -------------------------------------------------------------------------- */

export const students = pgTable(
	"students",
	{
		id: serial("id").primaryKey(),
		student_uid: uuid("student_uid").defaultRandom().notNull().unique(),

		user_id: uuid("user_id")
			.references(() => users.id, { onDelete: "cascade" })
			.notNull()
			.unique(),

		roll_no: varchar("roll_no", { length: 32 }).notNull().unique(),
		room_no: varchar("room_no", { length: 16 }),

		hostel_id: integer("hostel_id").references(() => hostels.id),
		class_section_id: integer("class_section_id").references(
			() => class_sections.id,
		),
		batch_id: integer("batch_id").references(() => batches.id),

		batch_year: integer("batch_year"),
		department: varchar("department", { length: 120 }),

		active: boolean("active").default(true).notNull(),

		source: varchar("source", { length: 20 }).default("csv").notNull(), // csv | manual | api | import
		last_synced_at: timestamp("last_synced_at"),

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
		classSectionIdx: index("idx_students_class_section_id").on(
			table.class_section_id,
		),
		activeIdx: index("idx_students_active").on(table.active),
		studentUidIdx: index("idx_students_student_uid").on(table.student_uid),
	}),
);

/* -------------------------------------------------------------------------- */
/* STUDENT PROFILE FIELDS & DATA                                              */
/* -------------------------------------------------------------------------- */

export const student_profile_fields = pgTable(
	"student_profile_fields",
	{
		id: serial("id").primaryKey(),
		field_name: varchar("field_name", { length: 64 }).notNull().unique(), // 'mobile', 'blood_group'
		field_label: varchar("field_label", { length: 128 }).notNull(),
		field_type: varchar("field_type", { length: 32 }).notNull(), // text | number | email | select | date | ...
		is_required: boolean("is_required").default(false).notNull(),
		is_editable_by_student: boolean("is_editable_by_student")
			.default(false)
			.notNull(),
		is_system_field: boolean("is_system_field").default(false).notNull(),
		display_order: integer("display_order").default(0).notNull(),
		validation_rules: jsonb("validation_rules"),
		default_value: text("default_value"),
		help_text: text("help_text"),
		created_at: timestamp("created_at").defaultNow(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(table) => ({
		fieldNameIdx: index("idx_profile_fields_name").on(table.field_name),
		displayOrderIdx: index("idx_profile_fields_order").on(
			table.display_order,
		),
	}),
);

export const student_profile_data = pgTable(
	"student_profile_data",
	{
		id: serial("id").primaryKey(),
		student_id: integer("student_id")
			.references(() => students.id, { onDelete: "cascade" })
			.notNull(),
		field_id: integer("field_id")
			.references(() => student_profile_fields.id, { onDelete: "cascade" })
			.notNull(),
		value: text("value"),
		created_at: timestamp("created_at").defaultNow(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(table) => ({
		studentFieldIdx: index("idx_student_profile_data_student_field").on(
			table.student_id,
			table.field_id,
		),
		uniqueStudentField: unique("unique_student_profile_data").on(
			table.student_id,
			table.field_id,
		),
	}),
);

/* -------------------------------------------------------------------------- */
/* COMMITTEES & MEMBERS                                                       */
/* -------------------------------------------------------------------------- */

export const committees = pgTable(
	"committees",
	{
		id: serial("id").primaryKey(),
		name: varchar("name", { length: 140 }).notNull().unique(),
		description: text("description"),
		contact_email: varchar("contact_email", { length: 256 }),
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
		user_id: uuid("user_id")
			.references(() => users.id, { onDelete: "cascade" })
			.notNull(),
		role: varchar("role", { length: 64 }), // chair, member
		created_at: timestamp("created_at").defaultNow(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(table) => ({
		committeeIdx: index("idx_committee_members_committee_id").on(
			table.committee_id,
		),
		userIdx: index("idx_committee_members_user_id").on(table.user_id),
		uniqueMember: unique("unique_committee_member").on(
			table.committee_id,
			table.user_id,
		),
	}),
);

/* -------------------------------------------------------------------------- */
/* CATEGORIES (form hierarchy, mapped to domains/scopes)                      */
/* -------------------------------------------------------------------------- */
/*
  Assignment priority for tickets (for your service code):

  1. sub_subcategories.assigned_admin_id
  2. subcategories.assigned_admin_id
  3. category_fields.assigned_admin_id
  4. category_assignments (is_primary + priority)
  5. categories.default_admin_id
  6. domain/scope admins (primary + admin_assignments)
*/

export const categories = pgTable(
	"categories",
	{
		id: serial("id").primaryKey(),
		name: varchar("name", { length: 140 }).notNull(),
		slug: varchar("slug", { length: 140 }).notNull().unique(),
		description: text("description"),

		icon: varchar("icon", { length: 64 }),
		color: varchar("color", { length: 20 }),

		domain_id: integer("domain_id")
			.references(() => domains.id)
			.notNull(),
		scope_id: integer("scope_id").references(() => scopes.id),

		default_admin_id: uuid("default_admin_id").references(() => users.id),

		committee_id: integer("committee_id").references(() => committees.id),

		parent_category_id: integer("parent_category_id").references(
			(): any => categories.id,
		),

		sla_hours: integer("sla_hours").default(48).notNull(),
		active: boolean("active").default(true).notNull(),
		display_order: integer("display_order").default(0).notNull(),

		created_at: timestamp("created_at").defaultNow(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(table) => ({
		slugIdx: index("idx_categories_slug").on(table.slug),
		domainIdx: index("idx_categories_domain_id").on(table.domain_id),
		parentIdx: index("idx_categories_parent_category_id").on(
			table.parent_category_id,
		),
		activeIdx: index("idx_categories_active").on(table.active),
		displayOrderIdx: index("idx_categories_display_order").on(
			table.display_order,
		),
	}),
);

/* CATEGORY PROFILE FIELDS (which student fields to show for a category) */

export const category_profile_fields = pgTable(
	"category_profile_fields",
	{
		id: serial("id").primaryKey(),
		category_id: integer("category_id")
			.references(() => categories.id, { onDelete: "cascade" })
			.notNull(),
		field_name: varchar("field_name", { length: 64 }).notNull(),
		required: boolean("required").default(false).notNull(),
		editable: boolean("editable").default(true).notNull(),
		display_order: integer("display_order").default(0).notNull(),
		created_at: timestamp("created_at").defaultNow(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(table) => ({
		categoryIdx: index("idx_category_profile_fields_category_id").on(
			table.category_id,
		),
		fieldNameIdx: index("idx_category_profile_fields_field_name").on(
			table.field_name,
		),
		uniqueCategoryField: unique("unique_category_profile_field").on(
			table.category_id,
			table.field_name,
		),
		displayOrderIdx: index(
			"idx_category_profile_fields_display_order",
		).on(table.display_order),
	}),
);

/* SUBCATEGORIES */

export const subcategories = pgTable(
	"subcategories",
	{
		id: serial("id").primaryKey(),
		category_id: integer("category_id")
			.references(() => categories.id, { onDelete: "cascade" })
			.notNull(),
		name: varchar("name", { length: 140 }).notNull(),
		slug: varchar("slug", { length: 140 }).notNull(),
		description: text("description"),

		assigned_admin_id: uuid("assigned_admin_id").references(() => users.id),

		active: boolean("active").default(true).notNull(),
		display_order: integer("display_order").default(0).notNull(),

		created_at: timestamp("created_at").defaultNow(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(table) => ({
		categoryIdx: index("idx_subcategories_category_id").on(table.category_id),
		slugIdx: index("idx_subcategories_slug").on(table.slug),
		activeIdx: index("idx_subcategories_active").on(table.active),
		displayOrderIdx: index("idx_subcategories_display_order").on(
			table.display_order,
		),
		uniqueCategorySlug: unique("unique_subcategory_category_slug").on(
			table.category_id,
			table.slug,
		),
	}),
);

/* SUB-SUBCATEGORIES */

export const sub_subcategories = pgTable(
	"sub_subcategories",
	{
		id: serial("id").primaryKey(),
		subcategory_id: integer("subcategory_id")
			.references(() => subcategories.id, { onDelete: "cascade" })
			.notNull(),
		name: varchar("name", { length: 140 }).notNull(),
		slug: varchar("slug", { length: 140 }).notNull(),
		description: text("description"),

		assigned_admin_id: uuid("assigned_admin_id").references(() => users.id),

		active: boolean("active").default(true).notNull(),
		display_order: integer("display_order").default(0).notNull(),

		created_at: timestamp("created_at").defaultNow(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(table) => ({
		subcategoryIdx: index("idx_sub_subcategories_subcategory_id").on(
			table.subcategory_id,
		),
		slugIdx: index("idx_sub_subcategories_slug").on(table.slug),
		activeIdx: index("idx_sub_subcategories_active").on(table.active),
		displayOrderIdx: index("idx_sub_subcategories_display_order").on(
			table.display_order,
		),
		uniqueSubcategorySlug: unique(
			"unique_sub_subcategory_subcategory_slug",
		).on(table.subcategory_id, table.slug),
	}),
);

/* CATEGORY FIELDS (dynamic form fields per subcategory) */

export const category_fields = pgTable(
	"category_fields",
	{
		id: serial("id").primaryKey(),
		subcategory_id: integer("subcategory_id")
			.references(() => subcategories.id, { onDelete: "cascade" })
			.notNull(),
		name: varchar("name", { length: 140 }).notNull(),
		slug: varchar("slug", { length: 140 }).notNull(),
		field_type: varchar("field_type", { length: 50 }).notNull(), // text | select | date | number | boolean | upload | textarea
		required: boolean("required").default(false).notNull(),
		placeholder: varchar("placeholder", { length: 255 }),
		help_text: text("help_text"),
		validation_rules: jsonb("validation_rules"),
		assigned_admin_id: uuid("assigned_admin_id").references(() => users.id),
		display_order: integer("display_order").default(0).notNull(),
		active: boolean("active").default(true).notNull(),
		created_at: timestamp("created_at").defaultNow(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(table) => ({
		subcategoryIdx: index("idx_category_fields_subcategory_id").on(
			table.subcategory_id,
		),
		slugIdx: index("idx_category_fields_slug").on(table.slug),
		activeIdx: index("idx_category_fields_active").on(table.active),
		displayOrderIdx: index("idx_category_fields_display_order").on(
			table.display_order,
		),
		uniqueSubcategorySlug: unique(
			"unique_category_field_subcategory_slug",
		).on(table.subcategory_id, table.slug),
	}),
);

/* FIELD OPTIONS (for select/dropdown fields) */

export const field_options = pgTable(
	"field_options",
	{
		id: serial("id").primaryKey(),
		field_id: integer("field_id")
			.references(() => category_fields.id, { onDelete: "cascade" })
			.notNull(),
		label: varchar("label", { length: 255 }).notNull(),
		value: varchar("value", { length: 255 }).notNull(),
		display_order: integer("display_order").default(0).notNull(),
		active: boolean("active").default(true).notNull(),
		created_at: timestamp("created_at").defaultNow(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(table) => ({
		fieldIdx: index("idx_field_options_field_id").on(table.field_id),
		displayOrderIdx: index("idx_field_options_display_order").on(
			table.display_order,
		),
		activeIdx: index("idx_field_options_active").on(table.active),
	}),
);

/* ARCHIVE OF DELETED CATEGORY FIELDS */

export const deleted_category_fields = pgTable(
	"deleted_category_fields",
	{
		id: serial("id").primaryKey(),
		original_field_id: integer("original_field_id").notNull().unique(),
		field_data: jsonb("field_data").notNull(),
		options_data: jsonb("options_data"),
		deleted_by: uuid("deleted_by").references(() => users.id).notNull(),
		deleted_at: timestamp("deleted_at").defaultNow().notNull(),
		deletion_reason: text("deletion_reason"),
		ticket_count: integer("ticket_count").default(0),
	},
	(table) => ({
		fieldIdIdx: index("idx_deleted_fields_original_id").on(
			table.original_field_id,
		),
		deletedAtIdx: index("idx_deleted_fields_deleted_at").on(table.deleted_at),
		deletedByIdx: index("idx_deleted_fields_deleted_by").on(table.deleted_by),
	}),
);

/* -------------------------------------------------------------------------- */
/* CATEGORY ASSIGNMENTS (Many-to-Many: Categories ↔ Admin Users)              */
/* -------------------------------------------------------------------------- */

export const category_assignments = pgTable(
	"category_assignments",
	{
		id: serial("id").primaryKey(),
		category_id: integer("category_id")
			.references(() => categories.id, { onDelete: "cascade" })
			.notNull(),
		user_id: uuid("user_id")
			.references(() => users.id, { onDelete: "cascade" })
			.notNull(),
		is_primary: boolean("is_primary").default(false).notNull(),
		priority: integer("priority").default(0).notNull(),
		created_at: timestamp("created_at").defaultNow(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(table) => ({
		categoryIdx: index("idx_category_assignments_category").on(
			table.category_id,
		),
		userIdx: index("idx_category_assignments_user").on(table.user_id),
		primaryIdx: index("idx_category_assignments_primary").on(
			table.category_id,
			table.is_primary,
		),
		uniqueAssignment: unique("unique_category_user").on(
			table.category_id,
			table.user_id,
		),
	}),
);

/* -------------------------------------------------------------------------- */
/* TICKET STATUSES (dynamic, SuperAdmin-controlled)                           */
/* -------------------------------------------------------------------------- */

export const ticket_statuses = pgTable(
	"ticket_statuses",
	{
		id: serial("id").primaryKey(),
		value: varchar("value", { length: 50 }).notNull().unique(), // OPEN, IN_PROGRESS, ...
		label: varchar("label", { length: 100 }).notNull(), // Open, In Progress, ...
		description: text("description"),
		progress_percent: integer("progress_percent").default(0).notNull(),
		badge_color: varchar("badge_color", { length: 50 }).default("default"),
		is_active: boolean("is_active").default(true).notNull(),
		is_final: boolean("is_final").default(false).notNull(),
		display_order: integer("display_order").default(0).notNull(),
		created_at: timestamp("created_at").defaultNow(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(table) => ({
		valueIdx: index("idx_ticket_statuses_value").on(table.value),
		isActiveIdx: index("idx_ticket_statuses_is_active").on(table.is_active),
		displayOrderIdx: index("idx_ticket_statuses_display_order").on(
			table.display_order,
		),
	}),
);

/* -------------------------------------------------------------------------- */
/* TICKET GROUPS                                                              */
/* -------------------------------------------------------------------------- */

export const ticket_groups = pgTable(
	"ticket_groups",
	{
		id: serial("id").primaryKey(),
		name: varchar("name", { length: 255 }).notNull(),
		description: text("description"),
		created_by: uuid("created_by")
			.references(() => users.id, { onDelete: "set null" })
			.notNull(),
		created_at: timestamp("created_at").defaultNow(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(table) => ({
		createdByIdx: index("idx_ticket_groups_created_by").on(table.created_by),
		createdAtIdx: index("idx_ticket_groups_created_at").on(
			table.created_at,
		),
	}),
);

/* -------------------------------------------------------------------------- */
/* TICKETS                                                                    */
/* -------------------------------------------------------------------------- */

export const tickets = pgTable(
	"tickets",
	{
		id: serial("id").primaryKey(),

		title: varchar("title", { length: 255 }),
		description: text("description"),
		location: varchar("location", { length: 255 }),

		status_id: integer("status_id")
			.references(() => ticket_statuses.id)
			.notNull(),

		category_id: integer("category_id").references(() => categories.id),
		subcategory_id: integer("subcategory_id").references(
			() => subcategories.id,
		),
		sub_subcategory_id: integer("sub_subcategory_id").references(
			() => sub_subcategories.id,
		),

		created_by: uuid("created_by")
			.references(() => users.id, { onDelete: "set null" })
			.notNull(),

		assigned_to: uuid("assigned_to").references(() => users.id),
		acknowledged_by: uuid("acknowledged_by").references(() => users.id),
		group_id: integer("group_id").references(() => ticket_groups.id, {
			onDelete: "set null",
		}),

		escalation_level: integer("escalation_level").default(0).notNull(),
		tat_extended_count: integer("tat_extended_count").default(0).notNull(),
		last_escalation_at: timestamp("last_escalation_at"),

		acknowledgement_tat_hours: integer("acknowledgement_tat_hours"),
		resolution_tat_hours: integer("resolution_tat_hours"),

		acknowledgement_due_at: timestamp("acknowledgement_due_at"),
		resolution_due_at: timestamp("resolution_due_at"),

		acknowledged_at: timestamp("acknowledged_at"),
		reopened_at: timestamp("reopened_at"),
		sla_breached_at: timestamp("sla_breached_at"),

		reopen_count: integer("reopen_count").default(0).notNull(),

		rating: integer("rating"),
		feedback_type: varchar("feedback_type", { length: 20 }),
		rating_submitted: timestamp("rating_submitted"),
		feedback: text("feedback"),

		is_public: boolean("is_public").default(false).notNull(),
		admin_link: varchar("admin_link", { length: 512 }),
		student_link: varchar("student_link", { length: 512 }),

		slack_thread_id: varchar("slack_thread_id", { length: 255 }),
		external_ref: varchar("external_ref", { length: 64 }).unique(),

		metadata: jsonb("metadata"),

		created_at: timestamp("created_at").defaultNow().notNull(),
		updated_at: timestamp("updated_at").defaultNow().notNull(),
		resolved_at: timestamp("resolved_at"),
	},
	(table) => ({
		statusIdx: index("idx_tickets_status_id").on(table.status_id),
		categoryIdx: index("idx_tickets_category_id").on(table.category_id),
		subcategoryIdx: index("idx_tickets_subcategory_id").on(
			table.subcategory_id,
		),
		createdByIdx: index("idx_tickets_created_by").on(table.created_by),
		assignedToIdx: index("idx_tickets_assigned_to").on(table.assigned_to),
		groupIdx: index("idx_tickets_group_id").on(table.group_id),
		escalationIdx: index("idx_tickets_escalation_level").on(
			table.escalation_level,
		),
		statusCreatedIdx: index("idx_tickets_status_created").on(
			table.status_id,
			table.created_at,
		),
		metadataIdx: index("idx_tickets_metadata").using("gin", table.metadata),
		// Rating constraint: must be NULL or between 1-5
		ratingCheck: sql`CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5))`,
	}),
);

/* -------------------------------------------------------------------------- */
/* TICKET ATTACHMENTS                                                         */
/* -------------------------------------------------------------------------- */

export const ticket_attachments = pgTable(
	"ticket_attachments",
	{
		id: serial("id").primaryKey(),
		ticket_id: integer("ticket_id")
			.references(() => tickets.id, { onDelete: "cascade" })
			.notNull(),
		uploaded_by: uuid("uploaded_by")
			.references(() => users.id, { onDelete: "set null" })
			.notNull(),
		file_name: varchar("file_name", { length: 255 }).notNull(),
		storage_key: varchar("storage_key", { length: 512 }).notNull(),
		file_size: integer("file_size"),
		mime_type: varchar("mime_type", { length: 100 }),
		storage_url: text("storage_url"),
		is_deleted: boolean("is_deleted").default(false).notNull(),
		deleted_at: timestamp("deleted_at"),
		deleted_by: uuid("deleted_by").references(() => users.id),
		created_at: timestamp("created_at").defaultNow().notNull(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(table) => ({
		ticketIdx: index("idx_ticket_attachments_ticket_id").on(table.ticket_id),
		uploadedByIdx: index("idx_ticket_attachments_uploaded_by").on(
			table.uploaded_by,
		),
		isDeletedIdx: index("idx_ticket_attachments_is_deleted").on(
			table.is_deleted,
		),
	}),
);

/* -------------------------------------------------------------------------- */
/* TICKET COMMITTEE TAGS                                                      */
/* -------------------------------------------------------------------------- */

export const ticket_committee_tags = pgTable(
	"ticket_committee_tags",
	{
		id: serial("id").primaryKey(),
		ticket_id: integer("ticket_id")
			.references(() => tickets.id, { onDelete: "cascade" })
			.notNull(),
		committee_id: integer("committee_id")
			.references(() => committees.id, { onDelete: "cascade" })
			.notNull(),
		tagged_by: uuid("tagged_by")
			.references(() => users.id, { onDelete: "set null" })
			.notNull(),
		reason: text("reason"),
		created_at: timestamp("created_at").defaultNow(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(table) => ({
		ticketIdx: index("idx_ticket_committee_tags_ticket_id").on(
			table.ticket_id,
		),
		committeeIdx: index("idx_ticket_committee_tags_committee_id").on(
			table.committee_id,
		),
		taggedByIdx: index("idx_ticket_committee_tags_tagged_by").on(
			table.tagged_by,
		),
		uniqueTicketCommittee: unique("unique_ticket_committee_tag").on(
			table.ticket_id,
			table.committee_id,
		),
	}),
);

/* -------------------------------------------------------------------------- */
/* COMMENTS                                                                   */
/* -------------------------------------------------------------------------- */

export const comments = pgTable(
	"comments",
	{
		id: serial("id").primaryKey(),
		ticket_id: integer("ticket_id")
			.references(() => tickets.id, { onDelete: "cascade" })
			.notNull(),
		author_id: uuid("author_id")
			.references(() => users.id, { onDelete: "set null" })
			.notNull(),
		body: text("body").notNull(),
		comment_type: varchar("comment_type", { length: 32 })
			.default("student_visible")
			.notNull(), // student_visible | internal_note | super_admin_note
		is_internal: boolean("is_internal").default(false).notNull(),

		slack_message_id: varchar("slack_message_id", { length: 255 }),

		email_thread_id: varchar("email_thread_id", { length: 255 }),
		in_reply_to: varchar("in_reply_to", { length: 255 }),

		created_at: timestamp("created_at").defaultNow().notNull(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(table) => ({
		ticketIdx: index("idx_comments_ticket_id").on(table.ticket_id),
		authorIdx: index("idx_comments_author_id").on(table.author_id),
		ticketCreatedIdx: index("idx_comments_ticket_created").on(
			table.ticket_id,
			table.created_at,
		),
	}),
);

/* -------------------------------------------------------------------------- */
/* ESCALATIONS (history)                                                      */
/* -------------------------------------------------------------------------- */

export const escalations = pgTable(
	"escalations",
	{
		id: serial("id").primaryKey(),
		ticket_id: integer("ticket_id")
			.references(() => tickets.id, { onDelete: "cascade" })
			.notNull(),
		escalated_by: uuid("escalated_by").references(() => users.id, {
			onDelete: "set null",
		}),
		escalated_to: uuid("escalated_to").references(() => users.id),
		reason: text("reason"),
		level: integer("level").default(1).notNull(),
		created_at: timestamp("created_at").defaultNow().notNull(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(table) => ({
		ticketIdx: index("idx_escalations_ticket_id").on(table.ticket_id),
		levelIdx: index("idx_escalations_level").on(table.level),
		ticketLevelIdx: index("idx_escalations_ticket_level").on(
			table.ticket_id,
			table.level,
		),
	}),
);

/* -------------------------------------------------------------------------- */
/* ESCALATION RULES (domain/scope-based)                                      */
/* -------------------------------------------------------------------------- */

export const escalation_rules = pgTable(
	"escalation_rules",
	{
		id: serial("id").primaryKey(),

		domain_id: integer("domain_id")
			.references(() => domains.id)
			.notNull(),
		scope_id: integer("scope_id").references(() => scopes.id),

		level: integer("level").notNull(),

		user_id: uuid("user_id").references(() => users.id),
		notify_channel: varchar("notify_channel", { length: 32 })
			.default("slack")
			.notNull(), // slack | email | in_app

		created_at: timestamp("created_at").defaultNow(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(table) => ({
		domainScopeLevelIdx: index(
			"idx_escalation_rules_domain_scope_level",
		).on(table.domain_id, table.scope_id, table.level),
		domainLevelIdx: index("idx_escalation_rules_domain_level").on(
			table.domain_id,
			table.level,
		),
		uniqueRule: unique("unique_escalation_rule").on(
			table.domain_id,
			table.scope_id,
			table.level,
		),
	}),
);

/* -------------------------------------------------------------------------- */
/* NOTIFICATIONS                                                              */
/* -------------------------------------------------------------------------- */

export const notifications = pgTable(
	"notifications",
	{
		id: serial("id").primaryKey(),
		user_id: uuid("user_id").references(() => users.id, {
			onDelete: "cascade",
		}),
		ticket_id: integer("ticket_id").references(() => tickets.id, {
			onDelete: "cascade",
		}),

		channel: varchar("channel", { length: 32 }).notNull(), // email | slack | in_app
		notification_type: varchar("notification_type", { length: 50 }).notNull(), // new_ticket | acknowledgment | escalation | tat_breach | resolution
		priority: varchar("priority", { length: 20 })
			.default("normal")
			.notNull(), // low | normal | high | urgent

		payload: jsonb("payload"),

		status: varchar("status", { length: 32 }).default("pending").notNull(), // pending | sent | failed
		slack_message_id: varchar("slack_message_id", { length: 255 }),
		email_message_id: varchar("email_message_id", { length: 255 }),
		attempt_count: integer("attempt_count").default(0).notNull(),

		created_at: timestamp("created_at").defaultNow().notNull(),
		sent_at: timestamp("sent_at"),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(table) => ({
		userIdx: index("idx_notifications_user_id").on(table.user_id),
		ticketIdx: index("idx_notifications_ticket_id").on(table.ticket_id),
		statusIdx: index("idx_notifications_status").on(table.status),
		userStatusIdx: index("idx_notifications_user_status").on(
			table.user_id,
			table.status,
		),
		typeIdx: index("idx_notifications_type").on(table.notification_type),
	}),
);

/* -------------------------------------------------------------------------- */
/* TICKET ACTIVITY (ticket-specific audit)                                    */
/* -------------------------------------------------------------------------- */

export const ticket_activity = pgTable(
	"ticket_activity",
	{
		id: serial("id").primaryKey(),
		ticket_id: integer("ticket_id").references(() => tickets.id, {
			onDelete: "cascade",
		}),
		user_id: uuid("user_id").references(() => users.id, {
			onDelete: "set null",
		}),
		action: varchar("action", { length: 80 }).notNull(),
		details: jsonb("details"),
		created_at: timestamp("created_at").defaultNow().notNull(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(table) => ({
		ticketIdx: index("idx_ticket_activity_ticket_id").on(table.ticket_id),
		userIdx: index("idx_ticket_activity_user_id").on(table.user_id),
		ticketCreatedIdx: index("idx_ticket_activity_ticket_created").on(
			table.ticket_id,
			table.created_at,
		),
	}),
);

/* -------------------------------------------------------------------------- */
/* AUDIT LOG (system-wide, not just tickets)                                  */
/* -------------------------------------------------------------------------- */

export const audit_log = pgTable(
	"audit_log",
	{
		id: serial("id").primaryKey(),
		table_name: varchar("table_name", { length: 100 }).notNull(),
		record_id: integer("record_id").notNull(),
		action: varchar("action", { length: 20 }).notNull(), // created | updated | deleted
		old_data: jsonb(" old_data"),
		new_data: jsonb("new_data"),
		performed_by: uuid("performed_by").references(() => users.id),
		performed_at: timestamp("performed_at").defaultNow().notNull(),
		ip_address: varchar("ip_address", { length: 45 }),
		user_agent: text("user_agent"),
	},
	(table) => ({
		tableRecordIdx: index("idx_audit_log_table_record").on(
			table.table_name,
			table.record_id,
		),
		performedByIdx: index("idx_audit_log_performed_by").on(
			table.performed_by,
		),
		performedAtIdx: index("idx_audit_log_performed_at").on(
			table.performed_at,
		),
		actionIdx: index("idx_audit_log_action").on(table.action),
	}),
);

/* -------------------------------------------------------------------------- */
/* OUTBOX                                                                     */
/* -------------------------------------------------------------------------- */

export const outbox = pgTable("outbox", {
	id: serial("id").primaryKey(),
	event_type: text("event_type").notNull(),
	payload: jsonb("payload").$type<any>().notNull(),
	attempts: integer("attempts").default(0).notNull(),
	next_retry_at: timestamp("next_retry_at"),
	processed_at: timestamp("processed_at"),
	created_at: timestamp("created_at").defaultNow().notNull(),
});

/* -------------------------------------------------------------------------- */
/* NOTIFICATION SETTINGS (singleton config)                                   */
/* -------------------------------------------------------------------------- */

export const notification_settings = pgTable("notification_settings", {
	id: serial("id").primaryKey(),
	slack_enabled: boolean("slack_enabled").default(true).notNull(),
	email_enabled: boolean("email_enabled").default(true).notNull(),
	tat_reminders_enabled: boolean("tat_reminders_enabled")
		.default(true)
		.notNull(),
	committee_notifications_enabled: boolean(
		"committee_notifications_enabled",
	)
		.default(true)
		.notNull(),
	slack_config: jsonb("slack_config").default({}).notNull(),
	updated_by: uuid("updated_by").references(() => users.id),
	updated_at: timestamp("updated_at").defaultNow(),
});
