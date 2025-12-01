import {
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
    pgEnum,
  } from "drizzle-orm/pg-core";
  import { sql } from "drizzle-orm";
  
  /* -------------------------------------------------------------------------- */
  /* ENUMS                                                                      */
  /* -------------------------------------------------------------------------- */
  
  export const scopeMode = pgEnum("scope_mode", [
    "fixed",      // category.scope_id
    "dynamic",    // from student field
    "none",       // no scope
  ]);
  
  /* -------------------------------------------------------------------------- */
  /* ROLES                                                                      */
  /* -------------------------------------------------------------------------- */
  
  export const roles = pgTable(
    "roles",
    {
      id: serial("id").primaryKey(),
      name: varchar("name", { length: 64 }).notNull().unique(),
      description: text("description"),
      is_active: boolean("is_active").default(true),
      created_at: timestamp("created_at").defaultNow(),
    },
    (table) => ({
      nameIdx: index("idx_roles_name").on(table.name),
    })
  );
  
  /* -------------------------------------------------------------------------- */
  /* DOMAINS                                                                    */
  /* -------------------------------------------------------------------------- */
  
  export const domains = pgTable(
    "domains",
    {
      id: serial("id").primaryKey(),
      name: varchar("name", { length: 120 }).notNull().unique(),
      description: text("description"),
      is_active: boolean("is_active").default(true),
      created_at: timestamp("created_at").defaultNow(),
      updated_at: timestamp("updated_at").defaultNow(),
    },
    (table) => ({
      nameIdx: index("idx_domains_name").on(table.name),
      activeIdx: index("idx_domains_active").on(table.is_active),
    })
  );
  
  /* -------------------------------------------------------------------------- */
  /* SCOPES (dynamic routing)                                                   */
  /* -------------------------------------------------------------------------- */
  
  export const scopes = pgTable(
    "scopes",
    {
      id: serial("id").primaryKey(),
  
      domain_id: integer("domain_id")
        .references(() => domains.id, { onDelete: "cascade" })
        .notNull(),
  
      name: varchar("name", { length: 120 }).notNull(),
  
      // For student-based dynamic resolution
      student_field_key: varchar("student_field_key", { length: 64 }), 
      // hostel_id | class_section_id | batch_id | null
  
      is_active: boolean("is_active").default(true),
      created_at: timestamp("created_at").defaultNow(),
      updated_at: timestamp("updated_at").defaultNow(),
    },
    (table) => ({
      domainIdx: index("idx_scopes_domain").on(table.domain_id),
      activeIdx: index("idx_scopes_active").on(table.is_active),
      uniqueScope: unique("unique_scope_name_domain").on(
        table.domain_id,
        table.name
      ),
    })
  );
  
  /* -------------------------------------------------------------------------- */
  /* USERS                                                                      */
  /* -------------------------------------------------------------------------- */
  
  export const users = pgTable(
    "users",
    {
      id: uuid("id").defaultRandom().primaryKey(),
  
      auth_provider: varchar("auth_provider", { length: 64 }).notNull(),
      external_id: varchar("external_id", { length: 255 }).notNull(),
  
      email: varchar("email", { length: 256 }).unique(),
      phone: varchar("phone", { length: 30 }).notNull(),
  
      full_name: varchar("full_name", { length: 255 }),
      avatar_url: varchar("avatar_url", { length: 512 }),
  
      role_id: integer("role_id").references(() => roles.id).notNull(),
  
      created_at: timestamp("created_at").defaultNow(),
      updated_at: timestamp("updated_at").defaultNow(),
    },
    (table) => ({
      roleIdx: index("idx_users_role_id").on(table.role_id),
      emailIdx: index("idx_users_email").on(table.email),
    })
  );
  
  /* -------------------------------------------------------------------------- */
  /* MASTER DATA: HOSTELS / BATCHES / CLASS SECTIONS                            */
  /* -------------------------------------------------------------------------- */
  
  export const hostels = pgTable("hostels", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull().unique(),
    is_active: boolean("is_active").default(true),
    created_at: timestamp("created_at").defaultNow(),
  });
  
  export const batches = pgTable("batches", {
    id: serial("id").primaryKey(),
    batch_year: integer("batch_year").notNull().unique(),
    is_active: boolean("is_active").default(true),
    created_at: timestamp("created_at").defaultNow(),
  });
  
  export const class_sections = pgTable("class_sections", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 50 }).notNull().unique(),
    is_active: boolean("is_active").default(true),
    created_at: timestamp("created_at").defaultNow(),
  });
  
  /* -------------------------------------------------------------------------- */
  /* STUDENTS                                                                   */
  /* -------------------------------------------------------------------------- */
  
  export const students = pgTable(
    "students",
    {
      id: serial("id").primaryKey(),
  
      user_id: uuid("user_id")
        .references(() => users.id, { onDelete: "cascade" })
        .unique()
        .notNull(),
  
      roll_no: varchar("roll_no", { length: 32 }).notNull().unique(),
      room_no: varchar("room_no", { length: 16 }),
  
      hostel_id: integer("hostel_id").references(() => hostels.id),
      class_section_id: integer("class_section_id").references(
        () => class_sections.id
      ),
      batch_id: integer("batch_id").references(() => batches.id),
  
      department: varchar("department", { length: 120 }),
      blood_group: varchar("blood_group", { length: 8 }),
  
      created_at: timestamp("created_at").defaultNow(),
      updated_at: timestamp("updated_at").defaultNow(),
    },
    (table) => ({
      rollIdx: index("idx_students_roll_no").on(table.roll_no),
      userIdx: index("idx_students_user").on(table.user_id),
    })
  );
  
  /* -------------------------------------------------------------------------- */
  /* ADMIN PROFILES                                                              */
  /* -------------------------------------------------------------------------- */
  
  export const admin_profiles = pgTable(
    "admin_profiles",
    {
      user_id: uuid("user_id")
        .references(() => users.id, { onDelete: "cascade" })
        .primaryKey(),
  
      primary_domain_id: integer("primary_domain_id").references(
        () => domains.id
      ),
      primary_scope_id: integer("primary_scope_id").references(() => scopes.id),
  
      slack_user_id: varchar("slack_user_id", { length: 128 }).notNull(),
  
      created_at: timestamp("created_at").defaultNow(),
      updated_at: timestamp("updated_at").defaultNow(),
    },
    (table) => ({
      primaryDomainIdx: index("idx_admin_profiles_domain").on(
        table.primary_domain_id
      ),
      primaryScopeIdx: index("idx_admin_profiles_scope").on(
        table.primary_scope_id
      ),
    })
  );
  
  /* -------------------------------------------------------------------------- */
  /* ADMIN ASSIGNMENTS                                                           */
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
    },
    (table) => ({
      userIdx: index("idx_admin_assignments_user").on(table.user_id),
      domainIdx: index("idx_admin_assignments_domain").on(table.domain_id),
      uniqueAssignment: unique("unique_admin_assignment").on(
        table.user_id,
        table.domain_id,
        table.scope_id
      ),
    })
  );
  
  /* -------------------------------------------------------------------------- */
  /* COMMITTEES                                                                 */
  /* -------------------------------------------------------------------------- */
  
  export const committees = pgTable(
    "committees",
    {
      id: serial("id").primaryKey(),
  
      name: varchar("name", { length: 140 }).notNull().unique(),
      description: text("description"),
      contact_email: varchar("contact_email", { length: 256 }),
  
      head_id: uuid("head_id").references(() => users.id, {
        onDelete: "set null",
      }),
  
      is_active: boolean("is_active").default(true),
  
      created_at: timestamp("created_at").defaultNow(),
      updated_at: timestamp("updated_at").defaultNow(),
    },
    (table) => ({
      nameIdx: index("idx_committees_name").on(table.name),
      headIdx: index("idx_committees_head").on(table.head_id),
    })
  );
  
  /* -------------------------------------------------------------------------- */
  /* CATEGORIES                                                                  */
  /* -------------------------------------------------------------------------- */
  
  // Self-referential table: categories can have parent categories
  // @ts-expect-error - TypeScript can't infer self-referential type, but Drizzle handles it correctly
  export const categories = pgTable(
    "categories",
    {
      id: serial("id").primaryKey(),
  
      name: varchar("name", { length: 140 }).notNull(),
      slug: varchar("slug", { length: 140 }).notNull().unique(),
  
      description: text("description"),
      icon: varchar("icon", { length: 64 }),
      color: varchar("color", { length: 20 }),
  
      domain_id: integer("domain_id").references(() => domains.id).notNull(),
  
      scope_id: integer("scope_id").references(() => scopes.id),
      scope_mode: scopeMode("scope_mode").default("dynamic").notNull(),
  
      default_admin_id: uuid("default_admin_id").references(() => users.id),
  
      sla_hours: integer("sla_hours").default(48),
      is_active: boolean("is_active").default(true),
      display_order: integer("display_order").default(0),
  
      parent_category_id: integer("parent_category_id").references(
        // @ts-expect-error - Self-referential reference (circular type inference)
        (): typeof categories.id => categories.id
      ),
  
      created_at: timestamp("created_at").defaultNow(),
      updated_at: timestamp("updated_at").defaultNow(),
    },
    (table) => ({
      slugIdx: index("idx_categories_slug").on(table.slug),
      domainIdx: index("idx_categories_domain").on(table.domain_id),
      parentIdx: index("idx_categories_parent").on(table.parent_category_id),
    })
  );
  
  /* -------------------------------------------------------------------------- */
  /* SUBCATEGORIES                                                               */
  /* -------------------------------------------------------------------------- */
  
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
  
      sla_hours: integer("sla_hours"),
      is_active: boolean("is_active").default(true),
      display_order: integer("display_order").default(0),
  
      created_at: timestamp("created_at").defaultNow(),
      updated_at: timestamp("updated_at").defaultNow(),
    },
    (table) => ({
      categoryIdx: index("idx_subcategories_category").on(table.category_id),
      uniqueSlug: unique("unique_subcategory_slug").on(
        table.category_id,
        table.slug
      ),
    })
  );
  
  /* -------------------------------------------------------------------------- */
  /* SUB-SUBCATEGORIES                                                           */
  /* -------------------------------------------------------------------------- */
  
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
  
      sla_hours: integer("sla_hours"),
      is_active: boolean("is_active").default(true),
      display_order: integer("display_order").default(0),
  
      created_at: timestamp("created_at").defaultNow(),
      updated_at: timestamp("updated_at").defaultNow(),
    },
    (table) => ({
      subcategoryIdx: index("idx_sub_subcategories_subcategory").on(
        table.subcategory_id
      ),
      uniqueSlug: unique("unique_sub_subcategory_slug").on(
        table.subcategory_id,
        table.slug
      ),
    })
  );
  
  /* -------------------------------------------------------------------------- */
  /* CATEGORY FIELDS                                                             */
  /* -------------------------------------------------------------------------- */
  
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
      required: boolean("required").default(false),
  
      placeholder: varchar("placeholder", { length: 255 }),
      help_text: text("help_text"),
      validation_rules: jsonb("validation_rules"),
  
      assigned_admin_id: uuid("assigned_admin_id").references(() => users.id),
  
      display_order: integer("display_order").default(0),
      is_active: boolean("is_active").default(true),
  
      created_at: timestamp("created_at").defaultNow(),
      updated_at: timestamp("updated_at").defaultNow(),
    },
    (table) => ({
      uniqueSlug: unique("unique_category_field_slug").on(
        table.subcategory_id,
        table.slug
      ),
    })
  );
  
  /* -------------------------------------------------------------------------- */
  /* CATEGORY FIELD OPTIONS                                                      */
  /* -------------------------------------------------------------------------- */
  
  export const field_options = pgTable(
    "field_options",
    {
      id: serial("id").primaryKey(),
  
      field_id: integer("field_id")
        .references(() => category_fields.id, { onDelete: "cascade" })
        .notNull(),
  
      label: varchar("label", { length: 255 }).notNull(),
      value: varchar("value", { length: 255 }).notNull(),
  
      display_order: integer("display_order").default(0),
      is_active: boolean("is_active").default(true),
  
      created_at: timestamp("created_at").defaultNow(),
      updated_at: timestamp("updated_at").defaultNow(),
    },
    (table) => ({
      fieldIdx: index("idx_field_options_field").on(table.field_id),
    })
  );
  
  /* -------------------------------------------------------------------------- */
  /* CATEGORY ASSIGNMENTS                                                        */
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
  
      assignment_type: varchar("assignment_type", { length: 32 }),
  
      created_at: timestamp("created_at").defaultNow(),
    },
    (table) => ({
      uniqueAssignment: unique("unique_category_admin_assignment").on(
        table.category_id,
        table.user_id
      ),
      categoryIdx: index("idx_category_assignments_category").on(
        table.category_id
      ),
      userIdx: index("idx_category_assignments_user").on(table.user_id),
    })
  );
  
  /* -------------------------------------------------------------------------- */
  /* TICKET STATUSES                                                             */
  /* -------------------------------------------------------------------------- */
  
  export const ticket_statuses = pgTable(
    "ticket_statuses",
    {
      id: serial("id").primaryKey(),
  
      value: varchar("value", { length: 50 }).notNull().unique(),
      label: varchar("label", { length: 100 }).notNull(),
  
      description: text("description"),
      progress_percent: integer("progress_percent").default(0),
      badge_color: varchar("badge_color", { length: 50 }).default("default"),
  
      is_active: boolean("is_active").default(true),
      is_final: boolean("is_final").default(false),
  
      display_order: integer("display_order").default(0),
  
      created_at: timestamp("created_at").defaultNow(),
      updated_at: timestamp("updated_at").defaultNow(),
    },
    (table) => ({
      valueIdx: index("idx_ticket_statuses_value").on(table.value),
    })
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
      created_by: uuid("created_by").references(() => users.id, {
        onDelete: "set null",
      }),
      committee_id: integer("committee_id").references(() => committees.id, {
        onDelete: "set null",
      }),
      is_archived: boolean("is_archived").default(false),
      created_at: timestamp("created_at").defaultNow(),
      updated_at: timestamp("updated_at").defaultNow(),
    },
    (table) => ({
      createdByIdx: index("idx_ticket_groups_created_by").on(table.created_by),
      archivedIdx: index("idx_ticket_groups_archived").on(table.is_archived),
      committeeIdx: index("idx_ticket_groups_committee").on(table.committee_id),
    })
  );
  
  /* -------------------------------------------------------------------------- */
  /* TICKETS                                                                     */
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
        () => subcategories.id
      ),
      sub_subcategory_id: integer("sub_subcategory_id").references(
        () => sub_subcategories.id
      ),
  
      scope_id: integer("scope_id").references(() => scopes.id),
  
      created_by: uuid("created_by").references(() => users.id, {
        onDelete: "set null",
      }),
      assigned_to: uuid("assigned_to").references(() => users.id, {
        onDelete: "set null",
      }),
  
      group_id: integer("group_id").references(() => ticket_groups.id, {
        onDelete: "set null",
      }),
  
      escalation_level: integer("escalation_level").default(0),
  
      acknowledgement_due_at: timestamp("acknowledgement_due_at"),
      resolution_due_at: timestamp("resolution_due_at"),
  
      metadata: jsonb("metadata"),
  
      created_at: timestamp("created_at").defaultNow(),
      updated_at: timestamp("updated_at").defaultNow(),
    },
    (table) => ({
      statusIdx: index("idx_tickets_status").on(table.status_id),
      creatorIdx: index("idx_tickets_created_by").on(table.created_by),
      assignedIdx: index("idx_tickets_assigned_to").on(table.assigned_to),
      categoryIdx: index("idx_tickets_category").on(table.category_id),
      scopeIdx: index("idx_tickets_scope").on(table.scope_id),
      groupIdx: index("idx_tickets_group").on(table.group_id),
      statusCreatedIdx: index("idx_tickets_status_created").on(
        table.status_id,
        table.created_at
      ),
    })
  );
  
  /* -------------------------------------------------------------------------- */
  /* TICKET ACTIVITY (comments + audit)                                          */
  /* -------------------------------------------------------------------------- */
  
  export const ticket_activity = pgTable(
    "ticket_activity",
    {
      id: serial("id").primaryKey(),
  
      ticket_id: integer("ticket_id")
        .references(() => tickets.id, { onDelete: "cascade" })
        .notNull(),
  
      user_id: uuid("user_id").references(() => users.id, {
        onDelete: "set null",
      }),
  
      action: varchar("action", { length: 80 }).notNull(),
      details: jsonb("details"),
  
      created_at: timestamp("created_at").defaultNow(),
    },
    (table) => ({
      ticketIdx: index("idx_ticket_activity_ticket").on(table.ticket_id),
      actionIdx: index("idx_ticket_activity_action").on(table.action),
      createdIdx: index("idx_ticket_activity_created").on(table.created_at),
    })
  );
  
  /* -------------------------------------------------------------------------- */
  /* TICKET ATTACHMENTS                                                          */
  /* -------------------------------------------------------------------------- */
  
  export const ticket_attachments = pgTable(
    "ticket_attachments",
    {
      id: serial("id").primaryKey(),
  
      ticket_id: integer("ticket_id")
        .references(() => tickets.id, { onDelete: "cascade" })
        .notNull(),
  
      uploaded_by: uuid("uploaded_by").references(() => users.id, {
        onDelete: "set null",
      }),
  
      file_name: varchar("file_name", { length: 255 }).notNull(),
      storage_key: varchar("storage_key", { length: 512 }).notNull(),
      mime_type: varchar("mime_type", { length: 100 }),
      file_size: integer("file_size"),
  
      created_at: timestamp("created_at").defaultNow(),
    },
    (table) => ({
      ticketIdx: index("idx_ticket_attachments_ticket").on(table.ticket_id),
      uploadedIdx: index("idx_ticket_attachments_uploaded").on(
        table.uploaded_by
      ),
    })
  );
  
  /* -------------------------------------------------------------------------- */
  /* TICKET COMMITTEE TAGS                                                       */
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
  
      tagged_by: uuid("tagged_by").references(() => users.id, {
        onDelete: "set null",
      }),
  
      reason: text("reason"),
  
      created_at: timestamp("created_at").defaultNow(),
    },
    (table) => ({
      ticketIdx: index("idx_ticket_committee_ticket").on(table.ticket_id),
      uniqueTag: unique("unique_ticket_committee").on(
        table.ticket_id,
        table.committee_id
      ),
    })
  );
  
  /* -------------------------------------------------------------------------- */
  /* TICKET FEEDBACK                                                             */
  /* -------------------------------------------------------------------------- */
  
  export const ticket_feedback = pgTable("ticket_feedback", {
    ticket_id: integer("ticket_id")
      .references(() => tickets.id, { onDelete: "cascade" })
      .primaryKey(),
    rating: integer("rating").default(sql`NULL`),
    feedback: text("feedback"),
    created_at: timestamp("created_at").defaultNow(),
  });
  
  /* -------------------------------------------------------------------------- */
  /* TICKET INTEGRATIONS                                                         */
  /* -------------------------------------------------------------------------- */
  
  export const ticket_integrations = pgTable(
    "ticket_integrations",
    {
      ticket_id: integer("ticket_id")
        .references(() => tickets.id, { onDelete: "cascade" })
        .primaryKey(),
  
      slack_thread_id: varchar("slack_thread_id", { length: 255 }),
      email_thread_id: varchar("email_thread_id", { length: 255 }),
  
      admin_link: varchar("admin_link", { length: 512 }),
      student_link: varchar("student_link", { length: 512 }),
  
      external_ref: varchar("external_ref", { length: 64 }).unique(),
  
      created_at: timestamp("created_at").defaultNow(),
      updated_at: timestamp("updated_at").defaultNow(),
    },
    (table) => ({
      slackIdx: index("idx_ticket_integrations_slack").on(
        table.slack_thread_id
      ),
      emailIdx: index("idx_ticket_integrations_email").on(
        table.email_thread_id
      ),
    })
  );
  
  /* -------------------------------------------------------------------------- */
  /* NOTIFICATIONS                                                               */
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
  
      slack_message_id: varchar("slack_message_id", { length: 255 }),
      email_message_id: varchar("email_message_id", { length: 255 }),
  
      created_at: timestamp("created_at").defaultNow(),
      sent_at: timestamp("sent_at"),
    },
    (table) => ({
      userIdx: index("idx_notifications_user").on(table.user_id),
      ticketIdx: index("idx_notifications_ticket").on(table.ticket_id),
      channelIdx: index("idx_notifications_channel").on(table.channel),
    })
  );
  
  /* -------------------------------------------------------------------------- */
  /* ESCALATION RULES                                                            */
  /* -------------------------------------------------------------------------- */
  
  export const escalation_rules = pgTable(
    "escalation_rules",
    {
      id: serial("id").primaryKey(),
  
      domain_id: integer("domain_id").references(() => domains.id).notNull(),
      scope_id: integer("scope_id").references(() => scopes.id),
  
      level: integer("level").notNull(),
  
      user_id: uuid("user_id").references(() => users.id),
  
      tat_hours: integer("tat_hours").default(48),
  
      notify_channel: varchar("notify_channel", { length: 32 }).default(
        "slack"
      ),
  
      created_at: timestamp("created_at").defaultNow(),
      updated_at: timestamp("updated_at").defaultNow(),
    },
    (table) => ({
      uniqueRule: unique("unique_escalation_rule").on(
        table.domain_id,
        table.scope_id,
        table.level
      ),
    })
  );
  
  /* -------------------------------------------------------------------------- */
  /* NOTIFICATION CHANNELS (Flexible Routing)                                    */
  /* -------------------------------------------------------------------------- */
  
  export const notification_channels = pgTable(
    "notification_channels",
    {
      id: serial("id").primaryKey(),
      
      // Owner type: 'domain', 'scope', 'category', 'committee', 'user', 'ticket'
      owner_type: varchar("owner_type", { length: 32 }).notNull(),
      
      // Owner ID: domain_id / scope_id / category_id / committee_id / user_id (UUID) / ticket_id
      // Note: For user_id (UUID), we'll store as integer representation or use a separate lookup
      owner_id: varchar("owner_id", { length: 255 }).notNull(),
      
      // Channel type: 'slack', 'email', 'webhook', etc.
      channel_type: varchar("channel_type", { length: 32 }).notNull().default("slack"),
      
      // Slack channel ID (e.g., C03ABC123) or channel name (e.g., #hostel-support)
      slack_channel_id: varchar("slack_channel_id", { length: 255 }),
      
      // Slack thread timestamp (for ticket-specific threads)
      slack_thread: varchar("slack_thread", { length: 255 }),
      
      // Slack user ID for DM notifications (when owner_type = 'user')
      slack_user_id: varchar("slack_user_id", { length: 128 }),
      
      // Priority: higher priority channels override lower ones
      // Ticket = 100, Category = 50, Scope = 40, Domain = 30, Committee = 20, User = 10
      priority: integer("priority").default(0),
      
      is_active: boolean("is_active").default(true),
      created_at: timestamp("created_at").defaultNow(),
      updated_at: timestamp("updated_at").defaultNow(),
    },
    (table) => ({
      ownerIdx: index("idx_notification_channels_owner").on(table.owner_type, table.owner_id),
      activeIdx: index("idx_notification_channels_active").on(table.is_active),
      typeIdx: index("idx_notification_channels_type").on(table.channel_type),
      priorityIdx: index("idx_notification_channels_priority").on(table.priority),
    })
  );
  
  /* -------------------------------------------------------------------------- */
  /* NOTIFICATION CONFIGURATION                                                 */
  /* -------------------------------------------------------------------------- */
  
  export const notification_config = pgTable(
    "notification_config",
    {
      id: serial("id").primaryKey(),
      
      // Category-based configuration (can be null for global defaults)
      category_id: integer("category_id").references(() => categories.id, {
        onDelete: "cascade",
      }),
      
      // Subcategory-based configuration (optional, more specific)
      subcategory_id: integer("subcategory_id").references(() => subcategories.id, {
        onDelete: "cascade",
      }),
      
      // Notification channels enabled for this config
      enable_slack: boolean("enable_slack").default(true),
      enable_email: boolean("enable_email").default(true),
      
      // Slack channel configuration (deprecated - use notification_channels instead)
      slack_channel: varchar("slack_channel", { length: 255 }),
      
      // Slack CC user IDs (JSON array of Slack user IDs)
      slack_cc_user_ids: jsonb("slack_cc_user_ids"),
      
      // Email recipients (JSON array of email addresses or user IDs)
      email_recipients: jsonb("email_recipients"),
      
      // Priority: higher priority configs override lower ones
      // Global default = 0, Category = 10, Category+Subcategory = 20
      priority: integer("priority").default(0),
      
      is_active: boolean("is_active").default(true),
      created_at: timestamp("created_at").defaultNow(),
      updated_at: timestamp("updated_at").defaultNow(),
    },
    (table) => ({
      categoryIdx: index("idx_notification_config_category").on(table.category_id),
      subcategoryIdx: index("idx_notification_config_subcategory").on(table.subcategory_id),
      activeIdx: index("idx_notification_config_active").on(table.is_active),
      priorityIdx: index("idx_notification_config_priority").on(table.priority),
    })
  );
  
  /* -------------------------------------------------------------------------- */
  /* OUTBOX                                                                      */
  /* -------------------------------------------------------------------------- */
  
  export const outbox = pgTable("outbox", {
    id: serial("id").primaryKey(),
  
    event_type: text("event_type").notNull(),
    payload: jsonb("payload").notNull(),
  
    attempts: integer("attempts").default(0),
    next_retry_at: timestamp("next_retry_at"),
    processed_at: timestamp("processed_at"),
  
    created_at: timestamp("created_at").defaultNow(),
  });
  