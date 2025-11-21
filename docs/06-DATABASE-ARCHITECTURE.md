# Database Architecture

## Overview

SST-Resolve uses PostgreSQL with Drizzle ORM for type-safe database operations. The schema is designed for flexibility, performance, and data integrity.

## Technology Stack

### ORM and Database
- **Drizzle ORM** (`drizzle-orm`) - Type-safe ORM
- **PostgreSQL** - Relational database
- **Drizzle Kit** - Schema migrations
- **pg** - PostgreSQL driver

### Schema Design
- **Normalized tables** - Reduce redundancy
- **Foreign keys** - Referential integrity
- **Indexes** - Query performance
- **JSONB** - Flexible metadata

## Core Tables

### Users Table

```typescript
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerk_id: varchar("clerk_id", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 256 }).notNull().unique(),
  name: varchar("name", { length: 120 }),
  phone: varchar("phone", { length: 30 }),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
}, (table) => ({
  clerkIdIdx: index("idx_users_clerk_id").on(table.clerk_id),
  emailIdx: index("idx_users_email").on(table.email),
}));
```

**Key Points:**
- UUID primary key (stable, non-sequential)
- Clerk ID for auth integration
- Indexed for fast lookups
- Timestamps for audit trail

### Tickets Table

```typescript
export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }),
  description: text("description"),
  status: ticketStatus("status").default("OPEN").notNull(),
  
  // Foreign keys
  category_id: integer("category_id").references(() => categories.id),
  created_by: uuid("created_by").references(() => users.id).notNull(),
  assigned_to: integer("assigned_to").references(() => staff.id),
  
  // Snapshot data (preserved on updates)
  location: varchar("location", { length: 255 }),
  metadata: jsonb("metadata"),
  attachments: jsonb("attachments"),
  
  // Escalation tracking
  escalation_level: integer("escalation_level").default(0).notNull(),
  last_escalation_at: timestamp("last_escalation_at"),
  
  // TAT
  due_at: timestamp("due_at"),
  
  // Timestamps
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
  resolved_at: timestamp("resolved_at"),
}, (table) => ({
  statusIdx: index("idx_tickets_status").on(table.status),
  categoryIdx: index("idx_tickets_category_id").on(table.category_id),
  assignedToIdx: index("idx_tickets_assigned_to").on(table.assigned_to),
  createdByIdx: index("idx_tickets_created_by").on(table.created_by),
  metadataIdx: index("idx_tickets_metadata").using("gin", table.metadata),
}));
```

**Design Decisions:**
- Serial ID for tickets (user-friendly)
- JSONB for flexible metadata
- GIN index on JSONB for fast queries
- Snapshot fields preserve historical data

### Students Table

```typescript
export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  user_id: uuid("user_id").references(() => users.id).notNull().unique(),
  roll_no: varchar("roll_no", { length: 32 }).notNull().unique(),
  room_no: varchar("room_no", { length: 16 }),
  
  // Foreign keys to master tables
  hostel_id: integer("hostel_id").references(() => hostels.id),
  batch_id: integer("batch_id").references(() => batches.id),
  class_section_id: integer("class_section_id").references(() => class_sections.id),
  
  batch_year: integer("batch_year"),
  department: varchar("department", { length: 120 }),
  active: boolean("active").default(true).notNull(),
  
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("idx_students_user_id").on(table.user_id),
  rollNoIdx: index("idx_students_roll_no").on(table.roll_no),
}));
```

## Relationships

### One-to-Many

```typescript
// User has many tickets
export const usersRelations = relations(users, ({ many }) => ({
  tickets: many(tickets),
  comments: many(comments),
}));

// Category has many tickets
export const categoriesRelations = relations(categories, ({ many }) => ({
  tickets: many(tickets),
  subcategories: many(subcategories),
}));
```

### Many-to-One

```typescript
// Ticket belongs to user
export const ticketsRelations = relations(tickets, ({ one }) => ({
  created_by_user: one(users, {
    fields: [tickets.created_by],
    references: [users.id],
  }),
  assigned_admin: one(staff, {
    fields: [tickets.assigned_to],
    references: [staff.id],
  }),
  category: one(categories, {
    fields: [tickets.category_id],
    references: [categories.id],
  }),
}));
```

### Many-to-Many

