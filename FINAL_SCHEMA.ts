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

// Ticket status enum (kept for now, gradually replaced by ticket_statuses table)
export const ticketStatus = pgEnum("ticket_status", [
    "OPEN",              // New (initial)
    "IN_PROGRESS",       // POC is working on it
    "AWAITING_STUDENT",  // Waiting for student response
    "REOPENED",          // Student reopened
    "ESCALATED",         // Escalated
    "FORWARDED",         // Forwarded to next level
    "RESOLVED",          // Resolved successfully
]);

/* -------------------------------------------------------------------------- */
/* TICKET STATUSES (Dynamic, SuperAdmin controlled)                           */
/* -------------------------------------------------------------------------- */

export const ticket_statuses = pgTable(
    "ticket_statuses",
    {
        id: serial("id").primaryKey(),
        value: varchar("value", { length: 50 }).notNull().unique(),
        label: varchar("label", { length: 100 }).notNull(),
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
/* ROLES (single source of truth for app roles)                               */
/* -------------------------------------------------------------------------- */

export const roles = pgTable(
    "roles",
    {
        id: serial("id").primaryKey(),
        name: varchar("name", { length: 64 }).notNull().unique(), // student | admin | super_admin | committee_head
        description: text("description"),
        created_at: timestamp("created_at").defaultNow(),
    },
    (table) => ({
        nameIdx: index("idx_roles_name").on(table.name),
    }),
);

/* -------------------------------------------------------------------------- */
/* DOMAINS & SCOPES (operational hierarchy – routing / escalation)            */
/*                                                                            */
/* DESIGN NOTE:                                                               */
/* - domains = Top-level operational areas (Hostel, Mess, IT, etc.)          */
/* - scopes = Sub-areas within domains (Neeladri, Velankani, Electrical)    */
/* - Every category MUST have a domain_id (no nulls!)                        */
/* - For generic categories, use domain="General"                            */
/* -------------------------------------------------------------------------- */

export const domains = pgTable(
    "domains",
    {
        id: serial("id").primaryKey(),
        name: varchar("name", { length: 100 }).notNull().unique(),
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
        name: varchar("name", { length: 100 }).notNull(),
        description: text("description"),
        is_active: boolean("is_active").default(true).notNull(),
        created_at: timestamp("created_at").defaultNow(),
        updated_at: timestamp("updated_at").defaultNow(),
    },
    (table) => ({
        domainIdx: index("idx_scopes_domain_id").on(table.domain_id),
        nameIdx: index("idx_scopes_name").on(table.name),
        activeIdx: index("idx_scopes_is_active").on(table.is_active),
    }),
);

/* -------------------------------------------------------------------------- */
/* USERS (Clerk identity + single role + primary domain/scope for admins)     */
/*                                                                            */
/* DESIGN NOTE: Primary Domain/Scope vs Admin Assignments                    */
/* - primary_domain_id & primary_scope_id = Admin's MAIN operational area   */
/*   (their "home base", default dashboard filter, main responsibility)      */
/* - admin_assignments table = EXTRA areas they also manage                  */
/*   (additional coverage, temporary assignments, escalation backup)         */
/* -------------------------------------------------------------------------- */

export const users = pgTable(
    "users",
    {
        id: uuid("id").defaultRandom().primaryKey(),

        clerk_id: varchar("clerk_id", { length: 255 }).notNull().unique(),
        email: varchar("email", { length: 256 }).notNull().unique(),
        phone: varchar("phone", { length: 30 }),

        first_name: varchar("first_name", { length: 120 }),
        last_name: varchar("last_name", { length: 120 }),

        role_id: integer("role_id")
            .references(() => roles.id)
            .notNull(),

        // Only admins should have these populated; students = NULL
        primary_domain_id: integer("primary_domain_id").references(
            () => domains.id,
        ),
        primary_scope_id: integer("primary_scope_id").references(
            () => scopes.id,
        ),

        // Slack integration - only for admins
        slack_user_id: varchar("slack_user_id", { length: 128 }),

        avatar_url: varchar("avatar_url", { length: 512 }),

        created_at: timestamp("created_at").defaultNow(),
        updated_at: timestamp("updated_at").defaultNow(),
    },
    (table) => ({
        clerkIdIdx: index("idx_users_clerk_id").on(table.clerk_id),
        emailIdx: index("idx_users_email").on(table.email),
        roleIdx: index("idx_users_role_id").on(table.role_id),
        primaryDomainIdx: index("idx_users_primary_domain_id").on(
            table.primary_domain_id,
        ),
    }),
);

/* -------------------------------------------------------------------------- */
/* ADMIN ASSIGNMENTS (Admins ↔ Domains/Scopes - additional coverage)          */
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
/* MASTER TABLES: HOSTELS / BATCHES / CLASS SECTIONS                          */
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

/* -------------------------------------------------------------------------- */
/* STUDENTS (profile + rate-limits)                                           */
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

        source: varchar("source", { length: 20 }).default("csv").notNull(),
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
/* STUDENT PROFILE FIELDS (SuperAdmin-configured schema)                      */
/* -------------------------------------------------------------------------- */

export const student_profile_fields = pgTable(
    "student_profile_fields",
    {
        id: serial("id").primaryKey(),
        field_name: varchar("field_name", { length: 64 }).notNull().unique(),
        field_label: varchar("field_label", { length: 128 }).notNull(),
        field_type: varchar("field_type", { length: 32 }).notNull(),
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

/* STUDENT PROFILE DATA (values for those fields) */

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
        role: varchar("role", { length: 64 }),
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
/* CATEGORIES (form hierarchy)                                                */
/*                                                                            */
/* ⭐ TICKET ASSIGNMENT PRIORITY (AUTHORITATIVE - PRD ALIGNED)               */
/*                                                                            */
/* When a ticket is created, assign using THIS exact order:                  */
/*                                                                            */
/* 1️⃣ sub_subcategories.assigned_admin_id (MOST SPECIFIC)                   */
/*    → Example: Maintenance → Electrical → "Other" → SuperAdmin            */
/*                                                                            */
/* 2️⃣ subcategories.assigned_admin_id                                       */
/*    → Example: "Wifi" subcategory → IT Admin always                       */
/*                                                                            */
/* 3️⃣ category_fields.assigned_admin_id (dynamic field override)            */
/*    → Example: Vendor field → if vendor="FoodCorp" → assign FoodCorp POC */
/*                                                                            */
/* 4️⃣ category_assignments table (many-to-many)                             */
/*    → Priority: is_primary=true → highest priority number → load balance  */
/*                                                                            */
/* 5️⃣ categories.default_admin_id (fallback)                                */
/*    → If nothing else matches                                              */
/*                                                                            */
/* 6️⃣ Domain + Scope system fallback                                        */
/*    → Based on student's hostel/location → domain → scope                 */
/*                                                                            */
/* NOTE: domain_id is REQUIRED (NOT NULL) - use domain="General" for       */
/*       generic categories. This ensures routing always works.              */
/* -------------------------------------------------------------------------- */

export const categories = pgTable(
    "categories",
    {
        id: serial("id").primaryKey(),
        name: varchar("name", { length: 140 }).notNull(),
        slug: varchar("slug", { length: 140 }).notNull().unique(),
        description: text("description"),

        icon: varchar("icon", { length: 64 }),
        color: varchar("color", { length: 20 }),

        // Operational mapping (REQUIRED - no nulls!)
        domain_id: integer("domain_id")
            .references(() => domains.id)
            .notNull(),
        scope_id: integer("scope_id").references(() => scopes.id),

        // Fallback default admin (Priority #5 in assignment chain)
        default_admin_id: uuid("default_admin_id").references(() => users.id),

        committee_id: integer("committee_id").references(() => committees.id),

        // Hierarchical category tree (optional)
        parent_category_id: integer("parent_category_id").references(
            () => categories.id,
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

/* CATEGORY PROFILE FIELDS */

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

/* SUBCATEGORIES (Assignment Priority #2) */

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

        // Override admin (Priority #2 in assignment chain)
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

/* SUB-SUBCATEGORIES (Assignment Priority #1 - MOST SPECIFIC) */

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

        // Override admin (Priority #1 - highest specificity)
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

/* CATEGORY FIELDS (Assignment Priority #3) */

export const category_fields = pgTable(
    "category_fields",
    {
        id: serial("id").primaryKey(),
        subcategory_id: integer("subcategory_id")
            .references(() => subcategories.id, { onDelete: "cascade" })
            .notNull(),
        name: varchar("name", { length: 140 }).notNull(),
        slug: varchar("slug", { length: 140 }).notNull(),
        field_type: varchar("field_type", { length: 50 }).notNull(),
        required: boolean("required").default(false).notNull(),
        placeholder: varchar("placeholder", { length: 255 }),
        help_text: text("help_text"),
        validation_rules: jsonb("validation_rules"),

        // Optional: routing override based on field value (Priority #3)
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

/* FIELD OPTIONS */

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
    },
    (table) => ({
        fieldIdx: index("idx_field_options_field_id").on(table.field_id),
        displayOrderIdx: index("idx_field_options_display_order").on(
            table.display_order,
        ),
        activeIdx: index("idx_field_options_active").on(table.active),
    }),
);

/* DELETED CATEGORY FIELDS ARCHIVE */

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
/* CATEGORY ASSIGNMENTS (Many-to-Many - Assignment Priority #4)               */
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
/* TICKETS (PRD v3.0 aligned, no staff table references)                      */
/* -------------------------------------------------------------------------- */

export const tickets = pgTable(
    "tickets",
    {
        id: serial("id").primaryKey(),

        title: varchar("title", { length: 255 }),
        description: text("description"),
        location: varchar("location", { length: 255 }),

        status: ticketStatus("status").default("OPEN").notNull(),

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

        // Escalation tracking
        escalation_level: integer("escalation_level").default(0).notNull(),
        tat_extended_count: integer("tat_extended_count").default(0).notNull(),
        last_escalation_at: timestamp("last_escalation_at"),

        // TAT management (FIXED - proper types!)
        acknowledgement_tat_hours: integer("acknowledgement_tat_hours"),
        resolution_tat_hours: integer("resolution_tat_hours"),

        acknowledgement_due_at: timestamp("acknowledgement_due_at"),
        resolution_due_at: timestamp("resolution_due_at"),

        acknowledged_at: timestamp("acknowledged_at"),
        reopened_at: timestamp("reopened_at"),
        sla_breached_at: timestamp("sla_breached_at"),

        reopen_count: integer("reopen_count").default(0).notNull(),

        // Rating & feedback
        rating: integer("rating"),
        feedback_type: varchar("feedback_type", { length: 20 }),
        rating_submitted: timestamp("rating_submitted"),
        feedback: text("feedback"),

        // Visibility & links
        is_public: boolean("is_public").default(false).notNull(),
        admin_link: varchar("admin_link", { length: 512 }),
        student_link: varchar("student_link", { length: 512 }),

        // Integrations
        slack_thread_id: varchar("slack_thread_id", { length: 255 }),
        external_ref: varchar("external_ref", { length: 64 }).unique(),

        // Metadata (NOT attachments - see ticket_attachments table)
        metadata: jsonb("metadata"),

        created_at: timestamp("created_at").defaultNow().notNull(),
        updated_at: timestamp("updated_at").defaultNow().notNull(),
        resolved_at: timestamp("resolved_at"),
    },
    (table) => ({
        statusIdx: index("idx_tickets_status").on(table.status),
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
            table.status,
            table.created_at,
        ),
        metadataIdx: index("idx_tickets_metadata").using("gin", table.metadata),
        ratingCheck: sql`CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5))`,
    }),
);

/* -------------------------------------------------------------------------- */
/* TICKET ATTACHMENTS (separate from tickets - better queryability)           */
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
/* COMMENTS (with email threading)                                            */
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
            .notNull(),
        is_internal: boolean("is_internal").default(false).notNull(),

        slack_message_id: varchar("slack_message_id", { length: 255 }),

        // Email threading support
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
/* ESCALATION RULES (Domain/Scope-based chain)                                */
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
            .notNull(),

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
/* NOTIFICATIONS (with types & priority)                                      */
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

        channel: varchar("channel", { length: 32 }).notNull(),
        notification_type: varchar("notification_type", { length: 50 }).notNull(),
        priority: varchar("priority", { length: 20 })
            .default("normal")
            .notNull(),

        payload: jsonb("payload"),

        status: varchar("status", { length: 32 }).default("pending").notNull(),
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
/* TICKET ACTIVITY (renamed from activity_logs - ticket-specific audit)       */
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
/* AUDIT LOG (system-wide, not ticket-specific)                               */
/* -------------------------------------------------------------------------- */

export const audit_log = pgTable(
    "audit_log",
    {
        id: serial("id").primaryKey(),
        table_name: varchar("table_name", { length: 100 }).notNull(),
        record_id: integer("record_id").notNull(),
        action: varchar("action", { length: 20 }).notNull(),
        old_data: jsonb("old_data"),
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
/* OUTBOX (event sourcing / async workers)                                    */
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