```typescript
// User roles (user can have multiple roles)
export const user_roles = pgTable("user_roles", {
  id: serial("id").primaryKey(),
  user_id: uuid("user_id").references(() => users.id).notNull(),
  role_id: integer("role_id").references(() => roles.id).notNull(),
  domain: varchar("domain", { length: 64 }),
  scope: varchar("scope", { length: 128 }),
});

// Category Assignments (Multiple admins per category)
export const category_assignments = pgTable("category_assignments", {
  id: serial("id").primaryKey(),
  category_id: integer("category_id").references(() => categories.id),
  staff_id: integer("staff_id").references(() => staff.id),
  is_primary: boolean("is_primary").default(false),
  priority: integer("priority").default(0),
});

// Notification Settings (Per-user configuration)
export const notification_settings = pgTable("notification_settings", {
  id: serial("id").primaryKey(),
  user_id: uuid("user_id").references(() => users.id),
  email_enabled: boolean("email_enabled").default(true),
  slack_enabled: boolean("slack_enabled").default(true),
  preferences: jsonb("preferences"), // Granular settings
});
```

## Drizzle ORM Usage

### Basic Queries

```typescript
// Select all
const allTickets = await db.select().from(tickets);

// With where clause
const openTickets = await db.select()
  .from(tickets)
  .where(eq(tickets.status, "OPEN"));

// With joins
const ticketsWithCategory = await db.select()
  .from(tickets)
  .innerJoin(categories, eq(tickets.category_id, categories.id));
```

### Query Builder

```typescript
// Using query builder (recommended)
const tickets = await db.query.tickets.findMany({
  where: eq(tickets.status, "OPEN"),
  with: {
    category: true,
    created_by_user: true,
    assigned_admin: true,
  },
  limit: 10,
  orderBy: desc(tickets.created_at),
});
```

### Transactions

```typescript
await db.transaction(async (tx) => {
  // Update ticket
  const [ticket] = await tx.update(tickets)
    .set({ status: "RESOLVED" })
    .where(eq(tickets.id, ticketId))
    .returning();

  // Log activity
  await tx.insert(activity_logs).values({
    ticket_id: ticketId,
    action: "status_change",
  });

  // Create notification
  await tx.insert(outbox).values({
    event_type: "ticket.resolved",
    payload: { ticket_id: ticketId },
  });
});
```

## Migrations

### Generate Migration

```bash
pnpm drizzle-kit generate
```

This creates SQL migration files in `drizzle/` directory.

### Apply Migration

```bash
pnpm drizzle-kit push
```

### Migration Example

```sql
-- Adding FORWARDED status
ALTER TYPE ticket_status ADD VALUE 'FORWARDED';

-- Adding index
CREATE INDEX idx_tickets_forwarded 
ON tickets(status) 
WHERE status = 'FORWARDED';
```

## Performance Optimizations

### Indexes

```typescript
// Composite index for common query
index("idx_tickets_status_created")
  .on(table.status, table.created_at)

// Partial index for active tickets
// CREATE INDEX idx_tickets_open 
// ON tickets(created_at) 
// WHERE status != 'RESOLVED';
```

### JSONB Queries

```typescript
// Query JSONB field
const tickets = await db.select()
  .from(tickets)
  .where(
    sql`${tickets.metadata}->>'hostel' = 'Neeladri'`
  );

// GIN index makes this fast
```

### Pagination

```typescript
const page = 1;
const limit = 50;

const tickets = await db.query.tickets.findMany({
  limit,
  offset: (page - 1) * limit,
  orderBy: desc(tickets.created_at),
});
```

## Data Integrity

### Foreign Key Constraints

```typescript
// Cascade delete
created_by: uuid("created_by")
  .references(() => users.id, { onDelete: "cascade" })

// Set null on delete
assigned_to: integer("assigned_to")
  .references(() => staff.id, { onDelete: "set null" })
```

### Unique Constraints

```typescript
// Single column
email: varchar("email").unique()

// Composite unique
unique("unique_user_role_scope").on(
  table.user_id,
  table.role_id,
  table.domain,
  table.scope
)
```

### Check Constraints

```typescript
// Ensure positive values
escalation_level: integer("escalation_level")
  .default(0)
  .notNull()
  .$type<number>()
```

## Summary

### Technologies:
- ✅ Drizzle ORM - Type-safe queries
- ✅ PostgreSQL - Robust database
- ✅ JSONB - Flexible data
- ✅ Indexes - Fast queries
- ✅ Transactions - Data consistency

### Best Practices:
- Use transactions for related changes
- Index frequently queried columns
- Use JSONB for flexible metadata
- Preserve historical data with snapshots
- Normalize data to reduce redundancy
